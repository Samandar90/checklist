# CI и деплой

## Проверки на каждый push

GitHub Actions (`.github/workflows/ci.yml`) запускается на каждый push в `main` и на каждый
pull request. Две параллельные задачи на Node 20 (версия из Dockerfile):

- **Server** — `npm ci`, `prisma generate`, накат всех миграций на пустую SQLite-базу,
  проверка, что `schema.prisma` совпадает с миграциями, `tsc`, `vitest`, сборка.
- **Client** — `npm ci`, `tsc`, `oxlint`, `vitest`, сборка Vite.

Результат виден у коммита на GitHub и в разделе Actions. Новый push в ту же ветку
отменяет ещё идущий прогон предыдущего.

## Деплой на Render

Сервис `hotel-branch-report-system` управляется через `render.yaml` (Blueprint).
В нём стоит `autoDeployTrigger: checksPass`: Render ждёт результата проверок GitHub
по коммиту и разворачивает его только при зелёном CI. Красный коммит в продакшен
не попадает, деплой просто не создаётся.

Миграции применяются при старте контейнера (`prisma migrate deploy` в Dockerfile),
поэтому проверка «схема совпадает с миграциями» в CI обязательна: правка схемы без
миграции роняет прогон до деплоя, а не базу после него.

## Если CI падает на установке зависимостей

Лок-файлы собираются на Windows и могут не содержать необязательные Linux-зависимости
(например, `@emnapi/runtime` для wasm-пакетов Tailwind). `npm ci` на Linux такой лок
отвергает. Пересоберите лок в контейнере `node:20`
(`npm install --package-lock-only`) или добавьте недостающую запись по данным
`npm view <пакет>@<версия> dist.integrity dist.tarball dependencies`.
