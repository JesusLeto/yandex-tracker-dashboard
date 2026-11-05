import type { Yandex } from '../types/api/yandex-tracker/yandex-tracker.entity'
import type { IssueDisplay } from '../types/issues'
import type { IssueRoles, IssuesSortMode } from '../utils/my-issues'
import type { ThemeEntities, ThemeType } from '../types'

export const PROTOCOL_VERSION = 1

export interface ExtensionSettings {
  myIssues: { statuses: string[]; roles: IssueRoles; display: IssueDisplay }
  timeZone: string
  hoursInDay?: number
  colorMode: 'dark' | 'light'
  seasonalTheme: { type?: ThemeType; active: boolean; entities: ThemeEntities }
}

export interface TimerSession {
  id: string
  issueKey: string
  issueSummary: string
  startedAt: string
  status?: Yandex.BaseWithKey
}

export interface StopDraft {
  timerId: string
  seconds: number
  comment: string
  withTransition: boolean
  transitionId: string | null
}

export interface TimerReceipt {
  timerId: string
  worklog: Yandex.Worklog
  status?: Yandex.BaseWithKey
  issueKey: string
}

export interface ExtensionState {
  authenticated: boolean
  owner: string | null
  profile: { name: string; login: string; avatar?: string } | null
  timer: TimerSession | null
  draft: StopDraft | null
  settings: ExtensionSettings | null
  uncertain: boolean
  canRetry?: boolean
  receipt: TimerReceipt | null
  notice?: string
}

export interface IssuePage {
  issues: Yandex.Issue[]
  totalPages: number
  spentHours: Record<string, number>
}

export type ExtensionCommand =
  | { type: 'hello'; token: string; organizationId: string; settings: ExtensionSettings }
  | { type: 'state' }
  | { type: 'login'; organizationId?: string }
  | { type: 'logout' }
  | { type: 'settings'; settings: ExtensionSettings }
  | { type: 'today-hours' }
  | { type: 'issues'; page: number; sort: IssuesSortMode }
  | { type: 'transitions'; issueKey: string }
  | { type: 'start'; issueKey: string; transition: boolean; estimation?: string }
  | { type: 'stop'; draft: StopDraft }
  | { type: 'draft'; draft: StopDraft }
  | { type: 'discard'; timerId: string }
  | { type: 'reconcile'; timerId: string }
  | { type: 'allow-retry'; timerId: string }

export interface ExtensionResults {
  hello: ExtensionState
  state: ExtensionState
  login: ExtensionState
  logout: ExtensionState
  settings: ExtensionState
  'today-hours': number
  issues: IssuePage
  transitions: Yandex.Transition[]
  start: ExtensionState
  stop: ExtensionState
  draft: ExtensionState
  discard: ExtensionState
  reconcile: ExtensionState
  'allow-retry': ExtensionState
}

export interface ExtensionRequest {
  id: string
  version: number
  command: ExtensionCommand
}

export type ExtensionReply =
  | { id: string; ok: true; value: unknown }
  | { id: string; ok: false; error: string }
  | { event: 'state'; state: ExtensionState }

export interface ExtensionPort {
  postMessage(message: ExtensionRequest): void
  disconnect(): void
  onMessage: { addListener(listener: (message: unknown) => void): void }
  onDisconnect: { addListener(listener: () => void): void }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function isTimerSession(value: unknown): value is TimerSession {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.issueKey === 'string' &&
    typeof value.issueSummary === 'string' &&
    typeof value.startedAt === 'string' &&
    Number.isFinite(Date.parse(value.startedAt)) &&
    (value.status === undefined ||
      (isRecord(value.status) &&
        typeof value.status.id === 'string' &&
        typeof value.status.key === 'string' &&
        typeof value.status.display === 'string'))
  )
}

const text = (value: unknown, max = 10000): value is string => typeof value === 'string' && value.length <= max
const key = (value: unknown): value is string => text(value, 128) && /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(value)
const seconds = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0

export function isStopDraft(value: unknown): value is StopDraft {
  return (
    isRecord(value) &&
    text(value.timerId, 80) &&
    seconds(value.seconds) &&
    text(value.comment) &&
    typeof value.withTransition === 'boolean' &&
    (value.transitionId === null || text(value.transitionId, 128))
  )
}

export function isExtensionSettings(value: unknown): value is ExtensionSettings {
  if (
    !isRecord(value) ||
    !isRecord(value.myIssues) ||
    !isRecord(value.myIssues.roles) ||
    !isRecord(value.myIssues.display) ||
    !isRecord(value.seasonalTheme) ||
    !isRecord(value.seasonalTheme.entities)
  )
    return false
  const { myIssues, seasonalTheme } = value
  const roles = myIssues.roles,
    display = myIssues.display,
    entities = seasonalTheme.entities
  if (!isRecord(roles) || !isRecord(display) || !isRecord(entities)) return false
  try {
    new Intl.DateTimeFormat('ru', { timeZone: String(value.timeZone) })
  } catch {
    return false
  }
  return (
    Array.isArray(myIssues.statuses) &&
    myIssues.statuses.length <= 50 &&
    myIssues.statuses.every(status => text(status, 64) && /^[A-Za-z][A-Za-z0-9_-]*$/.test(status)) &&
    ['assignee', 'reviewer', 'qaEngineer'].every(role => typeof roles[role] === 'boolean') &&
    Object.values(display).every(flag => typeof flag === 'boolean') &&
    text(value.timeZone, 128) &&
    (value.hoursInDay === undefined ||
      (typeof value.hoursInDay === 'number' && Number.isFinite(value.hoursInDay) && value.hoursInDay >= 0)) &&
    (value.colorMode === 'dark' || value.colorMode === 'light') &&
    (seasonalTheme.type === undefined ||
      ['halloween', 'new-year', 'programmer-day', '8-march'].includes(String(seasonalTheme.type))) &&
    typeof seasonalTheme.active === 'boolean' &&
    ['cursor', 'background', 'particles', 'celebrations'].every(entity => typeof entities[entity] === 'boolean')
  )
}

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  if (!isRecord(value) || value.version !== PROTOCOL_VERSION || !text(value.id, 80) || !isRecord(value.command))
    return false
  const c = value.command
  switch (c.type) {
    case 'hello':
      return (
        text(c.token, 4096) &&
        !/[\r\n]/.test(c.token) &&
        text(c.organizationId, 128) &&
        /^[A-Za-z0-9_-]+$/.test(c.organizationId) &&
        isExtensionSettings(c.settings)
      )
    case 'settings':
      return isExtensionSettings(c.settings)
    case 'state':
    case 'logout':
    case 'today-hours':
      return true
    case 'login':
      return (
        c.organizationId === undefined || (text(c.organizationId, 128) && /^[A-Za-z0-9_-]+$/.test(c.organizationId))
      )
    case 'issues':
      return Number.isSafeInteger(c.page) && Number(c.page) > 0 && (c.sort === 'priority' || c.sort === 'deadline')
    case 'transitions':
      return key(c.issueKey)
    case 'start':
      return (
        key(c.issueKey) &&
        typeof c.transition === 'boolean' &&
        (c.estimation === undefined || (text(c.estimation, 100) && /^P[\dYMWDTHS.]+$/.test(c.estimation)))
      )
    case 'stop':
    case 'draft':
      return isStopDraft(c.draft)
    case 'discard':
    case 'reconcile':
    case 'allow-retry':
      return text(c.timerId, 80)
    default:
      return false
  }
}

export function createExtensionClient(
  port: ExtensionPort,
  onState: (state: ExtensionState) => void,
  onDisconnect: () => void
) {
  const pending = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }
  >()
  port.onMessage.addListener(message => {
    if (!isRecord(message)) return
    if (message.event === 'state' && isRecord(message.state)) {
      onState(message.state as unknown as ExtensionState)
      return
    }
    if (typeof message.id !== 'string') return
    const request = pending.get(message.id)
    if (!request) return
    clearTimeout(request.timeout)
    pending.delete(message.id)
    if (message.ok === true) request.resolve(message.value)
    else request.reject(new Error(typeof message.error === 'string' ? message.error : 'Расширение не ответило'))
  })
  port.onDisconnect.addListener(() => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout)
      request.reject(new Error('Связь с расширением потеряна'))
    }
    pending.clear()
    onDisconnect()
  })
  return {
    async request<C extends ExtensionCommand>(command: C): Promise<ExtensionResults[C['type']]> {
      const id = crypto.randomUUID()
      return (await new Promise<unknown>((resolve, reject) => {
        const timeout = setTimeout(
          () => {
            pending.delete(id)
            reject(new Error('Расширение не ответило. Проверьте соединение перед повторной записью.'))
          },
          command.type === 'login' ? 300000 : 45000
        )
        pending.set(id, { resolve, reject, timeout })
        try {
          port.postMessage({ id, version: PROTOCOL_VERSION, command })
        } catch (error) {
          clearTimeout(timeout)
          pending.delete(id)
          reject(error)
        }
      })) as ExtensionResults[C['type']]
    },
    disconnect: () => port.disconnect()
  }
}
