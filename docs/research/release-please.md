# release-please для npm workspaces

Исследование к задаче [#9](https://github.com/EMIR1HUB/ai-for-developers-project-386/issues/9) карты [#1](https://github.com/EMIR1HUB/ai-for-developers-project-386/issues/1). Дата проверки: 2026-11-24.

Вопрос: как настроить release-please в этом репозитории (корневой приватный пакет `calendar` и workspaces `@calendar/api`, `@calendar/backend`, `@calendar/frontend`). Пакеты в npm не публикуются, приложение позже собирается в один Docker-образ.

## Коротко

Рекомендация: **один релиз на весь репозиторий** в manifest-режиме с единственным пакетом `"."` и `release-type: node`. Получаем один `CHANGELOG.md` в корне, один тег `vX.Y.Z` и одну версию для будущего Docker-образа. Начать можно с `GITHUB_TOKEN`, но для этого нужно включить в настройках репозитория «Allow GitHub Actions to create and approve pull requests» (сейчас выключено), а CI на release PR сам не запустится. Если проверки на release PR нужны, понадобится PAT или GitHub App токен. До внедрения нужно исключить `CHANGELOG.md` из oxfmt, иначе `mise run check` упадёт на main после первого релиза.

## Версии (проверено)

| Что                                 | Версия                                                                         | Как проверено                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `googleapis/release-please-action`  | `v5.0.0` (2026-04-22), плавающий тег `v5` указывает на тот же коммит `45996ed` | `gh api repos/googleapis/release-please-action/releases/latest`, `.../commits/v5` |
| release-please внутри action v5.0.0 | `17.6.0`                                                                       | `package-lock.json` action на теге `v5.0.0`, release notes v5.0.0                 |
| `release-please` (последний)        | `v17.11.2` (2026-08-24)                                                        | `gh api repos/googleapis/release-please/releases/latest`                          |

Ломающее изменение v5: action переведён на runtime `node24` ([release notes v5.0.0](https://github.com/googleapis/release-please-action/releases/tag/v5.0.0), `runs.using: node24` в [action.yml](https://github.com/googleapis/release-please-action/blob/v5.0.0/action.yml)). README action на теге v5.0.0 всё ещё показывает в примерах `@v4`, это просто не обновлённые примеры. Документы [manifest-releaser.md](https://github.com/googleapis/release-please/blob/v17.6.0/docs/manifest-releaser.md) на `v17.6.0` и `v17.11.2` совпадают побайтно, поэтому всё ниже верно для обеих версий.

## Как release-please работает

- На каждый push в целевую ветку action ищет Conventional Commits с прошлого релиза и держит открытым один release PR. Merge этого PR обновляет `CHANGELOG.md` и `package.json`, ставит тег и создаёт GitHub Release ([README release-please](https://github.com/googleapis/release-please/blob/v17.6.0/README.md#whats-a-release-pr)). В npm он ничего не публикует: «It does not handle publication to package managers».
- Версия: `fix:` даёт patch, `feat:` даёт minor, `!` или `BREAKING CHANGE` дают major ([README](https://github.com/googleapis/release-please/blob/v17.6.0/README.md#how-should-i-write-my-commits), логика в [`src/versioning-strategies/default.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/versioning-strategies/default.ts)). Пока версия ниже 1.0.0, `bump-minor-pre-major: true` превращает breaking в minor, `bump-patch-for-minor-pre-major: true` превращает feat в patch.
- Release PR появляется только при наличии «releasable units»: `feat`, `fix`, `deps`. Коммиты `chore` и `build` сами релиз не вызывают ([README, раздел «does not create a release PR»](https://github.com/googleapis/release-please/blob/v17.6.0/README.md#release-please-bot-does-not-create-a-release-pr-why)). В коде PR пропускается, если changelog пуст («No user facing commits found», [`src/strategies/base.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/strategies/base.ts)).
- Разделы changelog по умолчанию берутся из пресета `conventional-changelog-conventionalcommits@^6`: видны `feat`, `fix`, `perf`, `revert`, а `docs`, `style`, `chore`, `refactor`, `test`, `build`, `ci` скрыты (`writer-opts.js` пакета 6.1.0). Меняется через `changelog-sections`.
- Коммиты, которые не разбираются как Conventional Commits (например, ранние `Add README.md` или `Merge pull request #…`), молча пропускаются: парсер ловит исключение и пишет только debug-лог ([`src/commit.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/commit.ts)).
- Версию можно задать вручную футером `Release-As: x.y.z` в теле коммита. Сообщение уже влитого PR можно переписать блоком `BEGIN_COMMIT_OVERRIDE … END_COMMIT_OVERRIDE` в описании PR, но только при squash-merge ([README](https://github.com/googleapis/release-please/blob/v17.6.0/README.md#how-do-i-change-the-version-number)).
- Авторы советуют squash-merge: тогда changelog собирается из заголовков PR, а не из промежуточных коммитов ([README, «Linear git commit history»](https://github.com/googleapis/release-please/blob/v17.6.0/README.md#linear-git-commit-history-use-squash-merge)). В репозитории сейчас разрешены все три способа merge.

## Режимы action

У action два режима ([`src/index.ts` v5.0.0](https://github.com/googleapis/release-please-action/blob/v5.0.0/src/index.ts), `loadOrBuildManifest`):

1. **`release-type` задан во входах.** Конфигурация строится из входов, файлы конфигурации не читаются. Дополнительных опций нет: «allows for no further customization» ([README action](https://github.com/googleapis/release-please-action/blob/v5.0.0/README.md#basic-configuration)). Нет ни `bootstrap-sha`, ни `initial-version`. Без прошлых тегов первая версия будет `1.0.0` (`initialReleaseVersion()` в `base.ts`), и в changelog попадёт вся история в пределах `commit-search-depth` (по умолчанию 500).
2. **`release-type` не задан (manifest-режим, по умолчанию с v4).** Action читает `release-please-config.json` и `.release-please-manifest.json` из корня целевой ветки. Только здесь доступны `bootstrap-sha`, начальная версия, `include-component-in-tag`, `changelog-sections`, плагины.

Входы action v5.0.0 ([action.yml](https://github.com/googleapis/release-please-action/blob/v5.0.0/action.yml)): `token` (по умолчанию `github.token`), `release-type`, `path`, `target-branch`, `config-file`, `manifest-file`, `repo-url`, `github-api-url`, `github-graphql-url`, `fork`, `include-component-in-tag`, `proxy-server`, `skip-github-release`, `skip-github-pull-request`, `skip-labeling`, `changelog-host`, `versioning-strategy`, `release-as`. Выходы: `releases_created`, `paths_released`, `prs_created`, `pr`, `prs`; для корневого компонента ещё `release_created`, `tag_name`, `version`, `major`, `minor`, `patch`, `sha`, `body` и другие ([README, «Outputs»](https://github.com/googleapis/release-please-action/blob/v5.0.0/README.md#outputs)).

Вывод: даже для одного релиза нужен manifest-режим, чтобы стартовать с текущей `0.1.0` и не тянуть всю историю.

## Сравнение: один релиз или релиз на пакет

|                            | A. Один релиз (`"."`)                                                                                                                                                                                                        | B. Пакеты по отдельности (`api`, `backend`, `frontend` + `node-workspace`)                                                                                                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Changelog                  | Один `CHANGELOG.md` в корне                                                                                                                                                                                                  | `api/CHANGELOG.md`, `backend/CHANGELOG.md`, `frontend/CHANGELOG.md` (и корневой, если добавить `"."`)                                                                                                                                                                                                           |
| Теги                       | `v0.2.0` (с `include-component-in-tag: false`)                                                                                                                                                                               | `api-v0.2.0`, `backend-v0.2.0`, `frontend-v0.2.0`: scope `@calendar/` отбрасывается (`normalizeComponent` в [`src/strategies/node.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/strategies/node.ts))                                                                                       |
| Версия Docker-образа       | Одна, равна тегу                                                                                                                                                                                                             | Нет единой: нужен ещё `"."` или плагин `linked-versions`                                                                                                                                                                                                                                                        |
| Коммиты, затрагивающие всё | Одна запись                                                                                                                                                                                                                  | Коммит смотрится по путям ([customizing.md, «Subdirectories»](https://github.com/googleapis/release-please/blob/v17.6.0/docs/customizing.md#subdirectories-paths-in-a-repository)). Изменение контракта (`api/main.tsp` → `openapi.yaml` → маршруты и SDK) попадёт в три changelog                              |
| Изменения только в корне   | Попадают в релиз (`mise.toml`, `hk.pkl`, CI)                                                                                                                                                                                 | Без `"."` не попадают никуда                                                                                                                                                                                                                                                                                    |
| `package-lock.json`        | Node-стратегия обновляет `version` и `packages[""].version` корня ([`package-lock-json.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/updaters/node/package-lock-json.ts)), записи workspaces не трогает | Версии workspaces в корневом lock-файле обновляет только плагин `node-workspace` (`postProcessCandidates` в [`src/plugins/node-workspace.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/plugins/node-workspace.ts)). Без плагина `npm ci` может разойтись с `package.json` (не проверялось) |
| Зависимости между пакетами | Не важны                                                                                                                                                                                                                     | `node-workspace` патчит зависимых при обновлении зависимости ([manifest-releaser.md, «node-workspace»](https://github.com/googleapis/release-please/blob/v17.6.0/docs/manifest-releaser.md#node-workspace)). Здесь пакеты друг от друга не зависят, так что пользы нет                                          |
| Конфигурация               | 2 маленьких файла                                                                                                                                                                                                            | Больше ключей, плагин, возможно `exclude-paths` для `"."`                                                                                                                                                                                                                                                       |

Режим B нужен, когда пакеты публикуются и версионируются отдельно. У нас все пакеты `private`, наружу выходит один образ, поэтому B добавляет шум и не даёт пользы.

Минус A: версии в `api/`, `backend/`, `frontend/package.json` останутся `0.1.0`. Для приватных пакетов это ни на что не влияет. Их можно синхронизировать через `extra-files` с `type: json` и `jsonpath: $.version` ([customizing.md, «Updating arbitrary JSON files»](https://github.com/googleapis/release-please/blob/v17.6.0/docs/customizing.md#updating-arbitrary-json-files)), но тогда записи `packages["api"]` и другие в корневом `package-lock.json` останутся старыми. Предположение (не проверено): это может сломать `npm ci`. Не рекомендую.

## Bootstrap: начальная версия и стартовый коммит

Источник: [manifest-releaser.md, «Bootstrapping»](https://github.com/googleapis/release-please/blob/v17.6.0/docs/manifest-releaser.md#bootstrapping).

- **Начальная версия.** Запишите текущую версию в манифест: `{ ".": "0.1.0" }`. Release-please сочтёт её последней выпущенной и предложит следующую по коммитам. В коде есть лог «No latest release found for path … but a previous version … was specified in the manifest» ([`src/manifest.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/manifest.ts)). Альтернатива `initial-version` подходит для пакета без версии в манифесте. Документ утверждает, что по умолчанию для node предлагается `0.1.0`, но в коде `initialReleaseVersion()` возвращает `1.0.0`. Документ устарел, поэтому версию надо задать явно.
- **Стартовый коммит.** Ключ верхнего уровня `"bootstrap-sha": "<полный sha>"` ограничивает сбор коммитов. Граница исключающая: «choose one commit earlier than the first commit you want to include». После первого влитого release PR ключ игнорируется, его можно удалить. Нужен полный SHA.
- Отличие от `last-release-sha`: тот не игнорируется никогда и нужен только для починки после неудачного release PR.
- В истории сейчас 9 коммитов, из них Conventional только 5 последних, а `feat` один (`feat: add home page …`). Без `bootstrap-sha` первый changelog будет состоять из этой строки, и это тоже приемлемо. Чтобы начать с чистого листа, поставьте `bootstrap-sha` на SHA main прямо перед PR с настройкой release-please.

## Права и токен

### Права workflow

README action просит ([«Workflow Permissions»](https://github.com/googleapis/release-please-action/blob/v5.0.0/README.md#workflow-permissions)):

```yaml
permissions:
  contents: write # ветка release PR, коммиты, теги, релизы
  issues: write # метки autorelease: pending / tagged
  pull-requests: write # создание и обновление release PR
```

Документ manifest-releaser в примере указывает только `contents` и `pull-requests`. Метки PR создаются через Issues API, поэтому `issues: write` лучше оставить, как в README action.

В репозитории сейчас `default_workflow_permissions: read`, а `ci.yml` явно ставит `contents: read`. Ключ `permissions` в workflow расширяет права `GITHUB_TOKEN` сверх умолчания ([GitHub Docs: assigning permissions to jobs](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs)), поэтому `read` по умолчанию не мешает.

### Достаточно ли `GITHUB_TOKEN`

Да, при двух оговорках.

1. **Настройка репозитория.** Сейчас `can_approve_pull_request_reviews: false` (`gh api repos/EMIR1HUB/ai-for-developers-project-386/actions/permissions/workflow`), то есть «Allow GitHub Actions to create and approve pull requests» выключено, и `GITHUB_TOKEN` не может создать PR ([GitHub Docs: managing GitHub Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository); README action: «You may also need to set…»). Включает владелец: Settings → Actions → General → Workflow permissions.
2. **Workflows не запускаются от событий `GITHUB_TOKEN`.** GitHub Docs ([reusable `actions-do-not-trigger-workflows`](https://github.com/github/docs/blob/main/data/reusables/actions/actions-do-not-trigger-workflows.md), страница [Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)): события от `GITHUB_TOKEN` не создают новых запусков. Исключения:
   - `workflow_dispatch` и `repository_dispatch` запускаются всегда;
   - `pull_request` с типами `opened`, `synchronize`, `reopened` создаёт запуски в состоянии **approval-required**: человек с правом записи нажимает «Approve workflows to run». Это поведение задокументировано в мае 2026, флаг фичи помечен «currently rolling out on dotcom» ([`data/features/actions-github-token-pull-request-approval.yml`](https://github.com/github/docs/blob/main/data/features/actions-github-token-pull-request-approval.yml)).

   README action говорит о том же: теги и release PR, созданные с `GITHUB_TOKEN`, не запускают другие workflows, в том числе по событию `release` ([«Other Actions on Release Please PRs»](https://github.com/googleapis/release-please-action/blob/v5.0.0/README.md#other-actions-on-release-please-prs)).

Что это значит для нашего `ci.yml`. Он запускается только на `push` в любую ветку. Release-please пушит ветку `release-please--branches--main` (формат из [`src/util/branch-name.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/util/branch-name.ts)) через `GITHUB_TOKEN`, и такой `push` под исключения не подпадает. **На release PR CI не запустится.** После merge release PR пушит в main человек, поэтому CI на main отработает как обычно.

### Обходные пути

| Вариант                                                                                                                                                                                          | Плюсы                                                                                                                                                                                                                                                         | Минусы                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Оставить `GITHUB_TOKEN`, не гонять CI на release PR                                                                                                                                           | Ноль секретов. Release PR меняет только `CHANGELOG.md`, `package.json`, `package-lock.json` и манифест. CI на main всё равно запустится после merge                                                                                                           | Ошибка формата (см. oxfmt ниже) всплывёт уже на main. Защиты ветки main сейчас нет, merge ничто не блокирует                             |
| 1. Fine-grained PAT в секрете (`token: ${{ secrets.RELEASE_PLEASE_TOKEN }}`), права Contents, Pull requests, Issues: Read and write                                                              | Рекомендация README action. Push ветки запустит наш `ci.yml` без правок. Настройка «Allow GitHub Actions to create…» не нужна                                                                                                                                 | Токен личный: истекает и действует от имени владельца, PR будут от его имени                                                             |
| 2. GitHub App + `actions/create-github-app-token`                                                                                                                                                | Рекомендованный GitHub путь вместо PAT ([Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)). Токен короткоживущий, не привязан к человеку | Нужно создать App, хранить App ID и приватный ключ. Для учебного проекта избыточно                                                       |
| 3. Добавить в `ci.yml` триггер `pull_request`                                                                                                                                                    | Без секретов                                                                                                                                                                                                                                                  | Запуск ждёт ручного «Approve workflows to run» на каждое обновление PR, фича ещё раскатывается. Плюс дублирование с `push` на обычных PR |
| 4. `workflow_dispatch`: добавить его в `ci.yml`, а в release-workflow при `prs_created == 'true'` вызвать `gh workflow run ci.yml --ref release-please--branches--main` (нужно `actions: write`) | Без секретов, `workflow_dispatch` от `GITHUB_TOKEN` запускается всегда                                                                                                                                                                                        | Свой клей. Предположение (не проверено): статус запуска привяжется к head-коммиту и будет виден в PR                                     |

## Триггер workflow

Ветка `main`, событие `push`, как в примерах README action. `target-branch` не нужен, action берёт ветку по умолчанию. Пример (только для иллюстрации, файл в этой задаче не создаётся):

```yaml
name: release-please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  issues: write
  pull-requests: write

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - uses: googleapis/release-please-action@v5
        id: release
        # with:
        #   token: ${{ secrets.RELEASE_PLEASE_TOKEN }}  # вариант 1
```

Будущая публикация Docker-образа: релиз, созданный с `GITHUB_TOKEN`, не запустит workflow по `on: release`. Поэтому сборку образа удобнее поставить следующим job в этом же workflow с условием `if: needs.release-please.outputs.release_created == 'true'` (выходы описаны в [README action](https://github.com/googleapis/release-please-action/blob/v5.0.0/README.md#outputs)).

## Как это сочетается с commitlint

- Оба инструмента опираются на одну спецификацию. `@commitlint/config-conventional@21.2.4` использует `parserPreset: conventional-changelog-conventionalcommits`, release-please пишет changelog тем же пресетом.
- Разрешённые типы commitlint (`build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, `test`) не включают `deps`. Release-please считает `deps` releasable, но у нас такой коммит не пройдёт хук, это не проблема.
- Заголовок release PR по умолчанию `chore${scope}: release${component} ${version}`, то есть `chore(main): release 0.2.0` ([`src/util/pull-request-title.ts`](https://github.com/googleapis/release-please/blob/v17.6.0/src/util/pull-request-title.ts)). Он проходит правила commitlint (тип `chore`, subject в нижнем регистре, короче 100 символов).
- Хук `commit-msg` (hk → `commitlint --edit`) работает только локально. Коммиты, созданные на GitHub (squash/merge через UI, коммиты release-please через API), им не проверяются, а в CI commitlint не запускается. Поэтому при merge PR нужно, чтобы **заголовок PR** был Conventional (при squash он становится сообщением коммита). Сообщения `Merge pull request #…` release-please просто пропустит. Для чистого changelog лучше squash-merge.
- Ломающие изменения пишутся как `feat!:` или футером `BREAKING CHANGE:`, commitlint пропускает оба варианта.

## Что сломается при внедрении: oxfmt и CHANGELOG.md

Проверено. Глоб шага `oxfmt` в hk 2.13.0 включает `**/*.md` и `**/*.json` ([`pkl/builtins/oxfmt.pkl`](https://github.com/jdx/hk/blob/v2.13.0/pkl/builtins/oxfmt.pkl)). Я прогнал `oxfmt --check` (0.80.0) на образце CHANGELOG в формате release-please (маркеры `*`, двойная пустая строка перед `### Features`): **format issues found, exit 1**. Манифест `{ ".": "0.2.0" }` проверку прошёл.

Значит, после первого merge release PR `mise run check` на main упадёт. В том же PR, где добавляется release-please, нужно внести `CHANGELOG.md` в `ignorePatterns` в `.oxfmtrc.json` и в `exclude` шага `oxfmt` в `hk.pkl`. Так уже сделано для других сгенерированных файлов (`api/openapi.yaml`, `skills-lock.json`). Формат `package.json` после правки release-please не проверялся: updater сохраняет отступы исходного файла, но это стоит проверить на первом release PR.

## Рекомендация

**Вариант A, один релиз, manifest-режим.**

`release-please-config.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json",
  "release-type": "node",
  "include-component-in-tag": false,
  "bump-minor-pre-major": true,
  "bootstrap-sha": "<полный SHA main перед PR с настройкой>",
  "packages": {
    ".": {}
  }
}
```

`.release-please-manifest.json`:

```json
{
  ".": "0.1.0"
}
```

- `include-component-in-tag: false`: тег `v0.2.0` вместо `calendar-v0.2.0`. В manifest-режиме по умолчанию `true` (`base.ts`: `includeComponentInTag ?? true`), компонент берётся из `name` корневого `package.json`.
- `bump-minor-pre-major: true`: `feat!` до 1.0.0 не выпускает случайно `1.0.0`. Выход в 1.0 делается осознанно через `Release-As: 1.0.0`.
- Ключи `$schema`, `bootstrap-sha`, `include-component-in-tag`, `bump-minor-pre-major` разрешены схемой ([`schemas/config.json`](https://github.com/googleapis/release-please/blob/v17.6.0/schemas/config.json), `additionalProperties: false`).
- Action: `googleapis/release-please-action@v5`, `release-type` не указывать, триггер `push` в `main`, права `contents`, `issues`, `pull-requests: write`.
- Токен: для старта `GITHUB_TOKEN` (вариант 0). Владелец должен включить «Allow GitHub Actions to create and approve pull requests». Если CI на release PR станет нужен, перейти на fine-grained PAT (вариант 1): это одна строка `token:` и секрет, `ci.yml` менять не придётся.
- В том же PR: исключить `CHANGELOG.md` из oxfmt (`.oxfmtrc.json` и `hk.pkl`). Договориться о squash-merge с Conventional-заголовком PR.
- Документация при внедрении: README («Использование», «Стек»: как выходит релиз) и AGENTS.md (правило: `CHANGELOG.md` и манифест руками не править, заголовок PR в формате Conventional Commits).

Компромиссы рекомендации: версии workspace-пакетов остаются `0.1.0`. На release PR нет CI, пока используется `GITHUB_TOKEN`. В одном changelog смешаны фронтенд и бэкенд, но scope (`feat(frontend): …`) отображается в записях, и этого достаточно.

## Проверено и предположения

Проверено (открыто и прочитано): релизы и `action.yml`, `src/index.ts`, README action v5.0.0; README, `docs/manifest-releaser.md`, `docs/customizing.md`, `schemas/config.json` и исходники (`strategies/base.ts`, `strategies/node.ts`, `manifest.ts`, `commit.ts`, `updaters/node/package-lock-json.ts`, `plugins/node-workspace.ts`, `versioning-strategies/default.ts`, `util/branch-name.ts`, `util/pull-request-title.ts`) release-please v17.6.0; пресет `conventional-changelog-conventionalcommits@6.1.0`; исходники GitHub Docs (`github/docs`) о `GITHUB_TOKEN`; настройки репозитория через `gh api`; `@commitlint/config-conventional@21.2.4`; поведение `oxfmt --check` на образце CHANGELOG.

Предположения, не проверены запуском:

- синхронизация версий workspaces через `extra-files` может рассинхронизировать `package-lock.json`;
- статус запуска через `workflow_dispatch` будет виден в release PR;
- `package.json` после правки release-please пройдёт oxfmt.

Release-please в этом репозитории не запускался.
