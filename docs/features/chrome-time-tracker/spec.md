# Feature: Chrome extension для учёта времени

Feature: Chrome extension для учёта времени
Slug: chrome-time-tracker
Status: In Development
Revision: 11
Reviewed revision: 11
Approved revision: 11
Review verdict: READY_FOR_APPROVAL
Дата: 2026-11-05

## Проблема и результат

Чтобы запустить или остановить учёт времени, пользователь вынужден открывать
вкладку Dashboard. Расширение Chrome должно давать быстрый доступ к задачам
и общему с сайтом таймеру.

Продуктовое интервью завершено; HTML-макет принят, реализация явно разрешена
владельцем. SPEC_REVIEW revision 11 закрыл подтверждённые blockers.

## Scope и non-goals

- Расширение Chrome: профиль с меню, ниже текущий таймер, ниже список задач.
- Стилистика, тема и CSS-конфигурация существующего проекта.
- Вход через Яндекс SSO аналогично приложению.
- UX сочетает Toggl Track Chrome extension и существующий виджет «Мои задачи».
- Список задач повторяет виджет «Мои задачи» сайта; дополнительный поиск исключён.
- Один общий таймер сайта и расширения в одном профиле Chrome на одном компьютере.
- После составления плана подготовить HTML-макет, получить правки пользователя
  и согласование макета до полноценной реализации.

HTML-макет согласован; он не выполняет реальные операции с задачами или временем.
Перенос старых таймеров, миграции их формата и подтверждения принадлежности
исключены по прямому указанию владельца. Новое общее состояние использует
отдельный ключ; старые данные не импортируются, не перезаписываются и не удаляются.
Синхронизация между устройствами и профилями Chrome исключена из начальной версии.
Другие браузеры, side panel, кнопки таймера на сторонних страницах, автотрекинг,
история и отчёты внутри расширения, сервер синхронизации, публикация в Store
не входят в эту версию.

## Сценарии и acceptance criteria

Проверяемое поведение; реализация должна пройти перечисленные ниже gates.

- AC-01: в верхней части отображаются имя и аватар пользователя; клик открывает
  меню с пунктами «Открыть Dashboard», «Настройки» и «Выйти». Первые два пункта
  открывают соответствующие страницы сайта. «Выйти» завершает только сессию
  расширения, не завершая сессию сайта.
- AC-02: ниже профиля отображается текущая задача и время общего с сайтом таймера.
  В одном профиле Chrome на одном компьютере запуск и остановка через одну
  поверхность отражаются на другой. Синхронизация между устройствами и профилями
  не требуется. При недоступном bridge сайт показывает отсутствие связи и не
  запускает независимый второй таймер. Без установленного расширения сохраняется
  существующий самостоятельный режим сайта.
- AC-03: ниже таймера отображается виджет «Мои задачи» с поведением сайта:
  задачи по настроенным статусам и ролям, существующие поля отображения,
  сортировка по приоритету/дедлайну, страницы по пять задач, обновление и ссылка
  «Все» на страницу задач сайта. Дополнительного поиска в расширении нет.
  Старт и предложение смены статуса повторяют сайт; пока таймер работает,
  запуск другой задачи недоступен. Настройки виджета берутся с сайта
  и обновляются автоматически при изменениях на сайте.
- AC-04: расширение использует тему и CSS-конфигурацию проекта. Выбранная тема
  берётся с сайта и обновляется автоматически при её изменении на сайте.
  Отдельных настроек темы и виджета внутри расширения нет. После первоначальной
  связи с Dashboard расширение использует последний снимок и при закрытой вкладке.
  До получения снимка предлагает открыть сайт для первичной синхронизации.
- AC-05: пользователь входит через Яндекс SSO; сессия расширения независима от
  сессии сайта при выходе. Организация берётся из подтверждённого контекста сайта
  для того же пользователя; при отсутствии — ввод ID, как в существующем проекте.
  При выходе общий таймер продолжает работать:
  доступен на сайте и после повторного входа тем же аккаунтом. Выход не создаёт
  worklog, не сбрасывает и не останавливает таймер.
- AC-06: до production-реализации пользователь получает HTML-макет, может внести
  правки и согласует его. План сам по себе не разрешает пропустить этот шаг.
- AC-07: «Стоп» открывает форму, как на сайте: задача, длительность на момент
  нажатия, редактирование длительности, необязательный комментарий и необязательная
  смена статуса. Доступны «Сохранить и остановить» и отказ без сохранения.
  Закрытие формы без выбора действия оставляет таймер работающим.
- AC-08: при ошибке сохранения worklog таймер и введённые данные сохраняются для
  повторной попытки. Если worklog сохранён, а смена статуса не удалась, показать
  ошибку смены статуса; сохранённое время не создавать повторно. Неизвестный исход
  сетевого POST требует проверки результата перед повторной записью.
- AC-09: закрытие popup и вкладки сайта не останавливает таймер. Время вычисляется
  от сохранённого startedAt и восстанавливается после перезапуска worker/Chrome,
  без фонового посекундного счётчика. Черновик формы сохраняется при закрытии popup.
- AC-10: данные таймера/настроек/черновиков разделены по подтверждённому Yandex
  user ID и organizationId. Другой аккаунт не видит чужие данные. Выход очищает
  credentials расширения и профиль его UI, сохраняя таймер владельца. При 401 —
  повторный вход, при 403 — сообщение об отсутствии прав, без потери таймера.
  Legacy timer не присваивается текущему аккаунту: общий режим начинается с
  отдельного нового состояния, исходная legacy-запись остаётся нетронутой.
- AC-11: повторные клики, одновременная остановка из сайта/popup и restart worker
  не запускают параллельные сохранения одной timer session. Известный успешный
  receipt возвращается повторному caller без POST; неизвестный исход блокирует
  автоматический повтор POST до проверки.
- AC-12: весь JS и иконки входят в MV3-пакет; нет remote JS, eval и inline JS.
  Разрешения ограничены identity, storage и конкретными origin Dashboard/OAuth.
  Bridge проверяет origin, identity и входные команды; нет универсального fetch
  proxy. Credentials расширения не передаются сайту, в DOM, логи и снимки настроек.
- AC-13: popup шириной 480 CSS px и высотой до 600 CSS px; скролл внутри списка
  или формы. Есть keyboard/focus, подписи кнопок, labels, loading/error states.
  Проверить длинные названия и zoom 100/125/200%; детали согласуются по макету.
  Ширина увеличена по последующему прямому запросу владельца «Сделай пошире, как в toggl».

## Принятые решения и источники

- D-01: быстрый доступ к учёту времени через расширение Chrome.
  Источник: исходный запрос владельца от 2026-11-05.
- D-02: порядок блоков — профиль с меню → текущий таймер → задачи.
  Источник: исходный запрос и три приложенных скриншота владельца.
- D-03: тема, стилистика и CSS-конфигурация общие с проектом.
  Источник: исходный запрос владельца.
- D-04: авторизация через Яндекс SSO аналогично проекту.
  Источник: исходный запрос владельца.
- D-05: план → HTML-макет → правки и согласование → полноценная реализация.
  Источник: явно заданная владельцем последовательность.
- D-06: сайт и расширение используют общий таймер; запуск и остановка должны
  отражаться в обоих интерфейсах. Источник: ответ владельца «Да, общий» на
  соответствующий вопрос. Ответ не определяет синхронизацию между устройствами.
- D-07: остановка через форму, как на сайте, с редактированием длительности,
  комментарием, необязательной сменой статуса и существующими действиями сохранения,
  отказа без сохранения и закрытия формы. Источник: ответ владельца
  «Форма, как на сайте». Сохранить существующие гарантии обработки ошибок AC-08.
- D-08: общий таймер работает только в одном профиле Chrome на одном компьютере;
  межпрофильная и межустройственная синхронизация не входит в начальную версию.
  Источник: ответ владельца «только в одном профиле Chrome на одном компьютере».
  Уточняет границы D-06, не меняя решение об общем таймере.
- D-09: меню профиля содержит «Открыть Dashboard», «Настройки» (страница сайта)
  и «Выйти». Источник: ответ владельца «Подходит» на предложение этого состава.
  Отдельная страница настроек внутри расширения этим решением не вводится.
- D-10: список задач и его действия повторяют виджет «Мои задачи» сайта;
  дополнительный поиск не добавляется. Источник: ответ владельца
  «Не нужно, делаем как в виджете Мои задачи на сайте».
  Сортировка, пагинация, обновление, переход «Все», отображение полей и ограничения
  запуска берутся из существующего виджета и его shared компонентов.
- D-11: пункт «Выйти» завершает сессию только расширения; пользователь остаётся
  авторизованным на сайте. Источник: ответ владельца «Только расширения» на вопрос
  об области действия выхода. Это решение не разрешает удалять активный таймер
  или несохранённое время.
- D-12: сайт является источником темы и настроек виджета «Мои задачи»;
  расширение получает их автоматически и обновляет при изменениях на сайте.
  Источник: ответ владельца «Да, берет с сайта» на предложение синхронизировать
  тему и настройки виджета. Редактирование остаётся на сайте.
- D-13: при выходе из расширения общий таймер остаётся работающим; управление
  сохраняется на сайте и возвращается после входа тем же аккаунтом.
  Источник: ответ владельца «Да, оставляем работающим» на этот сценарий.
- D-14: на текущем этапе Dashboard origin — http://localhost:3000.
  Источник: ответ владельца «Давай пока http://localhost:3000».
  Обновление от 2026-11-05: при настройке fork/Vercel владелец выбрал «Переключить
  на Preview Vercel». Текущий origin — постоянный адрес Preview-ветки из
  `extension/config.json#dashboardOrigin`; ID расширения сохраняется.
- D-15: HTML-макет принят без правок; владелец явно разрешил реализацию:
  «Макет меня полностью устраивает, приступай к реализации». Независимый
  SPEC_REVIEW и исправление подтверждённых blockers остаются обязательными;
  разрешение не подменяет недоступную интеграционную проверку.
- D-16: без подтверждений принадлежности и без миграций старого таймера.
  Источник: прямой ответ владельца «Без подтверждения и без миграций» после
  уточнения вариантов. Старый timer key не импортируется и не меняется;
  новое общее состояние создаётся отдельно. Старый незавершённый отсчёт
  автоматически не появляется в расширении и не записывается в Tracker.

Проверенные точки существующего кода:

- `app/core/store/use-timer-store.ts#useTimerStore`: локальное persisted состояние;
  остановка создаёт worklog, затем сбрасывает таймер. При ошибке сохранения
  сброс не достигается. Общий с расширением transport пока отсутствует здесь.
- `app/core/components/timer/timer-button.vue#handleStop`: открывает форму
  с зафиксированной на момент клика длительностью.
- `app/core/components/timer/timer-stop-modal.vue#confirm`: редактирование времени,
  комментарий и необязательная смена статуса; `#discard` сбрасывает без сохранения.
- `app/core/components/issues/issue-timer-button.vue#isTrackingThisIssue`:
  при работающем таймере запуск другой задачи отключён.
- `app/modules/dashboard/store/use-my-issues-widget-store.ts#useMyIssuesWidgetStore`:
  список зависит от настроенных статусов и ролей, имеет сортировку и страницы.
- `app/modules/dashboard/components/my-issues-widget.vue#goToNextPage`:
  существующий UI списка, переключение страниц, обновление и переход «Все»;
  `app/modules/dashboard/models/constants/my-issues-sort.ts#MY_ISSUES_SORT_OPTIONS`:
  сортировка по приоритету и дедлайну.
- `app/core/composables/use-issue-transition.ts#selectIssue`: для открытой задачи
  предлагается смена статуса перед стартом; отказ запускает таймер без смены
  статуса. Ошибка смены статуса также не блокирует запуск.
- `app/core/components/app/app-login.vue#oauthUrl`: вход через Яндекс OAuth;
  `app/modules/auth/views/auth-view.vue#onBeforeMount` обрабатывает callback.
- `app/modules/settings/composables/use-credentials-settings.ts#useCredentialsSettings`:
  контекст включает accessToken и organizationId.
- `app/assets/styles/main.css#:root` и `app/app.config.ts#defineAppConfig`:
  палитра и конфигурация компонентов проекта.
- `nuxt.config.ts#piniaPluginPersistedstate`: persisted state хранится
  в localStorage с префиксом ytd:; `#colorMode` задаёт тёмную тему по умолчанию.
- `app/modules/settings/store/use-site-settings-store.ts#useSiteSettingsStore`:
  настройки виджета и сезонного оформления persist-ятся, но accessToken,
  organizationId и themeType исключены. `app/modules/settings/composables/use-theme-settings.ts#useThemeSettings`
  определяет сезонный тип из runtime config или календаря и настройки его элементов.

## Технический план (предложен для review и approval)

1. Отдельный Vue/Vite entry в `extension/`, MV3 popup и service worker. Использовать
   установленный Nuxt UI через Vite plugin и существующие Vue/Pinia/Tailwind/иконки;
   без WXT/CRXJS и полного Nuxt bundle. Прямые dev dependencies: Vite, Vue Vite
   plugin, Chrome API types; Tailwind Vite plugin только если нужен locked версии
   интеграции. Не полагаться на транзитивные пакеты и не обновлять Nuxt UI ради
   новых icon API. Импортировать общие CSS и UI-config во время сборки, не копировать
   палитру. Выделить существующее presentation виджета, issue row и stop form;
   host-контроллеры сайта и extension передают данные/действия. Устранить Nuxt
   auto-import/generated-type/server-icon coupling только на этом стыке.

2. При подключённом расширении один worker координирует timer commands обоих UI;
   durable state в chrome.storage.local, без Chrome Sync. Session содержит owner,
   issue, startedAt, revision и save operation ID. Перед сетью сохраняется pending
   операция, после успеха — receipt с worklog ID. Сайт инициирует разрешённый
   externally_connectable port, получает snapshot/events; reconnect запрашивает
   актуальный snapshot. Контекст сайта подтверждается через его авторизацию и
   /myself. Credentials сайта используются только для его контекста запроса,
   не сохраняются как extension session и не возвращаются другим callers.
   Extension credentials никогда не возвращаются сайту. При extension logout
   авторизованный сайт продолжает управление общим таймером.

3. Один coordinator выполняет сохранение через существующий `/tracker` proxy
   с credentials инициатора; DTO и buildWorklogPayload переиспользуются. Нет двух
   независимых POST. Receipt обновляет existing worklog/issue buses в UI. Timeout
   после отправки — неизвестный исход: сверить worklogs владельца по issue/start/
   duration; неоднозначность требует ручной проверки, автоматический retry POST
   запрещён. Не обещать distributed exactly-once без server idempotency.

4. Отдельный Yandex SSO flow расширения через chrome.identity.launchWebAuthFlow:
   authorization code + PKCE S256, state и зарегистрированный chromiumapp callback,
   без client_secret в пакете. Протокол сайта не меняется. Extension token — в
   локальном trusted storage без доступа content scripts; transaction/state/verifier
   — в session storage. Logout удаляет только extension credentials без глобального
   отзыва grant сайта. Origin/API base, client ID и стабильный extension ID задаются
   для конкретной сборки. Credentials не читать из cookies сайта.

5. Сайт отправляет снимок нужных не секретных настроек виджета и темы, включая
   сезонный тип и его параметры, при подключении/изменении. Кеш разделён по owner.
   Закрытая вкладка допускает использование последнего снимка; новые изменения
   приходят при следующем подключении сайта. На первом запуске нужна однократная
   связь с Dashboard. Флаг скрытия виджета на главной сайта не скрывает основной
   список extension; роли/статусы/поля наследуются. Sort/page остаются локальным
   UI-состоянием popup, как в виджете сайта.

6. Сайт без расширения сохраняет прежний режим. Старые таймеры не импортируются
   и не мигрируют (D-16). Новое общее состояние и его mirror имеют отдельные ключи;
   общий режим сайта не перезаписывает legacy timer key. При bridge подключении
   mirror — не второй writer. Разрыв port не доказывает отключение/удаление
   расширения: mirror остаётся read-only, записи и новые старты заблокированы до
   reconnect с актуальным snapshot. Автоматического возврата самостоятельного
   writer для общего timer session нет, включая uninstall. UI показывает
   недоступность расширения и предлагает восстановить соединение; никаких
   процедур ручного переноса или handover в этой версии нет. Существующий
   самостоятельный legacy-режим относится только к ранее не подключавшемуся
   общему таймеру контексту; его данные не используются как резервная копия общего.
   Откат к устаревшему mirror не создаёт право записи.
   Правило сайта «сброс после 24 часов»
   не должно удалять worker-owned timer: после суток требуется форма проверки,
   а не потеря времени. Самостоятельный режим сайта в этом отношении не меняется.

Отвергнуты remote iframe/полный Nuxt bundle и отдельный backend: первый не даёт
независимый упакованный UI, второй тащит лишние страницы/server-зависимости,
сервер синхронизации не требуется для D-08. Отдельный ADR не создаётся: выбор
обратим, публичный API и данные Tracker не мигрируют, прежний режим сайта сохранён.

### Внешние условия до integration/release

- Dashboard origin на текущем этапе — Preview Vercel из D-14; внешний origin
  не угадывать, <all_urls> не использовать. Local frontend сам по себе не изолирует
  upstream Tracker: для проверок нужен отдельный fixture/test backend.
- Зарегистрировать стабильный extension ID/callback и подтвердить client/scopes
  в разрешённом test-контуре. Секреты не запрашивать в чате.
- До выделения всего UI проверить именно locked Nuxt UI 4.7.1: Vite theme API,
  generated types, Tailwind scan, modal providers и локальные иконки.
- Без разрешённого test OAuth/Tracker окружения integration gate остаётся OPEN;
  макет и fixtures не являются production readiness.

### Проверенные внешние контракты

Публичная документация проверена 2026-11-05; архитектура ещё не выбрана.

- [Chrome Storage](https://developer.chrome.com/docs/extensions/reference/api/storage):
  localStorage недоступен extension service worker; chrome.storage.local доступен
  extension contexts, поддерживает onChanged и очищается при удалении расширения.
  storage.sync синхронизирует данные между браузерами и не соответствует D-08.
- [Chrome Identity](https://developer.chrome.com/docs/extensions/reference/api/identity):
  launchWebAuthFlow поддерживает внешний OAuth; getRedirectURL формирует callback
  вида https://<extension-id>.chromiumapp.org/. Регистрацию callback нужно проверить
  для выбранного Yandex OAuth приложения, а не считать готовой по наличию API.
- [Chrome Messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging):
  сайт может инициировать разрешённое externally_connectable соединение;
  расширение не может само инициировать сообщение произвольной веб-странице.
- [Yandex OAuth](https://yandex.ru/dev/id/doc/ru/concepts/ya-oauth-intro) и
  [параметры запроса](https://yandex.ru/dev/id/doc/ru/codes/screen-code):
  авторизация возвращается на зарегистрированный Redirect URI; state применяется
  для связи запроса и ответа. Конкретный flow расширения ещё предстоит выбрать.

## Work items

| ID | Проверяемый результат / AC | DRI | Contributing роли/слои | Файлы / источники | Зависимости / порядок | Граница review |
|---|---|---|---|---|---|---|
| WI-01 | План и кликабельный HTML-макет, AC-01,03,06,07,13 | main lead | frontend consult | docs/features/chrome-time-tracker/spec.md; mockup.html | План → макет → правки → SPEC_REVIEW и approval текущей ревизии | Визуальное согласование владельцем; SPEC_REVIEW 1 pass + 1 recheck |
| WI-02 | MV3 package и общий CSS/config/presentation, AC-03,04,12,13 | frontend | shared UI, build | extension/{manifest.json,popup.html,vite.config.ts,tsconfig.json,src/main.ts,src/popup.vue}; package.json; pnpm-lock.yaml; app/assets/styles/main.css; app/app.config.ts; app/core/constants/ui-config/; app/core/components/{issues,timer}/; app/modules/dashboard/components/my-issues-widget.vue | После WI-01 approval и явного запуска реализации; сначала locked-version gate | CSP, local icons, тема, регрессия существующего UI |
| WI-03 | Независимый SSO и API transport, AC-01,05,10,12 | database/API | frontend | extension/src/{auth,api}.ts; app/core/api/{index,yandex-tracker.api}.ts; app/core/types/api/; существующие Nitro proxies | WI-02; origin/extension ID/OAuth client/callback и test scopes до integration | PKCE/state, credentials, 401/403/logout, API allowlist; security review |
| WI-04 | Общий timer/bridge/settings без миграций, AC-02,04,05,08–12 | frontend | database/API | extension/src/{background,timer,protocol}.ts; app/plugins/extension-bridge.client.ts; app/core/store/use-timer-store.ts; app/modules/settings/store/use-site-settings-store.ts; app/core/composables/{use-worklog-bus,use-issue-bus}.ts | WI-02–03; связанный timer/auth flow меняет один writer последовательно | Race/restart, owner isolation, trusted commands, отдельные ключи без импорта, unknown writes; security/invariant review |
| WI-05 | Popup wire-up и паритет виджета/формы, AC-01–05,07,08,13 | frontend | database/API | extension/src/popup.vue и host controllers; shared presentation WI-02; app/core/components/timer/{timer-button,timer-stop-modal}.vue; app/modules/dashboard/store/use-my-issues-widget-store.ts | WI-02–04 | Полный start → stop/edit → save → sync flow; existing site interactions |
| WI-06 | Verification и handoff пакета, все AC | testing | frontend, database/API, reviewer | Затронутые существующие tests/unit и tests/nuxt; временный assert harness; .work/validation.md; README.md/README.en.md; changelog.md | WI-05; test stand до OAuth integration; без новой test suite | Receipts AC/gates; OPEN не PASS/Done; публикация вне scope |

Имена новых внутренних файлов можно уточнять эквивалентно; ownership, слой,
protected scope и границы review сохраняются.

## Gates и условия Done

- G-01: согласованный HTML-макет и независимый SPEC_REVIEW текущей ревизии;
  одно approval владельца и явное разрешение execution. Закрыт по D-15/D-16
  и SPEC_REVIEW revision 11; макет — отдельный HTML без реальных API.
- G-02: locked Nuxt UI/Vite compatibility, общий CSS/config, local icons, CSP
  и permissions; реальный unpacked MV3 popup, не iframe/localhost вместо extension.
- G-03: после application edits — pnpm typecheck и pnpm lint:fix без unrelated
  formatting; extension typecheck. Затронутые существующие time/worklog/transition
  тесты; новую protocol логику проверить временным assert harness. Новые тесты
  и новый framework без запроса не добавлять.
- G-04: website + popup одновременно; 2 вкладки; double click; закрытие popup
  во время POST; worker/Chrome restart; legacy key не меняется; сохранность формы;
  offline/401/403/429/500; unknown write; ошибка status после успешного worklog.
  Отдельно: сайт закрыт → popup сохранил время → extension отключён → сайт открыл
  устаревший mirror; запись запрещена. Разрыв port и reconnect с receipt проверить
  раздельно, включая два одновременно открытых UI; никакого автоматического failover.
- G-05: разрешённый test SSO: callback/state mismatch/cancel/denied, повторный
  вход, другой owner/org, logout работающего таймера, безопасные snapshots.
  Сценарий A → logout → B → первое подключение: legacy timer не импортирован,
  аккаунт B получает отдельное пустое общее состояние, legacy key не изменён.
  Нет test окружения — OPEN. Никакого production browser/API даже read-only.
- G-06: keyboard/focus, длинные имена, dark/light/активная сезонная тема, zoom,
  loading/empty/error. Сверить макет и сайт; screenshots и console/network summary.
- G-07: built-in code-reviewer первым для code review; security/auth/invariant
  review по charter. SPEC_REVIEW документа этот gate не заменяет.
- G-08: extension:build нужен для unpacked acceptance; владелец явно разрешил
  сборку ответом «Да, собрать расширение». Локальная сборка выполнена успешно.
  Полный Nuxt build/generate/preview не нужен и не разрешён по умолчанию.
- Done: все AC и обязательные gates реально PASS, нет unresolved blockers.
  Макет, Git-код и локальные fixtures не означают product Done. Store/deploy вне scope.

### Состояние реализации

Код и MV3-пакет подготовлены в отдельном worktree. На Node 24.11.0 через `n exec`
прошли extension:typecheck, typecheck, lint:fix, extension:build и 46 существующих
unit tests. Прямая проверка generated app project даёт те же 17 диагностик, что
исходная ревизия, без новых. Временные assert harness проверяют coordination,
изоляцию владельцев, restart, неизвестный исход POST и ручное разрешение повтора.
Built-in code-reviewer выполнил полный проход и targeted recheck; подтверждённые
замечания исправлены. Локальные execution receipts хранятся в `.work/validation.md`
и не входят в Git. Перед подготовкой PR полный существующий suite прошёл:
189 тестов в 18 файлах; lint также прошёл.

Расширение установлено в реальный Chrome. Собственное тестовое OAuth-приложение
настроено с callback расширения и localhost/auth, правами профиля/аватара и только
tracker:read. Владелец отдельно разрешил чтение рабочего Tracker для этой задачи.
Вход сайта и popup подтверждён; первичная синхронизация настроек прошла: после
подключения локального Dashboard в popup появился виджет с задачами пользователя.
Ширина 480 px визуально проверена в Chrome. Устранена передача browser cookies
в трёх Yandex proxy; native /myself после исправления возвращает 200.

G-04 и полные G-05/G-06 остаются OPEN: изменения настроек в обеих поверхностях,
browser lifecycle/race/error-сценарии и запись времени ещё не прошли приёмку.
Запись в рабочий Tracker не разрешена; данное OAuth-приложение её не предоставляет.
Настройка: [extension/README.md](../../../extension/README.md).
Status остаётся In Development; первичная синхронизация не означает все gates PASS.

## Риски, внешние зависимости и rollback

- Network POST не даёт exactly-once без server idempotency: pending/receipt и
  блокировка автоматического повтора обязательны; неизвестность требует проверки.
- Bridge — новая trust boundary: origin allowlist, подтверждение identity,
  account+org isolation и validation команд обязательны. Нет wildcard API proxy.
- Uninstall удаляет extension storage. Mirror помогает только до последней
  связи с сайтом; не гарантировать более новое состояние после удаления extension.
  Перед удалением нужно сохранить/завершить таймер; cloud backup не предусмотрен.
- Rollback: завершить активные операции перед отключением; общий mirror остаётся
  read-only, не восстанавливать из него самостоятельный writer. Не чистить
  автоматически localStorage/pending/старые timer keys. Удаление старого формата
  вне scope. Откат с unresolved write требует проверки worklog, не нового POST.
- Основной checkout и существующий setup worktree сохраняются. Планирование
  ведётся в отдельном detached worktree, без production-правок и публикации.

## Результат ревью

SPEC_REVIEW revision 9: CHANGES_REQUESTED. Отдельный ephemeral Codex process
01a1ab53-540b-7112-ae72-4756964dde48; инструкции существующего qtim-reviewer,
gpt-6-astra/xhigh, --sandbox read-only, без истории основного диалога.
R1 подтверждён: mirror/failover мог разрешать второй writer; revisions 10–11
запрещают автоматический failover и записи из mirror, расширен G-04.
R2 подтверждён: legacy timer не содержит owner, а logout сайта его не очищает;
владелец исключил миграции и подтверждения (D-16), legacy key остаётся нетронутым,
новое общее состояние отделено; расширены AC-10/G-05. Targeted recheck revision 11:
READY_FOR_APPROVAL, R1/R2 закрыты; новых blockers в затронутом контракте нет.
Одобрение и запуск владельца: D-15, дополненный прямым scope решением D-16;
повторный стартовый вопрос не требуется. Runtime gates пока не пройдены.
Source pack, исходный verdict и raw output в .work/.
Review budget: full-pass 1/1; fix-recheck 1/1.
Packaging CONSULT: extension_ui_consult, gpt-6-astra/xhigh; read-only инструкции,
не механический sandbox. Подтверждены конкретные Nuxt coupling и Vue/Vite вариант;
фактические build/MV3/visual parity не проверены. Raw report — в .work/.

## Handoff

Источник: docs/features/chrome-time-tracker/spec.md revision 11.
Владелец принял HTML-макет и явно разрешил реализацию (D-15), уточнил D-16;
подтверждённые SPEC_REVIEW blockers закрыты. Direct execution разрешён без
повторного стартового вопроса. Внешние условия: test OAuth client/callback;
до них G-05 OPEN.

### Что запускать дальше

- Рекомендация: RECOMMEND direct; выбран прямой запуск по D-15, без скрытого team-up.
- Почему: один связанный outcome ведёт main writer; нужны независимые review gates.
- Топология: WI-02 → WI-03 → WI-04 → WI-05 → WI-06; связанные writes последовательно.
- Команда: `Реализуй docs/features/chrome-time-tracker/spec.md revision 11 напрямую после SPEC_REVIEW; макет и запуск уже согласованы. Сохрани G-01–G-08; без полного Nuxt build/generate/preview, production доступа, commit/push и публикации.`
- Альтернатива: $qtim-team-up только по отдельному явному запросу владельца.

Execution Recommendation Gate: Developer Standard и PM треки и TOML ролей
frontend/database/testing/reviewer есть в основном checkout; custom роли в этом
runtime не загружены. Перед execution проверить роли и exact pairs; не обозначать
roster dev-ready по одним файлам. Recommendation ничего не запускает; mission
не нужен. После approval последним файловым изменением записать указатель в
memory/decisions.md; сейчас указатель не создавать.

## История изменений

- 2026-11-05: revision 11; owner исключил миграции/подтверждения (D-16), R2 закрыт
  разделением нового и legacy состояния; R1 — без failover; handoff direct.
- 2026-11-05: revision 10; owner принял макет/запустил реализацию и выбрал localhost;
  SPEC_REVIEW rev9 вернул R1/R2; R1 уточнён, R2 ожидает owner decision.
- 2026-11-05: Draft revision 9; план, AC-09–AC-13, WI-01–WI-06, gates и handoff.
- 2026-11-05: Draft revisions 5–8; виджет, настройки и работающий timer после logout (D-10–D-13).
- 2026-11-05: Draft revisions 1–4; сохранены исходные требования, общий таймер
  в одном профиле Chrome, форма остановки сайта и меню профиля (D-01–D-09).
