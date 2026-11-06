<script setup lang="ts">
import { useTaskTimerStore } from '~/core/store/use-task-timer-store'
import { useIssueTransitionModal } from '~/core/composables/use-issue-transition-modal'
import { HEROICONS } from '~/core/constants/heroicons'
import type { Yandex } from '~/core/types/api/yandex-tracker/yandex-tracker.entity'

const props = defineProps<{ issue: Yandex.Issue }>()

const { isRunning, isBlocked, isSaving, issueKey: activeIssueKey } = storeToRefs(useTaskTimerStore())
const { startWithConfirm } = useIssueTransitionModal()

const isTrackingThisIssue = computed(() => activeIssueKey.value === props.issue.key && isRunning.value)
const label = computed(() => (isTrackingThisIssue.value ? 'Уже отслеживается' : 'Начать таймер'))

const handleStart = () => startWithConfirm(props.issue)
</script>

<template>
  <u-tooltip
    :text="label"
    :delay-duration="0"
  >
    <u-button
      :icon="HEROICONS.PLAY_CIRCLE"
      variant="ghost"
      size="sm"
      square
      :aria-label="label"
      :disabled="isRunning || isBlocked || isSaving"
      class="size-fit"
      :color="isTrackingThisIssue ? 'success' : 'neutral'"
      @click="handleStart"
    />
  </u-tooltip>
</template>
