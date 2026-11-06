<script setup lang="ts">
defineProps<{
  label: string
  min?: number
  max?: number
}>()

const modelValue = defineModel<number>({ default: 0 })
</script>

<template>
  <div class="flex flex-1 flex-col items-center gap-0.5">
    <u-input
      v-model.number="modelValue"
      type="number"
      :aria-label="label"
      :min="min"
      :max="max"
      :ui="{ base: 'text-center font-mono text-xl font-bold tabular-nums' }"
      class="w-full"
    />
    <span class="text-xs text-toned uppercase">{{ label }}</span>
  </div>
</template>
