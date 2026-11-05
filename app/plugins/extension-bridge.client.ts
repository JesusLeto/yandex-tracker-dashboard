import { watch } from 'vue'
import { storeToRefs } from 'pinia'
import extensionConfig from '../../extension/config.json'
import { createExtensionClient, type ExtensionPort, type ExtensionSettings } from '../core/extension/protocol'
import { useSiteSettingsStore } from '../modules/settings/store/use-site-settings-store'
import { useAuthStore } from '../core/store/use-auth-store'
import { useExtensionBridgeStore } from '../core/store/use-extension-bridge-store'
import { useDateFormatter } from '../core/composables/use-date-formatter'
import yandexTrackerApi from '../core/api/yandex-tracker.api'

interface WebChrome {
  runtime?: { connect(id: string, options: { name: string }): ExtensionPort; lastError?: unknown }
}

export default defineNuxtPlugin({
  name: 'extension-bridge',
  enforce: 'post',
  setup(nuxtApp) {
    if (location.origin !== extensionConfig.dashboardOrigin) return
    const bridge = useExtensionBridgeStore()
    const settings = useSiteSettingsStore()
    const { accessToken, organizationId } = storeToRefs(settings)
    const { mySelf } = storeToRefs(useAuthStore())
    const { tz } = useDateFormatter()
    const colorMode = useColorMode()
    let generation = 0,
      client: ReturnType<typeof createExtensionClient> | null = null
    let reconnect: ReturnType<typeof setTimeout> | undefined
    let verifiedOwner: string | null = null

    const snapshot = (): ExtensionSettings => ({
      myIssues: {
        statuses: [...settings.myIssues.statuses],
        roles: { ...settings.myIssues.roles },
        display: { ...settings.myIssues.display }
      },
      timeZone: tz.value,
      hoursInDay: settings.hoursInDay,
      colorMode: colorMode.value === 'light' ? 'light' : 'dark',
      seasonalTheme: {
        type: settings.themeType,
        active: settings.seasonalThemeActive,
        entities: { ...settings.themeEntities }
      }
    })

    async function connect(clear = false) {
      const current = ++generation
      clearTimeout(reconnect)
      client?.disconnect()
      client = null
      bridge.attach(null, clear)
      if (clear) verifiedOwner = null
      if (!accessToken.value || !organizationId.value || !mySelf.value) return
      if (bridge.engaged && !verifiedOwner) {
        try {
          const user = await yandexTrackerApi.mySelf()
          if (current !== generation) return
          verifiedOwner = `${user.uid}:${organizationId.value}`
          bridge.restoreMirror(verifiedOwner)
        } catch {
          if (current === generation) reconnect = setTimeout(connect, 5000)
          return
        }
      }
      const runtime = (window as Window & { chrome?: WebChrome }).chrome?.runtime
      if (!runtime) {
        reconnect = setTimeout(connect, 5000)
        return
      }
      try {
        const port = runtime.connect(extensionConfig.extensionId, { name: 'dashboard' })
        client = createExtensionClient(
          port,
          state => {
            if (current === generation) {
              verifiedOwner = state.owner
              bridge.receive(state)
            }
          },
          () => {
            void runtime.lastError
            if (current !== generation) return
            bridge.attach(null)
            reconnect = setTimeout(connect, 3000)
          }
        )
        const activeClient = client
        bridge.attach(activeClient)
        void activeClient
          .request({
            type: 'hello',
            token: accessToken.value,
            organizationId: organizationId.value,
            settings: snapshot()
          })
          .then(state => {
            if (current === generation) {
              verifiedOwner = state.owner
              bridge.receive(state)
            }
          })
          .catch(() => {
            if (current === generation) {
              bridge.attach(null)
              activeClient.disconnect()
            }
          })
      } catch {
        if (current === generation) reconnect = setTimeout(connect, 5000)
      }
    }

    const stopAuth = watch(
      [accessToken, organizationId, () => mySelf.value?.uid],
      () => {
        void connect(true)
      },
      { immediate: true, flush: 'sync' }
    )
    const stopSettings = watch(
      snapshot,
      value => {
        if (client && bridge.connected) void client.request({ type: 'settings', settings: value }).catch(() => {})
      },
      { deep: true }
    )
    const cleanup = () => {
      generation++
      stopAuth()
      stopSettings()
      clearTimeout(reconnect)
      client?.disconnect()
    }
    nuxtApp.vueApp.onUnmount(cleanup)
    if (import.meta.hot) import.meta.hot.dispose(cleanup)
  }
})
