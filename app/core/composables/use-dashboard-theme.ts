import { createSharedComposable, useLocalStorage } from '@vueuse/core'
import { storageKey } from '~/core/constants/storage-keys'

const PALETTES = [
  { value: 'onyx', label: 'Оникс', mode: 'dark' },
  { value: 'taiga', label: 'Тайга', mode: 'dark' },
  { value: 'amber', label: 'Янтарь', mode: 'dark' },
  { value: 'lamp', label: 'Лампа', mode: 'dark' },
  { value: 'graphite', label: 'Графит', mode: 'dark' },
  { value: 'github-dark', label: 'GitHub Dark', mode: 'dark' },
  { value: 'github-dimmed', label: 'GitHub Dimmed', mode: 'dark' },
  { value: 'one-dark', label: 'One Dark', mode: 'dark' },
  { value: 'tokyo-night', label: 'Tokyo Night', mode: 'dark' },
  { value: 'gruvbox', label: 'Gruvbox', mode: 'dark' },
  { value: 'nord', label: 'Nord', mode: 'dark' },
  { value: 'white', label: 'Белая', mode: 'light' }
] as const

export const useDashboardTheme = createSharedComposable(() => {
  const colorMode = useColorMode()
  const { ui } = useAppConfig()
  const savedPalette = useLocalStorage(storageKey('dashboard-palette'), '', {
    writeDefaults: false,
    listenToStorageChanges: false
  })

  const options = [
    { value: 'system' as const, label: 'Системная', icon: ui.icons.system },
    { value: 'light' as const, label: 'Светлая', icon: ui.icons.light },
    { value: 'dark' as const, label: 'Тёмная', icon: ui.icons.dark },
    ...PALETTES.map(option => ({ ...option, icon: 'i-lucide-palette' }))
  ]

  const palette = computed(() => {
    if (colorMode.forced) return
    return PALETTES.find(option => option.value === savedPalette.value && option.mode === colorMode.preference)?.value
  })

  const preference = computed({
    get: () => palette.value ?? options.find(option => option.value === colorMode.preference)?.value ?? 'system',
    set(value: (typeof options)[number]['value']) {
      const nextPalette = PALETTES.find(option => option.value === value)
      savedPalette.value = nextPalette?.value ?? ''
      colorMode.preference = nextPalette?.mode ?? value
    }
  })

  return { options, preference, palette, colorMode }
})
