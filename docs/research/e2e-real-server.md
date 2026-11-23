# Настоящий сервер для браузерного сценария

Исследование к задаче [#8](https://github.com/EMIR1HUB/ai-for-developers-project-386/issues/8) (карта [#1](https://github.com/EMIR1HUB/ai-for-developers-project-386/issues/1)). Вопрос: как поднять собранное приложение для браузерного теста Playwright: (а) Fastify раздаёт собранный фронтенд со SPA-fallback, или (б) `vite preview` с прокси на бэкенд; и как Playwright запускает это локально и в GitHub Actions под mise.

Дата: 2026-11-24. Пометки: **проверено** — открыт источник или запущен прототип; **оценка** — вывод без прямого измерения.

## Коротко

- Оба варианта работают на версиях проекта, проверено прототипом: Fastify 5.12.8 + `@fastify/static` 10.1.12 и Vite 8.3.8 `vite preview`.
- **Рекомендация: вариант (а), Fastify раздаёт `frontend/dist`.** Один процесс и один origin, как будет в Docker-образе (README, «Ограничения»). Браузерный тест проверяет ту же сборку и ту же раздачу статики, что пойдёт в прод. Цена: около 15 строк в бэкенде и одна неочевидная ловушка с 404 для `/api/*` (см. ниже).
- Вариант (б) не требует кода в бэкенде: `vite preview` уже наследует `host`, `strictPort` и `proxy` из `server` в `frontend/vite.config.ts`. Но это два процесса, а Vite прямо пишет, что preview не предназначен для продакшена. Раздачу статики для Docker всё равно придётся писать потом.
- Playwright поднимает сервер через `webServer` и ждёт `url`. В CI достаточно шага `npx playwright install --with-deps chromium`; кэшировать браузеры Playwright не советует.
- Время: установка Chromium с зависимостями на `ubuntu-latest` занимает 16–21 с (замер по чужим прогонам), сборка фронтенда около 1,5 с, один тест со стартом сервера около 2,4 с локально. Текущий CI идёт 36 с, ожидаемый прирост 25–40 с (оценка).

## Версии

Проверено `npm view <pkg> version` 2026-11-24:

| Пакет              | В проекте | Последняя (`latest`) |
| ------------------ | --------- | -------------------- |
| `fastify`          | 5.12.8    | 5.12.8               |
| `@fastify/static`  | нет       | 10.1.12 (2026-11-19) |
| `vite`             | 8.3.8     | 8.3.8                |
| `@playwright/test` | нет       | 1.65.1               |

`@fastify/static` версии `>=8.x` совместим с Fastify `^5.x` ([README, таблица совместимости](https://github.com/fastify/fastify-static/blob/main/README.md)). 10.1.12 вышла за 5 дней до этой заметки. Если в проекте действует правило «зависимости не моложе двух недель», при подключении проверь, что версия его проходит.

## Вариант (а): Fastify раздаёт собранный фронтенд

### Что говорят источники

- `@fastify/static` регистрирует маршрут-шаблон под `prefix` (по умолчанию `/`) при `wildcard: true`, это значение по умолчанию. При `wildcard: false` плагин при старте обходит `root` глобом и создаёт маршрут на каждый найденный файл; файлы, добавленные позже, не раздаются ([README, опции `wildcard`, `root`, `prefix`](https://github.com/fastify/fastify-static/blob/main/README.md)).
- `reply.sendFile('index.html')` отдаёт файл из `root`; в async-обработчике его нужно вернуть (`return reply.sendFile(...)`). README приводит SPA-пример: ассеты с долгим `maxAge` и `immutable`, а `index.html` с `maxAge: 0` ([README, `reply.sendFile`](https://github.com/fastify/fastify-static/blob/main/README.md)).
- Если запрос попал под `prefix`, а файла нет, вызывается 404-обработчик Fastify, который заменяют через `setNotFoundHandler` ([README, «Handling 404s»](https://github.com/fastify/fastify-static/blob/main/README.md)).
- `setNotFoundHandler` инкапсулирован по префиксу: плагины с разными `prefix` могут иметь разные 404-обработчики ([Fastify v5 Server reference, `setNotFoundHandler`](https://fastify.dev/docs/latest/Reference/Server/)).

### Ловушка: `/api/*` уходит в SPA-fallback (проверено прототипом)

Схема прототипа: API в плагине с `prefix: '/api'` и своим JSON-404, `@fastify/static` на `/`, корневой `setNotFoundHandler` отдаёт `index.html`. Результаты запросов:

| Запрос                | `wildcard: true` (по умолчанию) | `wildcard: false` |
| --------------------- | ------------------------------- | ----------------- |
| `GET /book/123e4567`  | 200 `index.html`                | 200 `index.html`  |
| `GET /admin/bookings` | 200 `index.html`                | 200 `index.html`  |
| `GET /assets/app.js`  | 200 JS                          | 200 JS            |
| `GET /api/health`     | 200 JSON                        | 200 JSON          |
| **`GET /api/nope`**   | **200 `index.html`**            | **404 JSON**      |
| `POST /book`          | 404 JSON                        | 404 JSON          |
| `GET /missing.js`     | 200 `index.html`                | 200 `index.html`  |

С `wildcard: true` маршрут-шаблон `/*` перехватывает и `GET /api/nope`, не находит файла и вызывает 404-обработчик контекста, где зарегистрирован плагин статики, то есть корневой. Клиент получает HTML со статусом 200 вместо 404 по контракту ([ADR-0003](../adr/0003-standard-http-status-codes.md)). Два рабочих решения:

1. `wildcard: false`: маршруты только на реальные файлы, остальное идёт через роутер Fastify, и `/api/*` получает 404 своего плагина. Минус: `frontend/dist` должен существовать до старта сервера. Для теста и Docker это так и есть.
2. Оставить `wildcard: true` и в корневом обработчике явно проверять `request.url.startsWith('/api/')`.

Первое чище: правило «`/api` отвечает JSON» живёт в одном месте, в API-плагине. `GET /missing.js` в обоих режимах отдаёт `index.html`. Для теста это неважно, при желании fallback можно ограничить запросами с `Accept: text/html`.

### Набросок

Это код прототипа, а не готовое решение для `backend/src`:

```ts
await app.register(apiRoutes, { prefix: '/api' }); // внутри: api.setNotFoundHandler(... 404 JSON)

if (staticRoot) {
  // только когда задан путь к frontend/dist: тесты app.inject работают без сборки
  await app.register(fastifyStatic, { root: staticRoot, wildcard: false });
  app.setNotFoundHandler((req, reply) =>
    req.method === 'GET' || req.method === 'HEAD'
      ? reply.sendFile('index.html')
      : reply.code(404).send({ code: 'NOT_FOUND', message: 'Not found' }),
  );
}
```

Что это значит для проекта:

- `buildApp()` нужен тестам через `app.inject` (AGENTS.md), поэтому статика подключается опционально, например по переменной окружения с путём к `dist`. Иначе API-тесты начнут требовать сборку фронтенда.
- `frontend/src/api/client-config.ts` берёт `baseUrl` из `window.location.origin`. При одном origin это работает без изменений.
- Нужна новая зависимость `@fastify/static` в `backend/package.json`.

## Вариант (б): `vite preview` с прокси

- `preview.proxy` по умолчанию берётся из `server.proxy`. Так же наследуются `preview.host` (из `server.host`) и `preview.strictPort` (из `server.strictPort`); `preview.port` по умолчанию 4173 ([Vite preview options, v8.3.7 docs](https://vite.dev/config/preview-options)).
- `appType` по умолчанию `'spa'`: подключается HTML-middleware со SPA-fallback, а для preview указано «Configure sirv with `single: true`» ([Vite shared options, `appType`](https://vite.dev/config/shared-options)).
- В документации preview описан как «intended for previewing the build locally and not meant as a production server» ([Vite, Deploying a Static Site](https://vite.dev/guide/static-deploy)).

Проверено прототипом на `vite@8.3.8`: `GET /book/123e4567` и `/admin/bookings` отдают `index.html`, `/api/health` и `/api/nope` проксируются на бэкенд (200 и 404 JSON). В этом репозитории `vite preview` заработает без правки конфига, потому что `server.proxy` на `127.0.0.1:3000` уже задан.

Минусы: два процесса (бэкенд и preview), значит `webServer` из двух записей. Прокси Vite не участвует в продакшене, поэтому тест проверяет не ту схему, что окажется в Docker-образе. Раздачу статики бэкендом для Docker всё равно придётся писать.

## Playwright: `webServer`

Из [Playwright, Web server](https://playwright.dev/docs/test-webserver):

- `command` запускает сервер; `url` считается готовым, когда отвечает 2xx, 3xx, 400, 401, 402 или 403. `port` устарел в пользу `url`.
- `timeout` по умолчанию 60000 мс. `reuseExistingServer: !process.env.CI`: локально переиспользует запущенный сервер, в CI всегда поднимает свой.
- `stdout` по умолчанию `"ignore"`, `stderr` по умолчанию `"pipe"`. `env` наследует `process.env` и добавляет `PLAYWRIGHT_TEST=1`. `cwd` по умолчанию каталог конфига.
- Без `gracefulShutdown` группа процессов убивается `SIGKILL`.
- `webServer` может быть массивом; это нужно для варианта (б).
- `use.baseURL` позволяет писать `page.goto('/book')`.

Из [Playwright, Configuration](https://playwright.dev/docs/test-configuration): типовой конфиг ставит `forbidOnly: !!process.env.CI`, `retries: process.env.CI ? 2 : 0` и `workers: process.env.CI ? 1 : undefined`; [Playwright, CI](https://playwright.dev/docs/ci) советует в CI один воркер ради стабильности.

Проверено прототипом на `@playwright/test@1.65.1`: `webServer` с `command: 'node server.ts'` и `url: 'http://127.0.0.1:3102/api/health'`, тест открывает `/book/123e4567` и ждёт отрисовки маршрута и ответа API. Результат: `1 passed (2.1s)`, всего 2,4 с вместе со стартом сервера (macOS, локально).

Для варианта (а) в этом репозитории `webServer` выглядит примерно так (порт и имя переменной условные):

```ts
webServer: {
  command: 'npm run build -w @calendar/frontend && npm start -w @calendar/backend',
  url: 'http://127.0.0.1:3100/api/health',
  env: { PORT: '3100', STATIC_ROOT: '...' },
  reuseExistingServer: !process.env.CI,
}
```

`backend/src/server.ts` уже читает `PORT` из окружения. Сборку можно вынести и в `depends` mise-задачи. Порт для e2e лучше взять отдельный от `:3000`: `mise run dev` держит там dev-бэкенд без статики, и при `reuseExistingServer` локальный прогон переиспользовал бы не тот сервер (оценка, не проверялось).

## Браузеры и CI

- `npx playwright install --with-deps chromium` ставит Chromium вместе с системными зависимостями. По умолчанию ставятся две сборки: обычный Chromium и chromium headless shell. Флаг `--only-shell` пропускает полный Chromium, если тесты только headless и `channel` не задан; это советуют для CI ([Playwright, Browsers](https://playwright.dev/docs/browsers)).
- Кэш браузеров лежит в `~/.cache/ms-playwright` на Linux и `~/Library/Caches/ms-playwright` на macOS, путь меняет `PLAYWRIGHT_BROWSERS_PATH` ([Playwright, Browsers](https://playwright.dev/docs/browsers)).
- Кэшировать браузеры в CI Playwright **не рекомендует**: восстановление кэша занимает примерно столько же, сколько скачивание, а системные зависимости не кэшируются. Если всё же кэшировать, ключ строят по версии Playwright ([Playwright, CI](https://playwright.dev/docs/ci)).
- Официальный пример workflow: `actions/checkout@v6`, `actions/setup-node@v6`, `npm ci`, `npx playwright install --with-deps`, `npx playwright test`, `actions/upload-artifact@v5` с `playwright-report/` и `if: ${{ !cancelled() }}` ([Playwright, CI](https://playwright.dev/docs/ci)).
- `jdx/mise-action@v5` по умолчанию сам кэширует каталог данных mise (`~/.local/share/mise`; `cache: true`, `install: true`) ([mise-action README](https://github.com/jdx/mise-action/blob/main/README.md)). Браузеры Playwright в этот кэш не входят, ставить их нужно отдельным шагом.
- Под mise `node_modules/.bin` уже в `PATH` (`[env] _.path` в `mise.toml`), так что в задаче mise можно писать `playwright install ...` и `playwright test` без `npx` (оценка: настройка `PATH` прочитана в `mise.toml`, в CI не запускалось).

Набросок шага для текущего `.github/workflows/ci.yml`. Место шага и задачу mise решает задача о встраивании в `check`:

```yaml
- run: mise run install
- run: npx playwright install --with-deps chromium --only-shell
- run: mise run check # или отдельная задача e2e
- uses: actions/upload-artifact@v5
  if: ${{ !cancelled() }}
  with:
    name: playwright-report
    path: playwright-report/
```

### Время прогона

| Шаг                                           | Время    | Источник                                                                                                                                                       |
| --------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Весь текущий CI-job `check`                   | 36 с     | проверено: прогон [45272141986](https://github.com/EMIR1HUB/ai-for-developers-project-386/actions/runs/45272141986) (mise-action 13 с, install 8 с, check 8 с) |
| `npx playwright install --with-deps chromium` | 16–21 с  | проверено: шаги на `ubuntu-latest` в четырёх прогонах `microsoft/playwright-vscode`, 2026 (Actions API); без `--with-deps` 7–11 с                              |
| Скачивание headless shell (`--only-shell`)    | ~15 с    | проверено локально (macOS arm64, 100,8 MiB + ffmpeg 1,4 MiB), зависит от сети                                                                                  |
| `vite build` фронтенда                        | ~1,5 с   | проверено локально (`built in 522ms`, 7540 модулей)                                                                                                            |
| Один тест со стартом Fastify                  | ~2,4 с   | проверено локально на прототипе                                                                                                                                |
| **Прирост CI от браузерного сценария**        | +25–40 с | оценка: сумма строк выше плюс запас на холодный запуск Chromium на раннере                                                                                     |

## Сравнение

| Критерий                           | (а) Fastify + `@fastify/static`                  | (б) `vite preview` + proxy                 |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Процессов в тесте                  | 1                                                | 2 (`webServer` из двух записей)            |
| Один origin                        | да, как в Docker                                 | да, но через прокси Vite                   |
| Совпадает с продакшен-схемой       | да                                               | нет: в проде прокси Vite не будет          |
| Код в бэкенде                      | ~15 строк и зависимость `@fastify/static`        | ничего                                     |
| Ловушки                            | `/api/*` и SPA-fallback, нужен `wildcard: false` | preview «not meant as a production server» |
| Повторное использование для Docker | то же самое                                      | придётся писать раздачу позже              |

## Рекомендация

Вариант (а). Fastify раздаёт `frontend/dist` через `@fastify/static` 10.x с `wildcard: false`. API живёт в плагине с `prefix: '/api'` и своим JSON-404, а корневой `setNotFoundHandler` отдаёт `index.html` на `GET` и `HEAD`. Статика подключается опционально, по пути из окружения, чтобы `buildApp()` в тестах `app.inject` не зависел от сборки. Playwright поднимает один процесс через `webServer` (`url` на `/api/health`, `reuseExistingServer: !process.env.CI`, отдельный от dev порт). В CI нужен один дополнительный шаг `npx playwright install --with-deps chromium --only-shell` без кэша браузеров; отчёт `playwright-report/` загружается артефактом при любом исходе, кроме отмены.

Вариант (б) стоит выбрать, только если браузерный тест нужен раньше, чем появится задача о раздаче статики, и правка бэкенда сейчас нежелательна. Он работает без изменения `vite.config.ts`, но потом всё равно придётся писать раздачу для Docker.

Открытые вопросы для карты:

- Входит ли e2e в `mise run check` или идёт отдельной задачей и отдельным CI-шагом (задача о встраивании тестов).
- Имя переменной окружения для пути к статике и порт e2e-сервера решаются в первом тикете.
