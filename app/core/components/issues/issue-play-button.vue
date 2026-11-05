<script setup lang="ts">
import { computed } from 'vue'
import { HEROICONS } from '~/core/constants/heroicons'
const props = defineProps<{ running: boolean; active: boolean; busy?: boolean }>()
defineEmits<{ start: [] }>()
const label = computed(() => (props.active ? 'Уже отслеживается' : 'Начать таймер'))
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
      :disabled="running || busy"
      class="size-fit hover:bg-neutral-500"
      :color="active ? 'success' : 'neutral'"
      @click="$emit('start')"
    />
  </u-tooltip>
</template>
