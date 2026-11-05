<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'
import type { Yandex } from '~/core/types/api/yandex-tracker/yandex-tracker.entity'
import type { IssueDisplay } from '~/core/types/issues'
import type { IssuesSortMode } from '~/core/utils/my-issues'
import { MY_ISSUES_SORT_OPTIONS } from '~/modules/dashboard/models/constants/my-issues-sort'
import { HEROICONS } from '~/core/constants/heroicons'
import UiCard from '../ui/ui-card.vue'
import UiEmptyState from '../ui/ui-empty-state.vue'
import IssueRow from './issue-row.vue'
import IssuePlayButton from './issue-play-button.vue'

defineProps<{
  issues: Yandex.Issue[]
  loading: boolean
  page: number
  totalPages: number
  display: IssueDisplay
  timeZone: string
  spentHours: Map<string, number>
  activeIssueKey: string | null
  running: boolean
  busy?: boolean
  allTo: RouteLocationRaw
  fill?: boolean
}>()
const sortMode = defineModel<IssuesSortMode>('sortMode', { required: true })
defineEmits<{ refresh: []; previous: []; next: []; start: [issue: Yandex.Issue] }>()
</script>
<template>
  <ui-card
    title="Мои задачи"
    :fill="fill"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <u-select
          v-model="sortMode"
          :items="MY_ISSUES_SORT_OPTIONS"
          value-key="value"
          label-key="label"
          size="xs"
          class="w-36 shrink-0"
          aria-label="Сортировка задач"
        />
        <u-link
          :to="allTo"
          class="text-xs text-primary hover:underline"
          >Все</u-link
        >
      </div>
    </template>
    <div
      v-if="loading"
      class="flex flex-col gap-2"
    >
      <u-skeleton
        v-for="i in 5"
        :key="i"
        class="h-18 w-full rounded-lg"
      />
    </div>
    <ui-empty-state
      v-else-if="issues.length === 0"
      title="Нет активных задач"
    />
    <div
      v-else
      class="flex min-h-0 flex-col divide-y divide-default overflow-y-auto"
    >
      <issue-row
        v-for="issue in issues"
        :key="issue.key"
        :issue="issue"
        :display="display"
        :time-zone="timeZone"
        :spent-hours="spentHours.get(issue.key) ?? null"
        :active="running && activeIssueKey === issue.key"
      >
        <template #action
          ><issue-play-button
            :running="running"
            :active="running && activeIssueKey === issue.key"
            :busy="busy"
            @start="$emit('start', issue)"
        /></template>
      </issue-row>
    </div>
    <template #footer>
      <div class="flex items-center justify-between">
        <div
          v-if="totalPages > 1"
          class="flex items-center gap-1"
        >
          <u-button
            :icon="HEROICONS.ARROW_LEFT"
            variant="ghost"
            size="xs"
            square
            aria-label="Предыдущая страница"
            :disabled="page === 1"
            @click="$emit('previous')"
          />
          <span class="text-xs text-muted">{{ page }} / {{ totalPages }}</span>
          <u-button
            :icon="HEROICONS.ARROW_RIGHT"
            variant="ghost"
            size="xs"
            square
            aria-label="Следующая страница"
            :disabled="page >= totalPages"
            @click="$emit('next')"
          />
        </div>
        <u-tooltip text="Обновить"
          ><u-button
            :icon="HEROICONS.ARROW_PATH"
            aria-label="Обновить задачи"
            :loading="loading"
            class="ml-auto"
            @click="$emit('refresh')"
        /></u-tooltip>
      </div>
    </template>
  </ui-card>
</template>
