# AGENTS.md

Сервис записи на звонок (упрощённый Cal.com). Сценарий, требования и правила бронирования описаны в [README.md](README.md).

## Команды

Окружение и задачи описаны в `mise.toml`. Команды запуска, проверок и генерации собраны в таблице README.md, раздел «Использование». Главное:

- `mise run check`: линтеры, типы и тесты, его же запускает CI. Перед коммитом должен быть зелёным.
- `mise run dev`: бэкенд на `:3000` и фронтенд на `:5173` фоновыми daemons (`mise daemons ls | logs | stop`).
- Один тест: `npm test -w @calendar/backend -- test/health.test.ts` или `npm test -w @calendar/frontend -- -t "<имя теста>"`.

## Генерируемые файлы

Эти пути создаёт `mise run generate`. Руками их не правят: правка вносится в `api/main.tsp`, затем запускается генерация.

| Путь                          | Из чего            | В git                                                           |
| ----------------------------- | ------------------ | --------------------------------------------------------------- |
| `api/openapi.yaml`            | `api/main.tsp`     | да, CI проверяет, что после `mise run generate` он не изменился |
| `backend/src/generated/`      | `api/openapi.yaml` | нет (`.gitignore`)                                              |
| `frontend/src/api/generated/` | `api/openapi.yaml` | нет (`.gitignore`)                                              |

После изменения контракта выполни `mise run generate` и закоммить `api/openapi.yaml`. Задачи `typecheck`, `test` и `dev` перегенерируют код сами.

## Устройство

- Источник правды для API: `api/main.tsp`. Тело любой ошибки — модель `ApiError` `{ code, message, fields? }`, `code` из закрытого перечисления `ErrorCode`; ответ с ошибкой описывается как `ErrorResponse<статус>`.
- Бэкенд: Node запускает `.ts` без сборки (type stripping), поэтому относительные импорты пишутся с расширением `.ts`. Маршруты Fastify пишутся вручную по контракту (`src/routes/`), типы запросов и ответов берутся из `generated`. `buildApp(options)` в `src/app.ts` нужен тестам (`app.inject`), а `src/server.ts` только слушает порт.
- Бэкенд: «сейчас» берётся только из часов `now` в `AppContext`, данные — из хранилища в памяти `src/store.ts` (ADR-0002, методы синхронные). Ошибки отправляются только через `sendError` из `src/errors.ts`: статус следует из кода. Маршрут или помощник может вместо этого бросить `ApiFailure` (там же), общий обработчик отправит её через `sendError`. `DEMO_DATA=false` выключает демо-типы встреч.
- Бэкенд: тело запроса читается только через `parseBody(request.body, read)` из `src/validation.ts`. Он обрезает пробелы по краям строк до проверки, копит ошибки всех полей и бросает `422 VALIDATION_ERROR` с полным `fields` (вложенные поля через точку: `fields.string('guest.name', …)`); тело не JSON-объект — `400 MALFORMED_REQUEST`. Тело, которое Fastify не смог разобрать (битый JSON, неизвестный `Content-Type`), общий обработчик тоже отдаёт как `400 MALFORMED_REQUEST`. Новое правило поля добавляется в `FieldReader` там же.
- API-тесты бэкенда собирают приложение через `buildTestApp()` (`test/support/testApp.ts`: фиксированные часы, без демо-данных) и сверяют каждый ответ с контрактом через `expectResponseToMatchContract(response, operationId)` (`test/support/contract.ts`).
- Фронтенд вызывает API только через сгенерированный SDK, прямой `fetch` запрещён правилом oxlint. `baseUrl` задаётся в `src/api/client-config.ts`. В dev Vite проксирует `/api` на `127.0.0.1:3000`. Данные страниц грузит `useApiQuery` (`src/api/useApiQuery.ts`), текст ошибки даёт `errorMessage`, ошибки полей из `422 VALIDATION_ERROR` — `fieldErrors` (оба в `src/api/errors.ts`). Уведомления показывает `notifications.show` из `@mantine/notifications`.
- Тесты фронтенда рендерят приложение по адресу (`renderApp`) и подменяют сеть MSW: `server.use(mockApi('<операция>', статус, тело))` из `src/test/mockApi.ts`, обработчики типизированы сгенерированными типами. Тело запроса страницы тест получает через четвёртый аргумент `mockApi` (`onRequest`). Новая операция контракта добавляется в `ApiOperations` и `OPERATIONS` там же. Запрос без обработчика роняет тест.
- TypeScript закреплён на 6.x: в TS 7 нет JS API компилятора, и генератор Hey API на нём падает.

## Правила

- Коммиты пишутся по Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Хук commit-msg проверяет их через commitlint.
- Коммит ссылается на тикет GitHub Issues в футере сообщения: `Refs #N` для промежуточных коммитов, `Closes #N` для коммита, который завершает тикет (тикет закроется, когда коммит попадёт в `main`). Номер тикета берётся из задачи, по которой идёт работа.
- `.github/workflows/hexlet-check.yml` не редактировать и не переименовывать.
- Доменные понятия называй терминами из [GLOSSARY.md](GLOSSARY.md), архитектурные решения лежат в `docs/adr/`.

## Agent skills

Набор [mattpocock/skills](https://github.com/mattpocock/skills) установлен в проект: `.claude/skills/`, версии в `skills-lock.json`. Вызывай скиллы по короткому имени (`/wayfinder`, `/implement-spec`), а не из глобального плагина `mattpocock-skills:*`. Обновление: `npx skills update -p`.

### Issue tracker

Задачи и спеки ведутся в GitHub Issues репозитория через `gh`. См. `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные пять меток: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Один контекст: `GLOSSARY.md` и `docs/adr/` в корне. См. `docs/agents/domain.md`.
