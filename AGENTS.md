# AGENTS.md

Сервис записи на звонок (упрощённый Cal.com). Сценарий, требования и правила бронирования описаны в [README.md](README.md).

## Команды

Окружение и задачи описаны в `mise.toml`. Команды запуска, проверок и генерации собраны в таблице README.md, раздел «Использование». Главное:

- `mise run check`: линтеры, типы и тесты, его же запускает CI. Перед коммитом должен быть зелёным.
- `mise run dev`: бэкенд на `:3000` и фронтенд на `:5173` фоновыми daemons (`mise daemons ls | logs | stop`).
- Один тест: `npm test -w @calendar/backend -- test/health.test.ts` или `npm test -w @calendar/frontend -- -t "<имя теста>"`.

## Устройство

- Источник правды для API: `api/main.tsp`. `api/openapi.yaml` генерируется из него и коммитится, руками его не правят. После изменения контракта выполни `mise run generate` и закоммить `openapi.yaml`.
- `backend/src/generated/` и `frontend/src/api/generated/` генерирует Hey API из `openapi.yaml`, в git их нет. Задачи `typecheck`, `test` и `dev` перегенерируют их сами.
- Бэкенд: Node запускает `.ts` без сборки (type stripping), поэтому относительные импорты пишутся с расширением `.ts`. Маршруты Fastify пишутся вручную по контракту, типы запросов и ответов берутся из `generated`. `buildApp()` в `src/app.ts` нужен тестам (`app.inject`), а `src/server.ts` только слушает порт.
- Фронтенд вызывает API только через сгенерированный SDK. `baseUrl` задаётся в `src/api/client-config.ts`. В dev Vite проксирует `/api` на `127.0.0.1:3000`.
- TypeScript закреплён на 6.x: в TS 7 нет JS API компилятора, и генератор Hey API на нём падает.

## Правила

- Коммиты пишутся по Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`). Хук commit-msg проверяет их через commitlint.
- `.github/workflows/hexlet-check.yml` не редактировать и не переименовывать.
- Доменные понятия называй терминами из [GLOSSARY.md](GLOSSARY.md), архитектурные решения лежат в `docs/adr/`.

## Agent skills

### Issue tracker

Задачи и спеки ведутся в GitHub Issues репозитория через `gh`. См. `docs/agents/issue-tracker.md`.

### Triage labels

Стандартные пять меток: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. См. `docs/agents/triage-labels.md`.

### Domain docs

Один контекст: `GLOSSARY.md` и `docs/adr/` в корне. См. `docs/agents/domain.md`.
