<script setup lang="ts">
import type { Yandex } from '~/core/types/api/yandex-tracker/yandex-tracker.entity'
import { getPriorityWeight, getStatusColor } from '~/core/utils/my-issues'
import { highlightText } from '~/core/utils/text'
import { HEROICONS } from '~/core/constants/heroicons'
import { computed } from 'vue'
import type { IssueDisplay } from '~/core/types/issues'
import { isoDurationToRu, formatHoursToFixed, calculateDurationInHours, parseDateOnly } from '~/core/utils/time'
import { formatInTimeZone } from 'date-fns-tz'
import { useNow } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    issue: Yandex.Issue
    highlightQuery?: string
    spentHours?: number | null
    display?: IssueDisplay
    active?: boolean
    timeZone?: string
  }>(),
  {
    highlightQuery: '',
    active: false,
    timeZone: 'Europe/Moscow',
    spentHours: undefined,
    display: () => ({
      priority: true,
      status: true,
      assignee: false,
      reviewer: false,
      qaEngineer: false,
      estimation: false,
      deadline: false
    })
  }
)

const hasEstimation = computed(() => props.issue.estimation && props.issue.estimation !== 'PT0S')

const estimationText = computed(() => (hasEstimation.value ? isoDurationToRu(props.issue.estimation!) : ''))
const estimationHours = computed(() => (hasEstimation.value ? calculateDurationInHours(props.issue.estimation!) : 0))

const isOverEstimation = computed(() => props.spentHours != null && props.spentHours > estimationHours.value)

/** Оценка — одна строка "факт/оценка", без факта — просто оценка */
const estimationLabel = computed(() => {
  if (props.spentHours === undefined) return estimationText.value
  if (props.spentHours === null) return null
  return `${formatHoursToFixed(props.spentHours)}/${estimationHours.value}ч`
})

const estimationBadgeColor = computed(() => {
  if (!props.spentHours) return 'neutral' as const
  return isOverEstimation.value ? ('error' as const) : ('success' as const)
})

const formatShortDate = (date: Date) =>
  Number.isFinite(date.getTime()) ? formatInTimeZone(date, props.timeZone, 'dd.MM.yyyy') : ''
const formatDayKey = (date: Date) => formatInTimeZone(date, props.timeZone, 'yyyy-MM-dd')
const now = useNow()

const hasDeadline = computed(() => Boolean(props.issue.deadline))
const deadlineText = computed(() => (hasDeadline.value ? formatShortDate(parseDateOnly(props.issue.deadline!)) : ''))
const isDeadlineOverdue = computed(
  () => hasDeadline.value && props.issue.deadline!.slice(0, 10) < formatDayKey(now.value)
)
const isDeadlineToday = computed(
  () => hasDeadline.value && props.issue.deadline!.slice(0, 10) === formatDayKey(now.value)
)

const highlightedKey = computed(() => highlightText(props.issue.key, props.highlightQuery))
const highlightedSummary = computed(() => highlightText(props.issue.summary, props.highlightQuery))

interface ChevronConfig {
  icon: string
  color: string
  count: number
  tooltip: string
}

const chevrons = computed((): ChevronConfig => {
  const w = getPriorityWeight(props.issue)
  const label = props.issue.priority?.display ?? ''
  if (w === 0) return { icon: HEROICONS.CHEVRON_DOUBLE_UP, color: 'text-error', count: 3, tooltip: label }
  if (w === 1) return { icon: HEROICONS.CHEVRON_UP_20_SOLID, color: 'text-warning', count: 2, tooltip: label }
  if (w === 2) return { icon: HEROICONS.CHEVRON_UP_20_SOLID, color: 'text-info', count: 1, tooltip: label }
  return { icon: HEROICONS.CHEVRON_DOWN, color: 'text-muted', count: 1, tooltip: label }
})

const isActiveIssue = computed(() => props.active)

const statusColor = computed(() => getStatusColor(props.issue.status))

const hasMeta = computed(
  () =>
    (props.display.assignee && props.issue.assignee) ||
    (props.display.reviewer && props.issue.reviewer) ||
    (props.display.qaEngineer && props.issue.qaEngineer)
)
</script>

<template>
  <div
    class="flex justify-between gap-3 py-2 pr-1.5 pl-2 transition-colors"
    :class="{
      'bg-primary/8 ring-primary': isActiveIssue
    }"
  >
    <div class="flex min-w-0 flex-1 flex-col items-start">
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-1.5">
          <u-tooltip
            v-if="display.priority !== false"
            :text="chevrons.tooltip"
            :delay-duration="200"
          >
            <span class="inline-flex cursor-help items-center">
              <u-icon
                v-for="n in chevrons.count"
                :key="n"
                :name="chevrons.icon"
                :class="['-mx-0.5 size-3.5', chevrons.color]"
              />
            </span>
          </u-tooltip>

          <u-tooltip
            v-if="isActiveIssue"
            text="Активная задача"
            :delay-duration="200"
          >
            <span class="relative inline-flex size-2 shrink-0 cursor-help">
              <span class="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              <span class="relative inline-flex size-2 rounded-full bg-success" />
            </span>
          </u-tooltip>

          <u-link
            :to="`https://tracker.yandex.ru/${issue.key}`"
            target="_blank"
            class="font-mono text-xs text-primary hover:underline"
          >
            <span v-html="highlightedKey" />
          </u-link>

          <u-badge
            v-if="display.status !== false"
            :label="issue.status.display"
            :color="statusColor"
            variant="subtle"
            size="sm"
          />
        </div>

        <div
          v-if="(display.deadline && hasDeadline) || (display.estimation && hasEstimation)"
          class="flex shrink-0 items-center gap-1.5"
        >
          <u-tooltip
            v-if="display.deadline && hasDeadline"
            text="Дедлайн"
            :delay-duration="300"
          >
            <u-badge
              :icon="HEROICONS.CALENDAR"
              :label="deadlineText"
              :color="isDeadlineOverdue ? 'error' : isDeadlineToday ? 'warning' : 'neutral'"
              variant="subtle"
              size="sm"
            />
          </u-tooltip>

          <template v-if="display.estimation && hasEstimation">
            <u-skeleton
              v-if="spentHours === null"
              class="h-5 w-14"
            />
            <u-tooltip
              v-else
              :text="spentHours !== undefined ? 'Факт / оценка' : 'Оценка задачи'"
              :delay-duration="300"
            >
              <u-badge
                :icon="HEROICONS.CLOCK"
                :label="estimationLabel!"
                :color="estimationBadgeColor"
                variant="subtle"
                size="sm"
              />
            </u-tooltip>
          </template>
        </div>
      </div>

      <div
        class="mt-0.5 line-clamp-2 max-w-full truncate text-left text-sm text-wrap"
        v-html="highlightedSummary"
      />

      <div
        v-if="hasMeta"
        class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted"
      >
        <span v-if="display.assignee && issue.assignee">
          <span class="text-toned">Исп:</span> {{ issue.assignee.display }}
        </span>
        <span v-if="display.reviewer && issue.reviewer">
          <span class="text-toned">Ревью:</span> {{ issue.reviewer.display }}
        </span>
        <span v-if="display.qaEngineer && issue.qaEngineer">
          <span class="text-toned">QA:</span> {{ issue.qaEngineer.display }}
        </span>
      </div>
    </div>

    <slot name="action" />
  </div>
</template>
