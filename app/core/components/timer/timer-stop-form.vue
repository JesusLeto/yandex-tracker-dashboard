<script setup lang="ts">
import { useId } from 'vue'
import { HEROICONS } from '~/core/constants/heroicons'
import UiCard from '../ui/ui-card.vue'
import UiDurationInput from '../ui/form/ui-duration-input.vue'

defineProps<{
  issueKey: string | null
  issueSummary: string | null
  transitions: { label: string; value: string }[]
  loadingTransitions: boolean
  saving: boolean
  compact?: boolean
  closable?: boolean
  uncertain?: boolean
  canRetry?: boolean
  disabled?: boolean
}>()
const totalSeconds = defineModel<number>('seconds', { required: true })
const comment = defineModel<string>('comment', { default: '' })
const withTransition = defineModel<boolean>('withTransition', { default: false })
const transitionId = defineModel<string>('transitionId')
defineEmits<{ confirm: []; discard: []; close: []; reconcile: []; allowRetry: [] }>()
const formId = useId(),
  commentId = `${formId}-comment`
</script>
<template>
  <ui-card class="w-full">
    <template #header>
      <div class="flex w-full items-center justify-between gap-2">
        <h2 class="text-lg font-semibold">Остановить таймер</h2>
        <u-button
          v-if="closable"
          :icon="HEROICONS.X_MARK"
          variant="ghost"
          color="neutral"
          square
          aria-label="Закрыть форму"
          @click="$emit('close')"
        />
      </div>
    </template>
    <form
      :id="formId"
      class="flex flex-col gap-4"
      @submit.prevent="$emit('confirm')"
    >
      <u-badge
        variant="subtle"
        color="neutral"
        class="flex flex-col items-start rounded-lg px-4 py-3"
      >
        <div class="font-mono text-xs text-primary">{{ issueKey }}</div>
        <div class="mt-0.5 text-sm">{{ issueSummary }}</div>
        <ui-duration-input
          v-model="totalSeconds"
          class="mt-3"
        />
      </u-badge>
      <div class="flex flex-col gap-1">
        <label
          :for="commentId"
          class="text-sm text-muted"
          >Комментарий <span class="text-dimmed">(необязательно)</span></label
        >
        <u-textarea
          :id="commentId"
          v-model="comment"
          :rows="compact ? 3 : 4"
          placeholder="Что делали?"
        />
      </div>
      <div class="flex flex-col gap-2">
        <label class="flex items-center justify-between gap-4">
          <span class="text-sm">Перевести задачу в другой статус</span>
          <u-switch
            v-model="withTransition"
            :disabled="!transitions.length || uncertain"
            :loading="loadingTransitions"
            :checked-icon="HEROICONS.CHECK_20_SOLID"
            :unchecked-icon="HEROICONS.X_MARK_20_SOLID"
            aria-label="Сменить статус после сохранения"
          />
        </label>
        <u-select
          v-if="withTransition"
          v-model="transitionId"
          :items="transitions"
          value-key="value"
          label-key="label"
          aria-label="Новый статус задачи"
        />
      </div>
      <u-alert
        v-if="uncertain"
        color="warning"
        title="Результат сохранения неизвестен"
        description="Таймер и форма сохранены. Проверьте трудозатраты перед повторной записью."
      />
      <div
        v-if="canRetry"
        class="flex flex-col items-start gap-2 text-xs text-muted"
      >
        <p>Запись не найдена. Перед повторной попыткой проверьте трудозатраты задачи в Tracker.</p>
        <u-link
          :to="`https://tracker.yandex.ru/${issueKey}`"
          target="_blank"
          rel="noopener"
          >Открыть задачу в Tracker</u-link
        >
        <u-button
          variant="subtle"
          color="warning"
          label="Я проверил: записи нет"
          :disabled="saving || disabled"
          @click="$emit('allowRetry')"
        />
      </div>
    </form>
    <template #footer>
      <div
        class="flex gap-2"
        :class="compact ? 'flex-row items-center' : 'flex-col-reverse sm:flex-row sm:items-center sm:justify-between'"
      >
        <u-button
          variant="ghost"
          color="neutral"
          label="Отменить без сохранения"
          :disabled="saving || uncertain || disabled"
          :class="compact ? 'flex-1 justify-center text-xs whitespace-normal' : 'w-fit max-sm:ml-auto sm:w-auto'"
          @click="$emit('discard')"
        />
        <u-button
          v-if="uncertain"
          :loading="saving"
          :disabled="disabled"
          color="warning"
          label="Проверить сохранение"
          :class="compact ? 'flex-1 justify-center text-xs whitespace-normal' : ''"
          @click="$emit('reconcile')"
        />
        <u-button
          v-else
          type="submit"
          :form="formId"
          :loading="saving"
          :disabled="disabled"
          color="error"
          label="Сохранить и остановить"
          :class="compact ? 'flex-1 justify-center text-xs whitespace-normal' : 'w-fit max-sm:ml-auto sm:w-auto'"
        />
      </div>
    </template>
  </ui-card>
</template>
