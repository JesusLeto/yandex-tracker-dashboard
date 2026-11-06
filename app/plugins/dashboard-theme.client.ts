import { useDashboardTheme } from '~/core/composables/use-dashboard-theme'

export default defineNuxtPlugin(() => {
  const { palette } = useDashboardTheme()
  useHead(() => ({ htmlAttrs: { 'data-dashboard-theme': palette.value } }))
})
