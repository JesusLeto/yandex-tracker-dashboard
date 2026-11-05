import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ui from '@nuxt/ui/vue-plugin'
import { addCollection } from '@iconify/vue'
import { setDefaultOptions } from 'date-fns'
import { ru } from 'date-fns/locale'
import Popup from './popup.vue'
import './style.css'

for (const collection of __PACKAGED_ICONS__) addCollection(collection)
setDefaultOptions({ locale: ru })
createApp(Popup).use(createPinia()).use(ui).mount('#app')
