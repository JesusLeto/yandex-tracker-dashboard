import { TrackerApi } from './api'
import { isRecord } from '../../app/core/extension/protocol'

interface Credentials {
  token: string
  organizationId: string
}
const AUTH_KEY = 'ytd:extension:auth'

export async function readCredentials(): Promise<Credentials | null> {
  const value: unknown = (await chrome.storage.local.get(AUTH_KEY))[AUTH_KEY]
  return isRecord(value) &&
    typeof value.token === 'string' &&
    value.token.length <= 4096 &&
    !/[\r\n]/.test(value.token) &&
    typeof value.organizationId === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(value.organizationId)
    ? { token: value.token, organizationId: value.organizationId }
    : null
}

function randomString() {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function login(organizationId?: string): Promise<TrackerApi> {
  if (!__YANDEX_CLIENT_ID__) throw new Error('Вход временно недоступен: авторизация расширения ещё не настроена.')
  const state = randomString(),
    verifier = randomString()
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  const challenge = btoa(String.fromCharCode(...hash))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  await chrome.storage.session.set({ 'ytd:extension:oauth': { state, verifier } })
  try {
    const redirect = chrome.identity.getRedirectURL()
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: __YANDEX_CLIENT_ID__,
      redirect_uri: redirect,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    })
    const result = await chrome.identity.launchWebAuthFlow({
      url: `https://oauth.yandex.ru/authorize?${params}`,
      interactive: true
    })
    if (!result) throw new Error('Вход отменён')
    const url = new URL(result)
    const transaction: unknown = (await chrome.storage.session.get('ytd:extension:oauth'))['ytd:extension:oauth']
    if (
      !result.startsWith(redirect) ||
      !isRecord(transaction) ||
      transaction.state !== state ||
      url.searchParams.get('state') !== state
    )
      throw new Error('Не удалось подтвердить вход. Повторите авторизацию.')
    const code = url.searchParams.get('code')
    if (!code || url.searchParams.has('error')) throw new Error('Доступ не предоставлен. Повторите вход через Яндекс.')
    const response = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      credentials: 'omit',
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: __YANDEX_CLIENT_ID__,
        code,
        code_verifier: verifier
      })
    })
    const value: unknown = await response.json()
    if (!response.ok || !isRecord(value) || typeof value.access_token !== 'string')
      throw new Error('Не удалось завершить вход через Яндекс.')
    const profile = await new TrackerApi(value.access_token, '').profile()
    const hintKey = `ytd:extension:organization:${profile.id}`
    const stored = await chrome.storage.local.get(hintKey)
    const organization = organizationId || (typeof stored[hintKey] === 'string' ? stored[hintKey] : '')
    if (!organization)
      throw new Error('Укажите ID организации или откройте Dashboard тем же аккаунтом для первоначальной связи.')
    return new TrackerApi(value.access_token, organization)
  } finally {
    await chrome.storage.session.remove('ytd:extension:oauth')
  }
}

export const logout = () => chrome.storage.local.remove(AUTH_KEY)
export const saveCredentials = (api: TrackerApi) =>
  chrome.storage.local.set({ [AUTH_KEY]: { token: api.token, organizationId: api.organizationId } })
