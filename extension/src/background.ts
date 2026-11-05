import { parseISO } from 'date-fns'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import type { Yandex } from '../../app/core/types/api/yandex-tracker/yandex-tracker.entity'
import type { ExtensionCommand, ExtensionState, IssuePage } from '../../app/core/extension/protocol'
import { isExtensionRequest } from '../../app/core/extension/protocol'
import { buildFetchQuery, getIssuesOrderParam } from '../../app/core/utils/my-issues'
import { calculateTotalHours, formatHoursToFixed } from '../../app/core/utils/time'
import { DEFAULT_TIME_ZONE } from '../../app/modules/settings/models/constants/time-zone'
import { ApiError, TrackerApi } from './api'
import { login, logout, readCredentials, saveCredentials } from './auth'
import { TimerCoordinator, type UserTimer } from './timer'

interface Binding {
  api: TrackerApi
  user: Yandex.MySelf
  owner: string
  avatar?: string
}
interface Connection {
  port: chrome.runtime.Port
  external: boolean
  binding: Binding | null
  generation: number
}
const connections = new Set<Connection>()
const coordinator = new TimerCoordinator({
  read: async key => (await chrome.storage.local.get(key))[key] as unknown,
  write: async (key, value) => {
    await chrome.storage.local.set({ [key]: value })
  }
})
const ready = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
let loginInProgress: Promise<TrackerApi> | null = null
let authGeneration = 0
let authQueue: Promise<unknown> = Promise.resolve()

function changeAuth(action: () => Promise<void>) {
  const result = authQueue.catch(() => {}).then(action)
  authQueue = result
  return result
}

const emptyState = (): ExtensionState => ({
  authenticated: false,
  owner: null,
  profile: null,
  timer: null,
  draft: null,
  settings: null,
  uncertain: false,
  receipt: null
})
const state = (binding: Binding, record: UserTimer, notice?: string): ExtensionState => ({
  authenticated: true,
  owner: binding.owner,
  profile: { name: binding.user.display, login: binding.user.login, avatar: binding.avatar },
  timer: record.timer,
  draft: record.draft,
  settings: record.settings,
  uncertain: !!record.pending,
  canRetry: !!record.pending?.checkedEmpty,
  receipt: record.receipt,
  notice
})

async function bind(api: TrackerApi, avatar = false): Promise<Binding> {
  const user = await api.myself()
  return { api, user, owner: `${user.uid}:${api.organizationId}`, avatar: avatar ? await api.avatar() : undefined }
}

function send(connection: Connection, message: unknown) {
  try {
    connection.port.postMessage(message)
  } catch {
    connections.delete(connection)
  }
}

function broadcast(binding: Binding, record: UserTimer, notice?: string) {
  for (const connection of connections)
    if (connection.binding?.owner === binding.owner)
      send(connection, { event: 'state', state: state(connection.binding, record, notice) })
}

async function handle(connection: Connection, command: ExtensionCommand): Promise<unknown> {
  await ready
  if (command.type === 'hello') {
    if (!connection.external) throw new Error('Недопустимая команда')
    const generation = ++connection.generation
    const binding = await bind(new TrackerApi(command.token, command.organizationId))
    if (generation !== connection.generation || !connections.has(connection)) throw new Error('Соединение изменилось')
    connection.binding = binding
    const profile = await binding.api.profile()
    await chrome.storage.local.set({ [`ytd:extension:organization:${profile.id}`]: command.organizationId })
    return coordinator.run(binding.owner, async (record, save) => {
      record.settings = command.settings
      await save()
      broadcast(binding, record)
      return state(binding, record)
    })
  }
  if (command.type === 'login') {
    if (connection.external) throw new Error('Недопустимая команда')
    if (loginInProgress) throw new Error('Вход через Яндекс уже выполняется')
    const generation = ++authGeneration
    loginInProgress = login(command.organizationId).finally(() => {
      loginInProgress = null
    })
    const binding = await bind(await loginInProgress, true)
    await changeAuth(async () => {
      if (generation !== authGeneration) throw new Error('Вход отменён')
      await saveCredentials(binding.api)
    })
    if (generation !== authGeneration) throw new Error('Вход отменён')
    for (const peer of connections) if (!peer.external) peer.binding = binding
  }
  if (command.type === 'logout') {
    if (connection.external) throw new Error('Недопустимая команда')
    authGeneration++
    await changeAuth(logout)
    for (const peer of connections)
      if (!peer.external) {
        peer.binding = null
        send(peer, { event: 'state', state: emptyState() })
      }
    return emptyState()
  }
  if (!connection.binding && !connection.external && command.type === 'state') {
    const generation = authGeneration
    const credentials = await readCredentials()
    if (credentials) {
      const binding = await bind(new TrackerApi(credentials.token, credentials.organizationId), true)
      if (generation !== authGeneration) throw new Error('Сессия изменилась')
      connection.binding = binding
    }
  }
  const binding = connection.binding
  if (!binding) {
    if (command.type === 'state') return emptyState()
    throw new Error('Войдите через Яндекс')
  }
  if (command.type === 'today-hours') {
    if (connection.external) throw new Error('Недопустимая команда')
    const timeZone = await coordinator.run(
      binding.owner,
      async record => record.settings?.timeZone ?? DEFAULT_TIME_ZONE.id
    )
    const day = formatInTimeZone(new Date(), timeZone, 'yyyy-MM-dd')
    const from = fromZonedTime(`${day}T00:00:00.000`, timeZone)
    const to = fromZonedTime(`${day}T23:59:59.999`, timeZone)
    const worklogs = await binding.api.worklogs(binding.user.login, { from: from.toISOString(), to: to.toISOString() })
    const unique = new Map(worklogs.map(worklog => [worklog.id, worklog]))
    const today = [...unique.values()].filter(worklog => {
      const start = parseISO(worklog.start)
      return start >= from && start <= to
    })
    return formatHoursToFixed(calculateTotalHours(today))
  }
  return coordinator.run(binding.owner, async (record, save) => {
    let notice: string | undefined
    switch (command.type) {
      case 'state':
      case 'login':
        break
      case 'settings':
        if (!connection.external) throw new Error('Настройки изменяются на сайте')
        record.settings = command.settings
        await save()
        break
      case 'issues': {
        if (!record.settings) throw new Error('Откройте Dashboard для синхронизации настроек.')
        const settings = record.settings.myIssues
        const statuses = settings.statuses.length ? settings.statuses : ['open', 'rediscovered']
        const query = `${buildFetchQuery(binding.user.login, { statuses, priority: null, queue: '' }, settings.roles)} ${getIssuesOrderParam(command.sort)}`
        const response = await binding.api.raw<Yandex.Issue[]>(
          `/tracker/issues/_search?perPage=5&page=${command.page}`,
          'POST',
          { query }
        )
        const spentHours: Record<string, number> = {}
        if (settings.display.estimation)
          for (const issue of response.data) {
            const logs = await binding.api.request<Yandex.Worklog[]>(
              `/tracker/issues/${encodeURIComponent(issue.key)}/worklog`
            )
            spentHours[issue.key] = formatHoursToFixed(calculateTotalHours(logs))
          }
        return {
          issues: response.data,
          totalPages: Math.max(1, Number(response.headers.get('X-Total-Pages') || '1')),
          spentHours
        } satisfies IssuePage
      }
      case 'transitions':
        return binding.api.transitions(command.issueKey)
      case 'start':
        notice = await coordinator.start(
          record,
          save,
          binding.api,
          command.issueKey,
          command.transition,
          command.estimation
        )
        break
      case 'draft':
        if (record.timer?.id !== command.draft.timerId) throw new Error('Таймер уже изменился')
        record.draft = command.draft
        await save()
        break
      case 'stop':
        notice = await coordinator.stop(record, save, binding.api, command.draft)
        break
      case 'discard':
        if (record.pending) throw new Error('Сначала проверьте результат сохранения')
        if (record.timer?.id !== command.timerId) throw new Error('Таймер уже изменился')
        record.timer = null
        record.draft = null
        await save()
        break
      case 'allow-retry':
        if (record.timer?.id !== command.timerId || !record.pending?.checkedEmpty)
          throw new Error('Сначала проверьте результат сохранения.')
        record.pending = null
        await save()
        break
      case 'reconcile':
        if (record.timer?.id !== command.timerId) throw new Error('Таймер уже изменился')
        await coordinator.reconcile(record, save, binding.api, binding.user.login)
        break
    }
    broadcast(binding, record, notice)
    return state(binding, record, notice)
  })
}

function connect(port: chrome.runtime.Port, external: boolean) {
  if (external) {
    if (
      !port.sender?.url ||
      new URL(port.sender.url).origin !== __DASHBOARD_ORIGIN__ ||
      (port.sender.frameId !== undefined && port.sender.frameId !== 0)
    ) {
      port.disconnect()
      return
    }
  } else if (port.sender?.id !== chrome.runtime.id) {
    port.disconnect()
    return
  }
  const connection: Connection = { port, external, binding: null, generation: 0 }
  connections.add(connection)
  port.onDisconnect.addListener(() => {
    connection.generation++
    connections.delete(connection)
  })
  port.onMessage.addListener((message: unknown) => {
    if (!isExtensionRequest(message)) {
      port.disconnect()
      return
    }
    const generation = authGeneration
    void handle(connection, message.command).then(
      value => {
        if (
          !connection.external &&
          message.command.type !== 'login' &&
          message.command.type !== 'logout' &&
          generation !== authGeneration
        )
          send(connection, { id: message.id, ok: false, error: 'Сессия изменилась' })
        else send(connection, { id: message.id, ok: true, value })
      },
      error => {
        if (
          !connection.external &&
          generation === authGeneration &&
          error instanceof ApiError &&
          error.status === 401
        ) {
          authGeneration++
          for (const peer of connections)
            if (!peer.external) {
              peer.binding = null
              send(peer, { event: 'state', state: emptyState() })
            }
          void changeAuth(logout).catch(() => {})
        }
        send(connection, {
          id: message.id,
          ok: false,
          error: error instanceof Error ? error.message : 'Не удалось выполнить действие'
        })
        const binding = connection.binding
        if (binding) void coordinator.run(binding.owner, async record => broadcast(binding, record)).catch(() => {})
      }
    )
  })
}
chrome.runtime.onConnect.addListener(port => connect(port, false))
chrome.runtime.onConnectExternal.addListener(port => connect(port, true))
