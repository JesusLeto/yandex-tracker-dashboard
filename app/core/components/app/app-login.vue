<script setup lang="ts">
import extensionConfig from '../../../../extension/config.json'

const config = useRuntimeConfig()
const params = new URLSearchParams({
  response_type: 'token',
  client_id: config.public.yandexClientId
})
const origin = useRequestURL().origin

if (origin === extensionConfig.dashboardOrigin) {
  params.set('redirect_uri', new URL('/auth', origin).href)
}

const oauthUrl = `https://oauth.yandex.ru/authorize?${params}`
</script>

<template>
  <u-button
    :to="oauthUrl"
    target="_blank"
    rel="noopener"
    color="error"
    label="Войти через Яндекс"
    class="h-fit"
  />
</template>
