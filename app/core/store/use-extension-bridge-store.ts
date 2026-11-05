import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { createExtensionClient, ExtensionCommand, ExtensionState } from '../extension/protocol'
import { isRecord, isTimerSession } from '../extension/protocol'
import { useWorklogBus } from '../composables/use-worklog-bus'
import { useIssueBus } from '../composables/use-issue-bus'

export const useExtensionBridgeStore = defineStore('extension-bridge', () => {
  const engaged = ref(import.meta.client && localStorage.getItem('ytd:extension:paired') === '1')
  const connected = ref(false)
  const snapshot = shallowRef<ExtensionState | null>(null)
  let client: ReturnType<typeof createExtensionClient> | null = null
  const receipts = new Set<string>()
  const starts = new Set<string>()

  function receive(state: ExtensionState) {
    if (!state.authenticated || !state.owner) return
    engaged.value = true
    connected.value = true
    snapshot.value = state
    localStorage.setItem('ytd:extension:paired', '1')
    localStorage.setItem(
      `ytd:extension:mirror:${state.owner}`,
      JSON.stringify({ timer: state.timer, uncertain: state.uncertain })
    )
    if (state.receipt && !receipts.has(state.receipt.worklog.id)) {
      receipts.add(state.receipt.worklog.id)
      useWorklogBus().emit('saved', state.receipt.worklog)
      if (state.receipt.status) useIssueBus().emit({ key: state.receipt.issueKey, status: state.receipt.status })
    }
    if (state.timer?.status && !starts.has(state.timer.id)) {
      starts.add(state.timer.id)
      useIssueBus().emit({ key: state.timer.issueKey, status: state.timer.status })
    }
  }

  function attach(value: ReturnType<typeof createExtensionClient> | null, clear = false) {
    client = value
    connected.value = false
    if (clear) {
      snapshot.value = null
      receipts.clear()
      starts.clear()
    }
  }

  async function request<C extends ExtensionCommand>(command: C) {
    if (!client || !connected.value)
      throw new Error('Нет связи с расширением. Восстановите соединение перед изменением таймера.')
    return client.request(command)
  }

  function restoreMirror(owner: string) {
    if (snapshot.value?.owner === owner) return
    try {
      const raw = localStorage.getItem(`ytd:extension:mirror:${owner}`)
      const mirror: unknown = raw ? JSON.parse(raw) : null
      if (
        !isRecord(mirror) ||
        (mirror.timer !== null && !isTimerSession(mirror.timer)) ||
        typeof mirror.uncertain !== 'boolean'
      )
        return
      snapshot.value = {
        authenticated: true,
        owner,
        profile: null,
        settings: null,
        timer: mirror.timer,
        uncertain: mirror.uncertain,
        draft: null,
        receipt: null
      }
    } catch {
      /* An unreadable mirror stays untouched and never authorizes writes. */
    }
  }

  return {
    engaged,
    connected,
    snapshot,
    blocked: computed(() => engaged.value && !connected.value),
    attach,
    receive,
    restoreMirror,
    request
  }
})
