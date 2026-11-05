<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import type { Yandex } from '~/core/types/api/yandex-tracker/yandex-tracker.entity'
import type { IssueDisplay } from '~/core/types/issues'
import { useTaskTimerStore } from '~/core/store/use-task-timer-store'
import { useDateFormatter } from '~/core/composables/use-date-formatter'
import IssueRow from './issue-row.vue'

const props = defineProps<{
  issue: Yandex.Issue
  highlightQuery?: string
  spentHours?: number | null
  display?: IssueDisplay
}>()
const { isRunning, issueKey } = storeToRefs(useTaskTimerStore())
const active = computed(() => isRunning.value && issueKey.value === props.issue.key)
const { tz } = useDateFormatter()
</script>
<template>
  <issue-row
    v-bind="props"
    :active="active"
    :time-zone="tz"
  >
    <template #action><slot name="action" /></template>
  </issue-row>
</template>
