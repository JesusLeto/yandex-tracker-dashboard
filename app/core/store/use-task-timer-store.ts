import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useTimerStore } from './use-timer-store'
import { useExtensionBridgeStore } from './use-extension-bridge-store'
import { calculateElapsedSeconds } from '../utils/time'
import type { StopDraft } from '../extension/protocol'

export const useTaskTimerStore = defineStore('task-timer', () => {
  const bridge = useExtensionBridgeStore()
  const busy = ref(false)
  const toast = useToast()
  const legacy = () => useTimerStore()
  const isShared = computed(() => bridge.engaged)
  const isRunning = computed(() => (bridge.engaged ? !!bridge.snapshot?.timer : legacy().isRunning))
  const issueKey = computed(() => (bridge.engaged ? (bridge.snapshot?.timer?.issueKey ?? null) : legacy().issueKey))
  const issueSummary = computed(() =>
    bridge.engaged ? (bridge.snapshot?.timer?.issueSummary ?? null) : legacy().issueSummary
  )
  const startedAt = computed(() => (bridge.engaged ? (bridge.snapshot?.timer?.startedAt ?? null) : legacy().startedAt))
  const sessionId = computed(() => (bridge.engaged ? (bridge.snapshot?.timer?.id ?? null) : legacy().startedAt))
  const isSaving = computed(() => busy.value || (!bridge.engaged && legacy().isSaving))
  const isBlocked = computed(() => bridge.blocked)
  const uncertain = computed(() => !!bridge.snapshot?.uncertain)
  const canRetry = computed(() => !!bridge.snapshot?.canRetry)
  const draft = computed(() => bridge.snapshot?.draft ?? null)

  async function run(action: () => Promise<void>) {
    if (busy.value) return
    busy.value = true
    try {
      await action()
    } catch (error) {
      toast.add({ title: error instanceof Error ? error.message : 'Не удалось изменить таймер', color: 'error' })
    } finally {
      busy.value = false
    }
  }

  async function start(key: string, summary: string, transition = false, estimation?: string) {
    await run(async () => {
      if (!bridge.engaged) {
        legacy().start(key, summary)
        return
      }
      const result = await bridge.request({ type: 'start', issueKey: key, transition, estimation })
      bridge.receive(result)
      if (result.notice) toast.add({ title: result.notice, color: 'warning' })
    })
  }

  async function stop(
    comment?: string,
    customSeconds?: number,
    transitionId?: string,
    expectedSession?: string | null
  ) {
    await run(async () => {
      if (!bridge.engaged) {
        await legacy().stop(comment, customSeconds)
        return
      }
      if (!sessionId.value || (expectedSession && expectedSession !== sessionId.value))
        throw new Error('Таймер уже изменился. Обновите состояние.')
      const result = await bridge.request({
        type: 'stop',
        draft: {
          timerId: sessionId.value,
          seconds: customSeconds ?? calculateElapsedSeconds(startedAt.value),
          comment: comment ?? '',
          withTransition: !!transitionId,
          transitionId: transitionId ?? null
        }
      })
      bridge.receive(result)
      if (result.notice) toast.add({ title: result.notice, color: 'warning' })
    })
  }

  async function reset() {
    await run(async () => {
      if (!bridge.engaged) {
        legacy().reset()
        return
      }
      if (sessionId.value) bridge.receive(await bridge.request({ type: 'discard', timerId: sessionId.value }))
    })
  }

  async function saveDraft(value: StopDraft) {
    if (!bridge.engaged || bridge.blocked || sessionId.value !== value.timerId) return
    await bridge.request({ type: 'draft', draft: value }).catch(() => {})
  }

  async function reconcile() {
    await run(async () => {
      if (sessionId.value) bridge.receive(await bridge.request({ type: 'reconcile', timerId: sessionId.value }))
    })
  }

  async function allowRetry() {
    await run(async () => {
      if (sessionId.value) bridge.receive(await bridge.request({ type: 'allow-retry', timerId: sessionId.value }))
    })
  }

  return {
    isShared,
    isRunning,
    issueKey,
    issueSummary,
    startedAt,
    sessionId,
    isSaving,
    isBlocked,
    uncertain,
    canRetry,
    draft,
    start,
    stop,
    reset,
    saveDraft,
    reconcile,
    allowRetry
  }
})
