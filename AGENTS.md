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
- Бэкенд: «сейчас» берётся только из часов `now` в `AppContext`, данные — из хранилища в памяти `src/store.ts` (ADR-0002, методы синхронные). Ошибки отправляются только через `sendError` из `src/errors.ts`: статус следует из кода. `DEMO_DATA=false` выключает демо-типы встреч.
- Бэкенд: слоты считает чистая функция `computeSlots(eventType, bookings, now)` в `src/slots.ts`, правило пересечения `[start, end)` — `intervalsOverlap` там же. Её используют и ручка слотов, и проверка при создании бронирования: сервер принимает ровно то, что показывает. Время внутри — `Date`, в строку со смещением владельца `+05:00` его переводит `formatOwnerTime` (`src/ownerTime.ts`) на границе API.
- API-тесты бэкенда собирают приложение через `buildTestApp()` (`test/support/testApp.ts`: фиксированные часы, без демо-данных) и сверяют каждый ответ с контрактом через `expectResponseToMatchContract(response, operationId)` (`test/support/contract.ts`).
- Фронтенд вызывает API только через сгенерированный SDK, прямой `fetch` запрещён правилом oxlint. `baseUrl` задаётся в `src/api/client-config.ts`. В dev Vite проксирует `/api` на `127.0.0.1:3000`. Данные страниц грузит `useApiQuery` (`src/api/useApiQuery.ts`), текст ошибки даёт `errorMessage` (`src/api/errors.ts`).
- Фронтенд показывает время из строки ответа без пересчёта в пояс браузера: помощники в `src/ownerTime.ts`. Тесты фронтенда идут в поясе `America/Los_Angeles` (`vite.config.ts`), чтобы случайный пересчёт ронял их на любой машине.
- Страница бронирования (`src/pages/booking/`) — шаги на одном адресе: `BookingPage` хранит тип встречи, слоты и выбор гостя, шаги (`TimeSelectionStep`) только показывают их.
- Тесты фронтенда рендерят приложение по адресу (`renderApp`) и подменяют сеть MSW: `server.use(mockApi('<операция>', статус, тело))` из `src/test/mockApi.ts`, обработчики типизированы сгенерированными типами. Новая операция контракта добавляется в `ApiOperations` и `OPERATIONS` там же. Запрос без обработчика роняет тест.
- TypeScript закреплён на 6.x: в TS 7 нет JS API компилятора, и генератор Hey API на нём падает.

## Правила

- Коммиты пишутся по Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Хук commit-msg проверяет их через commitlint.
- Коммит ссылается на тикет GitHub Issues в футере сообщения: `Refs #N` для промежуточных коммитов, `Closes #N` для коммита, который завершает тикет (тикет закроется, когда коммит попадёт в `main`). Номер тикета берётся из задачи, по которой идёт работа.
- Релизы выпускает release-please (README.md, раздел «Релизы»). `CHANGELOG.md` и `.release-please-manifest.json` руками не править. Заголовок PR в `main` пишется по Conventional Commits: при squash-merge он становится коммитом и строкой changelog.
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
