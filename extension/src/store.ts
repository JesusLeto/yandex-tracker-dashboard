import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { useNow } from '@vueuse/core'
import { formatInTimeZone } from 'date-fns-tz'
import {
  createExtensionClient,
  isRecord,
  type ExtensionCommand,
  type ExtensionState,
  type IssuePage,
  type StopDraft
} from '../../app/core/extension/protocol'
import type { IssuesSortMode } from '../../app/core/utils/my-issues'
import type { Yandex } from '../../app/core/types/api/yandex-tracker/yandex-tracker.entity'
import { DEFAULT_TIME_ZONE } from '../../app/modules/settings/models/constants/time-zone'

type ExtensionClient = ReturnType<typeof createExtensionClient>

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

export const usePopupStore = defineStore('extension-popup', () => {
  const state = shallowRef<ExtensionState>(emptyState())
  const now = useNow({ interval: 1000 })
  const timeZone = computed(() => state.value.settings?.timeZone ?? DEFAULT_TIME_ZONE.id)
  const today = computed(() => formatInTimeZone(now.value, timeZone.value, 'yyyy-MM-dd'))
  const todayHours = ref<number | null>()
  const sessionReady = ref(false)
  const connected = ref(false),
    loading = ref(true),
    busyCount = ref(0),
    error = ref('')
  const page = ref(1),
    sort = ref<IssuesSortMode>('priority')
  const issues = ref<Yandex.Issue[]>([]),
    totalPages = ref(1),
    spentHours = shallowRef(new Map<string, number>())
  let client: ExtensionClient | null = null
  const boundClient = shallowRef<ExtensionClient | null>(null)
  let reconnect: ReturnType<typeof setTimeout> | undefined
  let authGeneration = 0,
    fetchGeneration = 0,
    allowUpdates = true
  const recentlyExcluded = new Map<string, number>()

  function updateIssue(key: string, status: Yandex.BaseWithKey) {
    const statuses = state.value.settings?.myIssues.statuses
    const allowed = statuses?.length ? statuses : ['open', 'rediscovered']
    if (!allowed.includes(status.key)) {
      recentlyExcluded.set(key, Date.now())
      issues.value = issues.value.filter(issue => issue.key !== key)
    } else issues.value = issues.value.map(issue => (issue.key === key ? { ...issue, status } : issue))
  }

  function receive(value: ExtensionState) {
    if (!allowUpdates && value.authenticated) return
    const previous = state.value
    state.value = value
    boundClient.value = client
    sessionReady.value = true
    if (previous.owner !== value.owner) recentlyExcluded.clear()
    else if (value.owner) {
      if (value.timer?.status && previous.timer?.id !== value.timer.id)
        updateIssue(value.timer.issueKey, value.timer.status)
      if (
        value.receipt?.status &&
        (previous.receipt?.worklog.id !== value.receipt.worklog.id ||
          previous.receipt.status?.id !== value.receipt.status.id)
      )
        updateIssue(value.receipt.issueKey, value.receipt.status)
    }
    document.documentElement.classList.toggle('dark', value.settings?.colorMode !== 'light')
    document.documentElement.classList.toggle('light', value.settings?.colorMode === 'light')
    if (!value.authenticated) {
      fetchGeneration++
      issues.value = []
      spentHours.value = new Map()
      totalPages.value = 1
    }
  }

  function connect() {
    const port = chrome.runtime.connect({ name: 'popup' })
    const activeClient = createExtensionClient(port, receive, () => {
      if (client !== activeClient) return
      connected.value = false
      boundClient.value = null
      reconnect = setTimeout(connect, 1000)
    })
    client = activeClient
    connected.value = true
    void run({ type: 'state' })
  }

  async function run<C extends ExtensionCommand>(command: C) {
    const generation = authGeneration
    busyCount.value++
    error.value = ''
    try {
      if (!client || !connected.value) throw new Error('Нет связи с расширением. Восстановите соединение.')
      const value = await client.request(command)
      if (generation !== authGeneration) return null
      if (isRecord(value) && typeof value.authenticated === 'boolean') receive(value as unknown as ExtensionState)
      return value
    } catch (reason) {
      if (generation === authGeneration)
        error.value = reason instanceof Error ? reason.message : 'Не удалось выполнить действие'
      return null
    } finally {
      busyCount.value--
      if (command.type === 'state') loading.value = false
    }
  }

  async function authenticate(organizationId?: string) {
    const generation = ++authGeneration
    allowUpdates = false
    busyCount.value++
    error.value = ''
    try {
      if (!client) throw new Error('Нет связи с расширением')
      const result = await client.request({ type: 'login', organizationId })
      if (generation === authGeneration) {
        allowUpdates = true
        receive(result)
      }
    } catch (reason) {
      if (generation === authGeneration) error.value = reason instanceof Error ? reason.message : 'Не удалось войти'
    } finally {
      busyCount.value--
    }
  }

  async function signOut() {
    authGeneration++
    allowUpdates = false
    receive(emptyState())
    await run({ type: 'logout' })
  }

  async function saveDraft(draft: StopDraft) {
    if (!client || !connected.value || !state.value.authenticated) return
    const generation = authGeneration
    try {
      await client.request({ type: 'draft', draft })
    } catch {
      if (generation === authGeneration && state.value.timer?.id === draft.timerId)
        error.value = 'Не удалось сохранить изменения формы. Восстановите соединение перед закрытием.'
    }
  }

  async function refresh() {
    const generation = ++fetchGeneration,
      owner = state.value.owner
    if (!state.value.authenticated || !state.value.settings || !client) {
      loading.value = false
      return
    }
    loading.value = true
    try {
      const result: IssuePage = await client.request({ type: 'issues', page: page.value, sort: sort.value })
      if (generation !== fetchGeneration || owner !== state.value.owner) return
      totalPages.value = result.totalPages
      if (page.value > result.totalPages) {
        page.value = result.totalPages
        return
      }
      issues.value = result.issues.filter(issue => {
        const excluded = recentlyExcluded.get(issue.key)
        if (excluded === undefined) return true
        if (Date.now() - excluded < 10000) return false
        recentlyExcluded.delete(issue.key)
        return true
      })
      spentHours.value = new Map(Object.entries(result.spentHours))
    } catch (reason) {
      if (generation === fetchGeneration)
        error.value = reason instanceof Error ? reason.message : 'Не удалось загрузить задачи'
    } finally {
      if (generation === fetchGeneration) loading.value = false
    }
  }

  watch(
    [boundClient, () => state.value.owner, timeZone, today, () => state.value.receipt?.worklog.id],
    async ([activeClient, owner], _previous, onCleanup) => {
      todayHours.value = undefined
      if (!owner || !activeClient) return
      let active = true
      onCleanup(() => {
        active = false
      })
      try {
        const hours = await activeClient.request({ type: 'today-hours' })
        if (active) todayHours.value = hours
      } catch {
        if (active) todayHours.value = null
      }
    }
  )

  watch(
    [
      () => state.value.owner,
      () => JSON.stringify(state.value.settings?.myIssues),
      () => state.value.receipt?.worklog.id
    ],
    () => {
      page.value = 1
      void refresh()
    }
  )
  watch([page, sort], () => {
    void refresh()
  })
  connect()
  onScopeDispose(() => {
    clearTimeout(reconnect)
    const old = client
    client = null
    old?.disconnect()
  })
  return {
    state,
    now,
    todayHours,
    sessionReady,
    connected,
    loading,
    busy: computed(() => busyCount.value > 0),
    error,
    page,
    sort,
    issues,
    totalPages,
    spentHours,
    run,
    authenticate,
    signOut,
    refresh,
    saveDraft
  }
})
