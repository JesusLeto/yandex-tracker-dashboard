<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ru } from '@nuxt/ui/locale'
import { usePopupStore } from './store'
import { HEROICONS } from '../../app/core/constants/heroicons'
import { getHoursProgressColor } from '../../app/core/utils/progress-color'
import { formatHoursToHHMMSS, parseRuDuration, isoDurationToRu } from '../../app/core/utils/time'
import type { Yandex } from '../../app/core/types/api/yandex-tracker/yandex-tracker.entity'
import type { StopDraft } from '../../app/core/extension/protocol'
import MyIssuesCard from '../../app/core/components/issues/my-issues-card.vue'
import TimerStopForm from '../../app/core/components/timer/timer-stop-form.vue'
import WidgetProgressBar from '../../app/core/components/ui/widget-progress-bar.vue'
import hat from '../../app/assets/theme/new-year/hat.webp'

const dashboardOrigin = __DASHBOARD_ORIGIN__
const store = usePopupStore()
const {
  state,
  now,
  todayHours,
  sessionReady,
  connected,
  loading,
  busy,
  error,
  page,
  sort,
  issues,
  totalPages,
  spentHours
} = storeToRefs(store)
const dayGoal = computed(() => state.value.settings?.hoursInDay ?? 8)
const todayHoursLabel = computed(() => {
  if (todayHours.value === undefined) return ''
  if (todayHours.value === null) return 'Не удалось загрузить'
  const logged = todayHours.value.toLocaleString('ru')
  const goal = dayGoal.value ? ` / ${dayGoal.value.toLocaleString('ru')}` : ''
  return `${logged}${goal} ч`
})
const menu = ref(false),
  view = ref<'main' | 'stop' | 'start'>('main')
const organizationId = ref(''),
  pendingIssue = shallowRef<Yandex.Issue | null>(null),
  estimation = ref('')
const stopSeconds = ref(0),
  comment = ref(''),
  withTransition = ref(false),
  transitionId = ref<string>()
const transitions = ref<Yandex.Transition[]>([]),
  loadingTransitions = ref(false)
const openedTimerId = ref<string | null>(null),
  filling = ref(false)
const heading = ref<HTMLElement | null>(null)
const displayTime = computed(() =>
  formatHoursToHHMMSS(
    state.value.timer ? Math.max(0, (now.value.getTime() - Date.parse(state.value.timer.startedAt)) / 3600000) : 0
  )
)
const transitionOptions = computed(() => transitions.value.map(t => ({ label: t.to.display, value: t.id })))
const themes = {
  halloween: defineAsyncComponent(() => import('../../app/core/components/theme/theme-halloween.vue')),
  'new-year': defineAsyncComponent(() => import('../../app/core/components/theme/theme-new-year.vue')),
  'programmer-day': defineAsyncComponent(() => import('../../app/core/components/theme/theme-programmer-day.vue')),
  '8-march': defineAsyncComponent(() => import('../../app/core/components/theme/theme-8-march.vue'))
}
const seasonalComponent = computed(() =>
  state.value.settings?.seasonalTheme.active && state.value.settings.seasonalTheme.type
    ? themes[state.value.settings.seasonalTheme.type]
    : null
)

function closeView() {
  menu.value = false
  view.value = 'main'
}

function openPage(path = '/') {
  menu.value = false
  void chrome.tabs.create({ url: `${__DASHBOARD_ORIGIN__}${path}` })
}
function currentDraft(): StopDraft | null {
  if (!openedTimerId.value || !Number.isSafeInteger(stopSeconds.value) || stopSeconds.value < 0) return null
  return {
    timerId: openedTimerId.value,
    seconds: stopSeconds.value,
    comment: comment.value,
    withTransition: withTransition.value,
    transitionId: transitionId.value ?? null
  }
}
function persistDraft() {
  const draft = currentDraft()
  if (!filling.value && view.value === 'stop' && draft) void store.saveDraft(draft)
}

async function openStop() {
  const timer = state.value.timer
  if (!timer) return
  filling.value = true
  openedTimerId.value = timer.id
  const draft = state.value.draft?.timerId === timer.id ? state.value.draft : null
  stopSeconds.value = draft?.seconds ?? Math.max(0, Math.floor((Date.now() - Date.parse(timer.startedAt)) / 1000))
  comment.value = draft?.comment ?? ''
  withTransition.value = draft?.withTransition ?? false
  transitionId.value = draft?.transitionId ?? undefined
  transitions.value = []
  view.value = 'stop'
  menu.value = false
  filling.value = false
  persistDraft()
  await nextTick()
  heading.value?.focus()
  loadingTransitions.value = true
  const result = await store.run({ type: 'transitions', issueKey: timer.issueKey })
  if (openedTimerId.value === timer.id && view.value === 'stop') {
    transitions.value = result ?? []
    if (!transitions.value.some(t => t.id === transitionId.value)) transitionId.value = transitions.value[0]?.id
  }
  loadingTransitions.value = false
}

async function save() {
  const draft = currentDraft()
  if (draft) await store.run({ type: 'stop', draft })
}
async function discard() {
  if (openedTimerId.value) await store.run({ type: 'discard', timerId: openedTimerId.value })
}
async function reconcile() {
  if (openedTimerId.value) await store.run({ type: 'reconcile', timerId: openedTimerId.value })
}
async function allowRetry() {
  if (openedTimerId.value) await store.run({ type: 'allow-retry', timerId: openedTimerId.value })
}
async function start(issue: Yandex.Issue) {
  if (state.value.timer || busy.value) return
  if (issue.status.id.toLowerCase() === 'open' || issue.status.display.toLowerCase().includes('открыт')) {
    pendingIssue.value = issue
    estimation.value = issue.estimation && issue.estimation !== 'PT0S' ? isoDurationToRu(issue.estimation) : ''
    view.value = 'start'
    await nextTick()
    heading.value?.focus()
  } else await store.run({ type: 'start', issueKey: issue.key, transition: false })
}
async function confirmStart(transition: boolean) {
  if (!pendingIssue.value) return
  const result = await store.run({
    type: 'start',
    issueKey: pendingIssue.value.key,
    transition,
    estimation: estimation.value.trim() ? parseRuDuration(estimation.value) : undefined
  })
  if (result) view.value = 'main'
}

watch([stopSeconds, comment, withTransition, transitionId], persistDraft, { flush: 'sync' })
watch(
  () => state.value.timer?.id,
  id => {
    if (view.value === 'stop' && id !== openedTimerId.value) view.value = 'main'
  }
)
watch(
  () => state.value.authenticated,
  () => {
    menu.value = false
    view.value = 'main'
  }
)
</script>

<template>
  <u-app
    :locale="ru"
    :toaster="{ position: 'bottom-center' }"
  >
    <component
      :is="seasonalComponent"
      v-if="seasonalComponent && state.settings"
      :entities="state.settings.seasonalTheme.entities"
    />
    <div
      class="flex size-full flex-col overflow-hidden"
      @keydown.esc="closeView"
    >
      <header
        v-if="state.authenticated"
        class="relative shrink-0 border-b border-default p-3"
      >
        <u-button
          class="w-full justify-start gap-2 bg-primary/15 p-2 text-default"
          color="neutral"
          variant="ghost"
          aria-haspopup="menu"
          :aria-expanded="menu"
          @click="menu = !menu"
        >
          <span class="relative"
            ><u-avatar
              :src="state.profile?.avatar"
              :icon="HEROICONS.USER" /><img
              v-if="state.settings?.seasonalTheme.active && state.settings.seasonalTheme.type === 'new-year'"
              :src="hat"
              alt=""
              class="pointer-events-none absolute -top-3.5 -left-3 -scale-x-100"
          /></span>
          <span class="flex-1 truncate text-left">{{ state.profile?.name }}</span
          ><u-icon
            :name="HEROICONS.CHEVRON_DOWN"
            class="size-4"
          />
        </u-button>
        <nav
          v-if="menu"
          class="absolute top-full right-3 z-50 w-52 rounded-lg border border-default bg-elevated p-1 shadow-lg"
          role="menu"
          aria-label="Меню профиля"
        >
          <u-button
            class="w-full"
            variant="ghost"
            color="neutral"
            role="menuitem"
            :icon="HEROICONS.HOME"
            label="Открыть Dashboard"
            @click="openPage()"
          />
          <u-button
            class="w-full"
            variant="ghost"
            color="neutral"
            role="menuitem"
            :icon="HEROICONS.COG"
            label="Настройки"
            @click="openPage('/settings')"
          />
          <u-separator class="my-1" /><u-button
            class="w-full"
            variant="ghost"
            color="error"
            role="menuitem"
            :icon="HEROICONS.ARROW_RIGHT_START_ON_RECTANGLE"
            label="Выйти"
            @click="store.signOut()"
          />
        </nav>
      </header>
      <u-alert
        v-if="error"
        class="m-3 shrink-0"
        color="error"
        :description="error"
        :close="true"
        @close="error = ''"
      />
      <u-alert
        v-if="state.notice"
        class="m-3 shrink-0"
        color="warning"
        :description="state.notice"
      />
      <u-alert
        v-if="!connected"
        class="m-3 shrink-0"
        color="warning"
        description="Связь с расширением потеряна. Переподключаемся…"
      />
      <div
        v-if="!sessionReady"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
        role="status"
        :aria-busy="busy"
      >
        <template v-if="busy">
          <u-icon
            :name="HEROICONS.ARROW_PATH"
            class="size-6 animate-spin text-muted"
          />
          <p class="text-sm text-muted">Восстанавливаем сессию…</p>
        </template>
        <u-button
          v-else
          label="Повторить"
          :loading="busy"
          :disabled="!connected"
          @click="store.run({ type: 'state' })"
        />
      </div>
      <div
        v-else-if="!state.authenticated"
        class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-6 text-center"
      >
        <h1 class="text-lg font-semibold">Yandex Tracker Dashboard</h1>
        <p class="text-sm text-muted">Войдите через Яндекс, чтобы видеть свои задачи и управлять таймером.</p>
        <u-form-field
          label="ID организации"
          hint="Можно оставить пустым после связи с Dashboard"
          class="w-full text-left"
          ><u-input
            v-model="organizationId"
            class="w-full"
            autocomplete="off"
        /></u-form-field>
        <u-button
          color="error"
          label="Войти через Яндекс"
          :loading="busy"
          :disabled="!connected"
          @click="store.authenticate(organizationId.trim() || undefined)"
        />
        <u-button
          variant="link"
          color="neutral"
          label="Открыть Dashboard"
          @click="openPage()"
        />
      </div>
      <template v-else-if="view === 'main'">
        <div class="shrink-0 space-y-1 px-4 pt-3">
          <div class="flex justify-between gap-2 text-xs text-muted">
            <span>Списано сегодня</span>
            <span
              class="tabular-nums"
              role="status"
            >
              <span :class="{ 'sr-only': !todayHoursLabel }">{{ todayHoursLabel || 'Загрузка' }}</span>
            </span>
          </div>
          <widget-progress-bar
            v-if="dayGoal && todayHours !== null"
            :value="todayHours === undefined ? null : Math.min(todayHours, dayGoal)"
            :max="dayGoal"
            :loading="todayHours === undefined"
            :color="getHoursProgressColor(todayHours ?? 0, dayGoal)"
            aria-hidden="true"
          />
        </div>
        <div class="flex shrink-0 items-center justify-between gap-2 p-4">
          <u-badge
            v-if="state.timer"
            variant="subtle"
            color="neutral"
            size="lg"
            class="flex items-center"
            ><span class="size-2 rounded-full bg-error" /><span class="font-mono text-sm tabular-nums">{{
              displayTime
            }}</span
            ><span class="text-xs">{{ state.timer.issueKey }}</span></u-badge
          >
          <p
            v-else
            class="text-sm text-muted italic"
          >
            Трекер простаивает
          </p>
          <u-button
            v-if="state.timer"
            :icon="HEROICONS.STOP_CIRCLE"
            variant="ghost"
            color="error"
            square
            aria-label="Остановить таймер"
            :disabled="!connected || busy"
            @click="openStop"
          />
        </div>
        <div class="flex min-h-0 flex-1 flex-col px-2.5 pb-2.5">
          <my-issues-card
            v-if="state.settings"
            v-model:sort-mode="sort"
            fill
            :issues="issues"
            :loading="loading"
            :page="page"
            :total-pages="totalPages"
            :display="state.settings.myIssues.display"
            :time-zone="state.settings.timeZone"
            :spent-hours="spentHours"
            :running="!!state.timer"
            :active-issue-key="state.timer?.issueKey ?? null"
            :busy="busy || !connected"
            :all-to="`${dashboardOrigin}/my-issues`"
            @previous="page--"
            @next="page++"
            @refresh="store.refresh()"
            @start="start"
          />
          <div
            v-else
            class="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center"
          >
            <p class="text-sm text-muted">Откройте Dashboard, чтобы получить тему и настройки «Моих задач».</p>
            <u-button
              label="Открыть Dashboard"
              @click="openPage()"
            />
          </div>
        </div>
      </template>
      <div
        v-else-if="view === 'stop' && state.timer"
        class="min-h-0 flex-1 overflow-y-auto p-3"
      >
        <h2
          ref="heading"
          tabindex="-1"
          class="sr-only"
        >
          Форма остановки таймера
        </h2>
        <timer-stop-form
          v-model:seconds="stopSeconds"
          v-model:comment="comment"
          v-model:with-transition="withTransition"
          v-model:transition-id="transitionId"
          compact
          closable
          :issue-key="state.timer.issueKey"
          :issue-summary="state.timer.issueSummary"
          :transitions="transitionOptions"
          :loading-transitions="loadingTransitions"
          :saving="busy"
          :disabled="!connected"
          :uncertain="state.uncertain"
          :can-retry="state.canRetry"
          @close="view = 'main'"
          @confirm="save"
          @discard="discard"
          @reconcile="reconcile"
          @allow-retry="allowRetry"
        />
      </div>
      <div
        v-else-if="view === 'start'"
        class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3"
      >
        <div class="flex items-center justify-between">
          <h2
            ref="heading"
            tabindex="-1"
            class="text-lg font-semibold"
          >
            Перевести задачу в работу?
          </h2>
          <u-button
            :icon="HEROICONS.X_MARK"
            variant="ghost"
            square
            aria-label="Закрыть"
            @click="view = 'main'"
          />
        </div>
        <p class="text-xs text-primary">{{ pendingIssue?.key }}</p>
        <p class="text-sm">{{ pendingIssue?.summary }}</p>
        <p class="text-sm">Задача сейчас открыта. Перевести в «В работе» и запустить таймер?</p>
        <u-form-field
          label="Временная оценка"
          hint="Необязательно. Формат: 1д2ч30м"
          ><u-input
            v-model="estimation"
            class="w-full"
            placeholder="например: 1д2ч30м"
        /></u-form-field>
        <u-button
          label="Перевести и запустить"
          :loading="busy"
          :disabled="!connected"
          @click="confirmStart(true)"
        />
        <u-button
          label="Просто запустить"
          variant="subtle"
          :disabled="busy || !connected"
          @click="confirmStart(false)"
        />
      </div>
    </div>
  </u-app>
</template>
