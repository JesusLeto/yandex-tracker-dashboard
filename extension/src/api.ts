import type { Yandex } from '../../app/core/types/api/yandex-tracker/yandex-tracker.entity'
import type { YandexInfo } from '../../app/core/types/api/yandex-info/yandex-info.entity'
import { isRecord } from '../../app/core/extension/protocol'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export class TrackerApi {
  constructor(
    readonly token: string,
    readonly organizationId: string
  ) {}

  async raw<T>(path: string, method = 'GET', body?: unknown): Promise<{ data: T; headers: Headers }> {
    const response = await fetch(`${__DASHBOARD_ORIGIN__}${path}`, {
      method,
      credentials: 'omit',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `OAuth ${this.token}`,
        ...(this.organizationId ? { 'X-Cloud-Org-ID': this.organizationId } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    if (!response.ok) {
      if (response.status === 401) throw new ApiError('Сессия истекла. Войдите через Яндекс ещё раз.', 401)
      if (response.status === 403)
        throw new ApiError('Нет доступа к организации или задаче. Проверьте ID организации и права.', 403)
      let detail = ''
      const error: unknown = await response.json().catch(() => null)
      if (isRecord(error) && Array.isArray(error.errorMessages))
        detail = error.errorMessages.filter((message): message is string => typeof message === 'string').join('. ')
      throw new ApiError(detail || `Не удалось выполнить запрос (${response.status})`, response.status)
    }
    return { data: (await response.json()) as T, headers: response.headers }
  }

  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    return (await this.raw<T>(path, method, body)).data
  }

  myself() {
    return this.request<Yandex.MySelf>('/tracker/myself')
  }
  profile() {
    return this.request<YandexInfo.Avatar>('/profile/info?format=json')
  }
  issue(key: string) {
    return this.request<Yandex.Issue>(`/tracker/issues/${encodeURIComponent(key)}`)
  }
  transitions(key: string) {
    return this.request<Yandex.Transition[]>(`/tracker/issues/${encodeURIComponent(key)}/transitions`)
  }
  transition(key: string, id: string, estimation?: string) {
    return this.request<Yandex.Transition[]>(
      `/tracker/issues/${encodeURIComponent(key)}/transitions/${encodeURIComponent(id)}/_execute`,
      'POST',
      estimation ? { estimation } : {}
    )
  }

  async avatar(): Promise<string | undefined> {
    try {
      const profile = await this.profile()
      const response = await fetch(
        `${__DASHBOARD_ORIGIN__}/avatar/${encodeURIComponent(profile.default_avatar_id)}/islands-68`,
        { credentials: 'omit', signal: AbortSignal.timeout(15000) }
      )
      if (!response.ok) return
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > 200000) return
      return `data:image/jpeg;base64,${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`
    } catch {
      return undefined
    }
  }
}
