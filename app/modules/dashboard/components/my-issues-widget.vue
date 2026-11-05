<script setup lang="ts">
import { useMyIssuesWidgetStore } from '../store/use-my-issues-widget-store'
import MyIssuesCard from '~/core/components/issues/my-issues-card.vue'
import { useSiteSettingsStore } from '~/modules/settings/store/use-site-settings-store'
import { useTaskTimerStore } from '~/core/store/use-task-timer-store'
import { useDateFormatter } from '~/core/composables/use-date-formatter'
import { useIssueTransitionModal } from '~/core/composables/use-issue-transition-modal'
import { SITEMAP } from '~/core/utils/router/sitemap'

const store = useMyIssuesWidgetStore()
const { issues, issueSpentHoursMap, isLoading, page, totalPages, sortMode } = storeToRefs(store)
const { myIssues } = storeToRefs(useSiteSettingsStore())
const { isRunning, issueKey, isSaving, isBlocked } = storeToRefs(useTaskTimerStore())
const { tz } = useDateFormatter()
const { startWithConfirm } = useIssueTransitionModal()
</script>
<template>
  <my-issues-card
    v-model:sort-mode="sortMode"
    :issues="issues"
    :loading="isLoading"
    :page="page"
    :total-pages="totalPages"
    :display="myIssues.display"
    :spent-hours="issueSpentHoursMap"
    :time-zone="tz"
    :running="isRunning"
    :active-issue-key="issueKey"
    :busy="isSaving || isBlocked"
    :all-to="{ name: SITEMAP.myIssues.route.name }"
    @previous="page--"
    @next="page++"
    @refresh="store.refresh()"
    @start="startWithConfirm"
  />
</template>
