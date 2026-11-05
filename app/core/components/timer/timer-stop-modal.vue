<script setup lang="ts">
import ModalBase from '~/core/components/modal/modal-base.vue'
import TimerStopForm from './timer-stop-form.vue'
import { useTaskTimerStore } from '~/core/store/use-task-timer-store'
import yandexTrackerApi from '~/core/api/yandex-tracker.api'
import { useIssueBus } from '~/core/composables/use-issue-bus'
import { onBeforeUnmount } from 'vue'
import type { Yandex } from '~/core/types/api/yandex-tracker/yandex-tracker.entity'

const props = defineProps<{ frozenSeconds: number }>()
const modelValue = defineModel<boolean>({ default: false })
const toast = useToast()

const timerStore = useTaskTimerStore()
const { issueKey, issueSummary, isSaving, isRunning, isShared, isBlocked, uncertain, canRetry } =
  storeToRefs(timerStore)

const initialSessionId = timerStore.sessionId
const savedDraft = timerStore.draft?.timerId === initialSessionId ? timerStore.draft : null
const comment = ref(savedDraft?.comment ?? '')
const totalSeconds = ref(0)

watch(
  () => props.frozenSeconds,
  val => {
    totalSeconds.value = savedDraft?.seconds ?? val
  },
  { immediate: true }
)

const transitions = ref<Yandex.Transition[]>([])
const isLoadingTransitions = ref(false)
const withTransition = ref(savedDraft?.withTransition ?? false)
const selectedTransitionId = ref<string | undefined>(savedDraft?.transitionId ?? undefined)
const isTransitioning = ref(false)

const transitionOptions = computed(() => transitions.value.map(t => ({ label: t.to.display, value: t.id })))

const fetchTransitions = async () => {
  if (!issueKey.value) return
  transitions.value = []
  isLoadingTransitions.value = true
  try {
    transitions.value = (await yandexTrackerApi.issueTransitionsList(issueKey.value)) ?? []
    selectedTransitionId.value = transitions.value.some(t => t.id === selectedTransitionId.value)
      ? selectedTransitionId.value
      : transitions.value[0]?.id
  } catch {
    toast.add({ title: 'Не удалось загрузить доступные переходы', color: 'warning' })
  } finally {
    isLoadingTransitions.value = false
  }
}

onMounted(fetchTransitions)

const confirm = async () => {
  const savedIssueKey = issueKey.value
  await timerStore.stop(
    comment.value || undefined,
    totalSeconds.value,
    isShared.value && withTransition.value ? selectedTransitionId.value : undefined,
    initialSessionId
  )
  if (isRunning.value || !savedIssueKey) return

  if (!isShared.value && withTransition.value && selectedTransitionId.value) {
    const transition = transitions.value.find(t => t.id === selectedTransitionId.value)
    if (transition) {
      isTransitioning.value = true
      try {
        await yandexTrackerApi.issueTransitionExecute(savedIssueKey, selectedTransitionId.value)
        useIssueBus().emit({ key: savedIssueKey, status: transition.to })
      } catch {
        toast.add({
          title: 'Не удалось сменить статус',
          description: 'Выберите другой статус или смените вручную',
          color: 'error'
        })
      } finally {
        isTransitioning.value = false
      }
    }
  }

  modelValue.value = false
}

const discard = async () => {
  await timerStore.reset()
  if (!isRunning.value) modelValue.value = false
}

const persistDraft = () => {
  if (!initialSessionId || !Number.isSafeInteger(totalSeconds.value) || totalSeconds.value < 0) return
  void timerStore.saveDraft({
    timerId: initialSessionId,
    seconds: totalSeconds.value,
    comment: comment.value,
    withTransition: withTransition.value,
    transitionId: selectedTransitionId.value ?? null
  })
}
watch([totalSeconds, comment, withTransition, selectedTransitionId], persistDraft, { flush: 'sync' })
onBeforeUnmount(persistDraft)
watch(
  () => timerStore.sessionId,
  value => {
    if (value !== initialSessionId) modelValue.value = false
  }
)
</script>

<template>
  <modal-base
    v-model="modelValue"
    :prevent-close="false"
  >
    <timer-stop-form
      v-model:seconds="totalSeconds"
      v-model:comment="comment"
      v-model:with-transition="withTransition"
      v-model:transition-id="selectedTransitionId"
      :issue-key="issueKey"
      :issue-summary="issueSummary"
      :transitions="transitionOptions"
      :loading-transitions="isLoadingTransitions"
      :saving="isSaving || isTransitioning"
      :disabled="isBlocked"
      :uncertain="uncertain"
      :can-retry="canRetry"
      @confirm="confirm"
      @discard="discard"
      @reconcile="timerStore.reconcile()"
      @allow-retry="timerStore.allowRetry()"
    />
  </modal-base>
</template>
