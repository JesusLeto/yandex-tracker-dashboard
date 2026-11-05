import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import heroicons from '@iconify-json/heroicons/icons.json' with { type: 'json' }
import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' }
import config from './config.json'
import { uiConfig } from '../app/core/constants/ui-config'
import { HEROICONS } from '../app/core/constants/heroicons'

const root = fileURLToPath(new URL('.', import.meta.url))
const lucideNames = [
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'arrow-up',
  'arrow-up-right',
  'check',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'chevron-up',
  'chevrons-left',
  'chevrons-right',
  'chevrons-up-down',
  'circle-alert',
  'circle-check',
  'circle-x',
  'copy',
  'copy-check',
  'ellipsis',
  'external-link',
  'eye',
  'eye-off',
  'file',
  'folder',
  'folder-open',
  'grip-vertical',
  'hash',
  'info',
  'lightbulb',
  'loader-circle',
  'menu',
  'minus',
  'monitor',
  'moon',
  'panel-left-close',
  'panel-left-open',
  'plus',
  'rotate-ccw',
  'search',
  'square',
  'sun',
  'triangle-alert',
  'upload',
  'user',
  'x'
]

function collection<T>(icons: Record<string, T>, names: string[]) {
  return Object.fromEntries(names.filter(name => name in icons).map(name => [name, icons[name]]))
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const origin = new URL(config.dashboardOrigin).origin
  const manifest = {
    manifest_version: 3,
    name: 'Yandex Tracker Dashboard',
    version: '1.0.0',
    description: 'Задачи и общий с Dashboard таймер под рукой.',
    key: config.manifestKey,
    minimum_chrome_version: '120',
    permissions: ['identity', 'storage'],
    host_permissions: [`${origin}/*`, 'https://oauth.yandex.ru/*'],
    externally_connectable: { matches: [`${origin}/*`] },
    background: { service_worker: 'background.js', type: 'module' },
    action: { default_popup: 'popup.html', default_icon: 'icon.png' },
    icons: { 96: 'icon.png' },
    content_security_policy: {
      extension_pages: `script-src 'self'; object-src 'none'; connect-src 'self' ${origin} https://oauth.yandex.ru; img-src 'self' data: blob:`
    }
  }
  return {
    root,
    publicDir: false,
    base: './',
    plugins: [
      vue(),
      ui({ ui: uiConfig, router: false, colorMode: false, dts: false }),
      {
        name: 'extension-manifest',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(manifest, null, 2) })
          this.emitFile({
            type: 'asset',
            fileName: 'icon.png',
            source: readFileSync(new URL('../public/favicon-96x96.png', import.meta.url))
          })
        }
      }
    ],
    resolve: { alias: { '~': fileURLToPath(new URL('../app', import.meta.url)) } },
    define: {
      __DASHBOARD_ORIGIN__: JSON.stringify(origin),
      __YANDEX_CLIENT_ID__: JSON.stringify(env.EXTENSION_YANDEX_CLIENT_ID || env.NUXT_PUBLIC_YANDEX_CLIENT_ID || ''),
      __PACKAGED_ICONS__: JSON.stringify([
        {
          prefix: heroicons.prefix,
          width: heroicons.width,
          height: heroicons.height,
          icons: collection(
            heroicons.icons,
            Object.values(HEROICONS).map(name => name.split(':')[1]!)
          )
        },
        {
          prefix: lucide.prefix,
          width: lucide.width,
          height: lucide.height,
          icons: collection(lucide.icons, lucideNames)
        }
      ])
    },
    build: {
      outDir: '../dist-extension',
      emptyOutDir: true,
      rollupOptions: {
        input: { popup: `${root}popup.html`, background: `${root}src/background.ts` },
        output: { entryFileNames: '[name].js' }
      }
    }
  }
})
