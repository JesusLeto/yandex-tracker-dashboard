<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutationObserver } from '@vueuse/core'
const props = defineProps<{
  light: [string, string, string]
  dark: [string, string, string]
}>()

const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
useMutationObserver(
  () => (typeof document === 'undefined' ? null : document.documentElement),
  () => {
    isDark.value = document.documentElement.classList.contains('dark')
  },
  { attributes: true, attributeFilter: ['class'] }
)
const colors = computed(() => (isDark.value ? props.dark : props.light))

const backgroundImage = computed(
  () =>
    `radial-gradient(ellipse 60% 42% at 0% 0%, ${colors.value[0]}, transparent 70%), ` +
    `radial-gradient(ellipse 60% 42% at 100% 0%, ${colors.value[1]}, transparent 70%), ` +
    `radial-gradient(ellipse 70% 52% at 50% 100%, ${colors.value[2]}, transparent 70%)`
)
</script>

<template>
  <div
    class="absolute inset-0"
    :style="{ backgroundImage }"
  />
</template>
