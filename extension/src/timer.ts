import type { Yandex } from '../../app/core/types/api/yandex-tracker/yandex-tracker.entity'
import type { ExtensionSettings, StopDraft, TimerReceipt, TimerSession } from '../../app/core/extension/protocol'
import { isExtensionSettings, isRecord, isStopDraft, isTimerSession } from '../../app/core/extension/protocol'
import { buildWorklogPayload, calculateDurationInHours } from '../../app/core/utils/time'
import { ApiError, type TrackerApi } from './api'

export interface UserTimer {
  version: 1
  revision: number
  timer: TimerSession | null
  draft: StopDraft | null
  settings: ExtensionSettings | null
  pending: {
    timerId: string
    payload: ReturnType<typeof buildWorklogPayload>
    phase: 'posting' | 'unknown'
    checkedEmpty?: boolean
  } | null
  receipt: TimerReceipt | null
}

export interface TimerStorage {
  read(key: string): Promise<unknown>
  write(key: string, value: UserTimer): Promise<void>
}

function validPending(value: unknown): boolean {
  if (value === null) return true
  if (!isRecord(value) || typeof value.timerId !== 'string' || !isRecord(value.payload)) return false
  return (
    (value.phase === 'posting' || value.phase === 'unknown') &&
    typeof value.payload.start === 'string' &&
    Number.isFinite(Date.parse(value.payload.start)) &&
    typeof value.payload.duration === 'string' &&
    (value.payload.comment === undefined || typeof value.payload.comment === 'string') &&
    (value.checkedEmpty === undefined || typeof value.checkedEmpty === 'boolean')
  )
}

function validReceipt(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.timerId === 'string' &&
      typeof value.issueKey === 'string' &&
      isRecord(value.worklog) &&
      typeof value.worklog.id === 'string' &&
      typeof value.worklog.start === 'string' &&
      typeof value.worklog.duration === 'string' &&
      isRecord(value.worklog.issue) &&
      typeof value.worklog.issue.key === 'string')
  )
}

export class TimerCoordinator {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private storage: TimerStorage) {}

  run<T>(owner: string, action: (record: UserTimer, save: () => Promise<void>) => Promise<T>): Promise<T> {
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        const key = `ytd:extension:timer:v1:${owner}`
        const stored = await this.storage.read(key)
        let record: UserTimer
        if (stored === undefined || stored === null)
          record = { version: 1, revision: 0, timer: null, draft: null, settings: null, pending: null, receipt: null }
        else {
          if (
            !isRecord(stored) ||
            stored.version !== 1 ||
            !Number.isSafeInteger(stored.revision) ||
            Number(stored.revision) < 0 ||
            (stored.settings !== null && !isExtensionSettings(stored.settings)) ||
            (stored.draft !== null && !isStopDraft(stored.draft)) ||
            (stored.timer !== null && !isTimerSession(stored.timer)) ||
            !validPending(stored.pending) ||
            !validReceipt(stored.receipt)
          )
            throw new Error('Не удалось прочитать сохранённый таймер. Данные сохранены; автоматический сброс отключён.')
          record = stored as unknown as UserTimer
        }
        const save = async () => {
          record.revision++
          await this.storage.write(key, record)
        }
        return action(record, save)
      })
    this.queue = task
    return task
  }

  async start(
    record: UserTimer,
    save: () => Promise<void>,
    api: TrackerApi,
    issueKey: string,
    transition: boolean,
    estimation?: string
  ): Promise<string | undefined> {
    if (record.timer || record.pending) throw new Error('Сначала остановите текущий таймер.')
    const issue = await api.issue(issueKey)
    let notice: string | undefined
    if (transition) {
      try {
        const transitions = await api.transitions(issueKey)
        const target = transitions.find(
          t => t.to.id.toLowerCase().includes('inprogress') || t.to.display.toLowerCase().includes('работ')
        )
        if (target) {
          await api.transition(issueKey, target.id, estimation)
          issue.status = target.to
        } else notice = 'Переход не найден. Таймер запущен без смены статуса.'
      } catch {
        notice = 'Не удалось сменить статус. Таймер запущен без смены статуса.'
      }
    }
    record.timer = {
      id: crypto.randomUUID(),
      issueKey,
      issueSummary: issue.summary,
      startedAt: new Date().toISOString(),
      status: issue.status
    }
    record.draft = null
    await save()
    return notice
  }

  async stop(
    record: UserTimer,
    save: () => Promise<void>,
    api: TrackerApi,
    draft: StopDraft
  ): Promise<string | undefined> {
    if (record.receipt?.timerId === draft.timerId) return
    if (!record.timer || record.timer.id !== draft.timerId) throw new Error('Таймер уже изменился. Обновите состояние.')
    if (record.pending) throw new Error('Результат предыдущей записи неизвестен. Сначала проверьте сохранение.')
    const timer = record.timer
    record.draft = draft
    const payload = buildWorklogPayload(timer.startedAt, draft.seconds, draft.comment)
    record.pending = { timerId: timer.id, payload, phase: 'posting' }
    await save()
    let worklog: Yandex.Worklog
    try {
      worklog = await api.request<Yandex.Worklog>(
        `/tracker/issues/${encodeURIComponent(timer.issueKey)}/worklog`,
        'POST',
        payload
      )
    } catch (error) {
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) record.pending = null
      else record.pending.phase = 'unknown'
      await save()
      throw error instanceof ApiError && error.status < 500
        ? error
        : new Error(
            'Не удалось подтвердить сохранение. Таймер и форма сохранены. Проверьте результат перед повторной записью.'
          )
    }
    record.receipt = { timerId: timer.id, issueKey: timer.issueKey, worklog }
    record.timer = null
    record.draft = null
    record.pending = null
    await save()
    if (draft.withTransition && draft.transitionId) {
      try {
        const transitions = await api.transitions(timer.issueKey)
        const target = transitions.find(t => t.id === draft.transitionId)
        if (!target) throw new Error('Переход не найден')
        await api.transition(timer.issueKey, target.id)
        record.receipt.status = target.to
        await save()
      } catch {
        return 'Время сохранено, но статус задачи изменить не удалось.'
      }
    }
  }

  async reconcile(record: UserTimer, save: () => Promise<void>, api: TrackerApi, login: string): Promise<void> {
    if (!record.pending || !record.timer) return
    const payload = record.pending.payload
    const worklogs: Yandex.Worklog[] = []
    let page = 1,
      totalPages = 1
    do {
      const response = await api.raw<Yandex.Worklog[]>(`/tracker/worklog/_search?perPage=100&page=${page}`, 'POST', {
        createdBy: login,
        start: { from: payload.start, to: new Date().toISOString() }
      })
      worklogs.push(...response.data)
      totalPages = Number(response.headers.get('X-Total-Pages') || '1')
      page++
    } while (page <= totalPages)
    const found = worklogs.filter(
      w =>
        w.issue.key === record.timer?.issueKey &&
        Date.parse(w.start) === Date.parse(payload.start) &&
        calculateDurationInHours(w.duration) === calculateDurationInHours(payload.duration) &&
        (w.comment || '').trim() === (payload.comment || '')
    )
    if (found.length !== 1) {
      record.pending.checkedEmpty = found.length === 0
      await save()
      throw new Error(
        'Однозначная запись не найдена. Проверьте трудозатраты в Tracker; автоматическая повторная запись заблокирована.'
      )
    }
    record.receipt = { timerId: record.timer.id, issueKey: record.timer.issueKey, worklog: found[0]! }
    record.timer = null
    record.draft = null
    record.pending = null
    await save()
  }
}
