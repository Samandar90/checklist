# LBL / Hotel Branch Report System — Технический аудит кодовой базы

**Тип:** Read-only discovery & audit (код не изменялся)
**Дата:** 2026-07-02
**Аудитор:** Lead Software Architect
**Объект:** реальная кодовая база `hotel-branch-report-system` (не спека PMS 1.2)

> Важная рамка: этот продукт — **система учёта бронирований и отчётности по филиалам отеля** (букинг-журнал + касса + расходы + аналитика), а не полноценный PMS из спеки на 50 глав. Аудит оценивает код против его *фактического* назначения; там, где уместно, отмечено расстояние до амбиций спеки.

---

## Фаза 1 — Обзор проекта

### Структура

```
/                    корневой package.json (concurrently: dev-оркестрация клиент+сервер)
├── client/          React SPA (Vite)
│   └── src/         24 страницы, 18 компонентов + 17 ui-примитивов, 23 хука, 3 контекста
├── server/          Express API (TypeScript)
│   ├── src/         18 файлов: index, auth, middleware, validation, audit, backup + 11 роутеров
│   └── prisma/      schema (9 моделей), 10 миграций, dev.db (SQLite), backups/
├── docs/            архитектурные документы (ревью PMS 1.2, ADR-001..015, глава 13)
├── Dockerfile       multi-stage: client build → server build → runtime (node:20-alpine)
├── render.yaml      деплой на Render (Docker, диск 1GB, SQLite на /data)
└── .claude/         локальные настройки; CI (.github) ОТСУТСТВУЕТ, тестов НЕТ
```

### Технологии

| Слой | Стек | Версии |
|---|---|---|
| Frontend | React 19, TypeScript ~6.0, Vite 8, Tailwind CSS 4, Radix UI (shadcn-стиль), TanStack Query 5, React Router 7, react-hook-form + zod, recharts, framer-motion, sonner, axios, date-fns | современные, свежие |
| Backend | Node 20, Express 4, TypeScript 5.6, Prisma 5.20, zod, bcryptjs, jsonwebtoken, helmet, express-rate-limit, cors | адекватные |
| БД | **SQLite** (dev и prod; prod — файл на Render-диске) | риск, см. Фазу 4 |
| Линт | oxlint (клиент); сервер — только tsc | тестов нет |
| Деплой | Docker multi-stage → Render (starter, health-check `/api/health`, `prisma migrate deploy` на старте) | работает |

### Архитектурный стиль

- **Backend:** маршрут → (zod-валидация) → Prisma → ответ; единый error handler (ZodError → 400, P2002 → 409, P2025 → 404, P2003 → 409); аудит-запись при каждой мутации. Слоя сервисов нет — логика живёт в роутерах (при 2 100 строках это пока приемлемо).
- **Frontend:** feature-страницы + хуки на TanStack Query (`useReports`, `useBranches`, …) + axios-клиент с токен-интерцептором. Ленивые импорты всех страниц. Состояние: серверное — Query, клиентское — 3 контекста (Auth/Branch/Theme) + localStorage-хуки (preferences, saved views, favorites, housekeeping).
- SPA раздаётся самим Express (`server/public` ← client/dist), SPA-fallback на `index.html`.

---

## Фаза 2 — Модули

| # | Модуль | Назначение | Статус | Таблицы | API | Страницы | Чего не хватает / долг |
|---|---|---|---|---|---|---|---|
| 1 | **Аутентификация** | вход, сессия, смена пароля | Работает | User | `/auth/*` | LoginPage, ChangePasswordDialog | нет refresh/logout на сервере, нет сброса пароля; **ADMIN не может сменить свой пароль** (endpoint только для SUPER_ADMIN) |
| 2 | **Филиалы** | CRUD филиалов | Готов | Branch | `/branches` | BranchesPage | каскадное удаление сносит все данные филиала |
| 3 | **Администраторы** | персонал + учётки | Готов | Admin, User | `/admins` | AdminsPage | нет деактивации (только delete), нет своих ролей |
| 4 | **Номера** | справочник комнат | Готов (базово) | Room | `/rooms` | RoomsPage | нет уникальности номера в филиале, нет вместимости/статуса в БД |
| 5 | **Источники** | справочник каналов | Готов | BookingSource | `/sources` | SourcesPage | — |
| 6 | **Бронирования** («отчёты») | ядро: заезды, оплаты, статусы | Работает | MonthlyReport | `/reports` (9 endpoint'ов) | ReportsPage, MyReportsPage, BookingDialog/Wizard/Drawer | **нет индексов**, нет пагинации (findMany всего), деньги Float; защита от двойного бронирования добавлена только что; bulk MOVE_ROOM не проверяет пересечения |
| 7 | **Шахматка** | календарь занятости, создание броней | Работает | — (читает reports) | `/reports/calendar` | CalendarPage (1 195 строк) | самый большой файл проекта; 2 lint-warning'а; вся раскладка на клиенте |
| 8 | **Расходы** | учёт расходов | Готов | Expense | `/expenses` | ExpensesPage, MyExpensesPage | категории захардкожены |
| 9 | **Касса (смены)** | открытие/закрытие смены, расчёт ожидаемой наличности | Работает | CashShift | `/cash-shifts` | CashRegisterPage | ожидаемая сумма считается по `createdAt` броней/расходов, а не по бизнес-дате — брони «задним числом» ломают расчёт смены; нет инкассаций/переводов |
| 10 | **Должники** | брони с долгом | Готов | — (derived) | `/reports/debtors`, `/:id/settle` | DebtorsPage | погашение — только полное, без частичных доплат |
| 11 | **Дашборд** | KPI, графики, сравнение периодов | Работает | — (агрегация) | `/dashboard` | DashboardPage | вся агрегация в JS по полной выборке — деградирует с ростом данных |
| 12 | **Аналитика / Финцентр** | углублённые разрезы | Работает | — | — (клиент считает из `/reports`) | AnalyticsPage, FinanceCenterPage | дублирует вычисления дашборда на клиенте; расхождения цифр возможны |
| 13 | **Гости** | список гостей | **Суррогат** | нет таблицы | нет | GuestsPage | собирается на клиенте из guestName броней; нет дедупликации, телефонов, истории |
| 14 | **Уборка** | статусы комнат | **Суррогат** | нет таблицы | нет | HousekeepingPage | хранится в localStorage браузера (честно отмечено в коде) — не синхронизируется между устройствами |
| 15 | **Умное распределение** | подбор комнат | Прототип | — | — | SmartAssignPage + lib/roomAssignment | клиентская эвристика, не бронирует атомарно |
| 16 | **Журнал изменений** | аудит действий | Работает | AuditLog | `/audit` | AuditPage | **не пишутся события входа/выхода/смены пароля**; записи технически изменяемы (нет защиты на уровне БД) |
| 17 | **Резервные копии** | снапшоты SQLite | Работает | — | `/backup` | BackupPage | `VACUUM INTO` + расписание 24ч + скачивание; **копии лежат на том же диске, что и база** |
| 18 | **UX-обвязка** | Command Palette, уведомления, хронология, воркспейсы, избранное, saved views, тема | Работает | — | — | CommandPalette, NotificationCenter, Timeline, Workspace, StaffWorkspace | уведомления derived на клиенте; всё в localStorage |

---

## Фаза 3 — Анализ архитектуры

### Сильные стороны

1. **Последовательность.** Все CRUD-роутеры следуют одному образцу: zod → Prisma → audit → единый формат ошибок. Читается легко, новый модуль пишется по шаблону.
2. **Валидация везде.** Ни один мутирующий endpoint не принимает тело без zod-схемы; бизнес-проверки (checkOut > date, частичная оплата < цены) в схемах.
3. **Аудит с диффами полей** («было → стало», русские подписи полей) — редкая зрелость для проекта такого размера.
4. **Разумная безопасность базового уровня:** helmet, CORS-allowlist, rate limit на логин, bcrypt(10), генерация случайного пароля супер-админа в prod с одноразовым выводом в лог, `trust proxy` за Render.
5. **Фронтенд-дисциплина:** TanStack Query (не самописный кэш), ленивые страницы, обработка ошибок через `getErrorMessage` + тосты, скелетоны/empty states, тёмная тема, командная палитра, шорткаты.
6. **Деплой воспроизводим:** multi-stage Docker, `migrate deploy` на старте, health-check.

### Слабости и риски

| Категория | Находка | Серьёзность |
|---|---|---|
| **Данные** | SQLite в production: один писатель, блокировки при конкурентной записи, файл на 1GB-диске Render | Высокая (при росте) |
| **Данные** | Деньги — `Float` (price, paidAmount, amount, суммы касс): накопление ошибок округления в долгах и сменах | Высокая |
| **Данные** | Каскадное удаление везде: удаление филиала молча уничтожает все его брони/расходы/смены | Высокая |
| **Данные** | Нет индексов на MonthlyReport/Expense; нет уникальности Room(branchId, roomNumber) | Средняя |
| **Безопасность** | **`POST /api/admin/purge`** — «временный» endpoint полного стирания операционных данных остался в коде (за SUPER_ADMIN, но одна кнопка = вся история) | **Критическая** |
| **Безопасность** | JWT на 7 дней без отзыва + токен в localStorage (XSS-доступен); logout — только на клиенте | Высокая |
| **Безопасность** | `JWT_SECRET` имеет небезопасный дефолт; в prod ничего не заставляет его задать (Render генерирует — но код не падает без него) | Средняя |
| **Безопасность** | CSP полностью выключен (helmet `contentSecurityPolicy: false`) | Средняя |
| **Безопасность** | Аудит не пишет auth-события (вход, неудачные попытки, смена пароля) | Средняя |
| **Масштаб** | `/reports` без пагинации + агрегации дашборда/summary в JS по полной выборке | Средняя (растёт со временем) |
| **Целостность** | Расчёт смены кассы по `createdAt` вместо даты операции; bulk MOVE_ROOM без проверки пересечений | Средняя |
| **Качество** | **Тестов нет вообще. CI нет.** Единственные ворота — tsc и oxlint вручную | Высокая |
| **DR** | Бэкапы на том же диске, что и база: отказ диска = потеря и базы, и копий | Высокая |

### Запахи кода / дубли / мёртвый код

- `buildWhere()` продублирован в reports/expenses/cashShifts (3 копии одной идеи); `money()` — 3 копии; статусные подписи броней дублируются клиент/сервер.
- `CalendarPage.tsx` (1 195 строк) и `ReportsPage.tsx` (1 055) — кандидаты на распил; в CalendarPage два реальных lint-warning'а (`exhaustive-deps`, `no-unused-expressions` на строке 642 — потенциальный баг).
- Мёртвого кода почти нет (проверены все компоненты — используются); один неиспользуемый импорт `useState` в ChangePasswordDialog.
- Циклических зависимостей не обнаружено; абстракции адекватны размеру.

---

## Фаза 4 — База данных (Prisma, SQLite)

### Модели (9)

| Модель | Ключевые поля | Связи | Замечания |
|---|---|---|---|
| Branch | name | → admins, rooms, reports, expenses, cashShifts | нет уникальности name |
| Admin | fullName, phone, branchId | ← Branch (Cascade); → user 1:1 | |
| User | username @unique, passwordHash, role (String), adminId @unique | ← Admin (Cascade) | роль — строка, не enum |
| Room | roomNumber, type?, branchId | ← Branch (Cascade) | **нет @@unique([branchId, roomNumber])**, нет индекса branchId |
| BookingSource | name @unique | | |
| MonthlyReport | date, checkOut?, guestName?, price Float, currency, paymentMethod, paymentStatus, status (String), paidAmount?, notes? | ← Branch/Admin/Room/Source (**все Cascade**) | **нет ни одного индекса**; статусы/методы оплаты — строки |
| Expense | date, category, amount Float, currency | ← Branch (Cascade), Admin (SetNull) | нет индексов |
| CashShift | openedAt, closedAt?, opening/closing/expected Float, status | ← Branch/Admin (Cascade) | есть @@index(branchId, adminId, status) ✓ |
| AuditLog | actor*, action, entity, entityId?, summary, changes(JSON-строка) | нет FK | @@index(createdAt, entity) ✓ |

### Отсутствующие индексы (главная таблица — MonthlyReport, все горячие запросы по ней)

- `@@index([branchId, date])` — календарь, дашборд, отчёты
- `@@index([roomId, date])` — проверка пересечений (моя новая проверка сканирует по roomId)
- `@@index([adminId, date])` — «мои отчёты», касса
- `@@index([paymentStatus])` — должники; `Expense: @@index([branchId, date])`

### Потенциальные проблемы

1. Float для денег (см. Фазу 3). 2. Каскады без Restrict. 3. Отсутствие enum'ов (ограничение SQLite; при переходе на Postgres — native enums). 4. `changes` в AuditLog — JSON-строка без схемы. 5. Нет soft delete — удаление брони = потеря истории (аудит остаётся, но данных нет). 6. SQLite не позволит exclusion constraint — защита от двойного бронирования останется на уровне приложения до Postgres.

---

## Фаза 5 — Полный реестр API (34 endpoint'а)

| Метод | Маршрут | Назначение | Auth | Валидация | Статус |
|---|---|---|---|---|---|
| GET | `/api/health` | health-check | нет | — | ✅ |
| POST | `/api/auth/login` | вход (JWT 7д) | rate-limit 20/15мин | loginSchema | ✅ |
| GET | `/api/auth/me` | текущий пользователь | Bearer | — | ✅ |
| POST | `/api/auth/change-password` | смена пароля | Bearer + **SUPER_ADMIN** | changePasswordSchema | ⚠️ ADMIN не может сменить свой |
| GET | `/api/branches` | список + счётчики | SUPER_ADMIN | — | ✅ |
| POST/PUT/DELETE | `/api/branches[/:id]` | CRUD | SUPER_ADMIN | branchSchema | ✅ |
| GET | `/api/admins` | список | SUPER_ADMIN | — | ✅ |
| POST/PUT/DELETE | `/api/admins[/:id]` | CRUD + учётка (транзакция) | SUPER_ADMIN | adminCreate/UpdateSchema | ✅ |
| GET | `/api/rooms` | список (ADMIN — свой филиал) | Bearer | — | ✅ |
| POST/PUT/DELETE | `/api/rooms[/:id]` | CRUD | SUPER_ADMIN | roomSchema | ✅ |
| GET | `/api/sources` | список | Bearer | — | ✅ |
| POST/PUT/DELETE | `/api/sources[/:id]` | CRUD | SUPER_ADMIN | sourceSchema | ✅ |
| GET | `/api/reports` | список броней (фильтры; ADMIN — только свои) | Bearer | — | ⚠️ без пагинации |
| GET | `/api/reports/summary` | агрегаты | SUPER_ADMIN | — | ✅ |
| GET | `/api/reports/debtors` | должники | SUPER_ADMIN | — | ✅ |
| GET | `/api/reports/calendar` | комнаты+брони на диапазон | Bearer | — | ✅ |
| POST | `/api/reports` | создать бронь | Bearer (ADMIN — от себя) | reportSchema + **проверка пересечений (409)** | ✅ |
| PUT | `/api/reports/:id` | изменить бронь | Bearer + владелец | reportSchema + пересечения | ✅ |
| PATCH | `/api/reports/:id/status` | смена статуса | Bearer + владелец | вручную (enum-проверка) | ✅ |
| POST | `/api/reports/:id/settle` | погасить долг | SUPER_ADMIN | — | ✅ |
| POST | `/api/reports/bulk` | массовые DELETE / MOVE_ROOM | Bearer + владелец | вручную | ⚠️ MOVE_ROOM без проверки пересечений |
| DELETE | `/api/reports/:id` | удалить | Bearer + владелец | — | ✅ |
| GET/POST | `/api/expenses[/]` | список/создание | Bearer (ADMIN — свои) | expenseSchema | ✅ |
| PUT/DELETE | `/api/expenses/:id` | изменить/удалить | Bearer + владелец | expenseSchema | ✅ |
| GET | `/api/cash-shifts` | список смен | Bearer (ADMIN — свои) | — | ✅ |
| GET | `/api/cash-shifts/active` | активная смена + расчёт | ADMIN | — | ✅ |
| POST | `/api/cash-shifts` | открыть смену | ADMIN | cashShiftOpenSchema | ✅ |
| PUT | `/api/cash-shifts/:id/close` | закрыть с расчётом | владелец | cashShiftCloseSchema | ⚠️ расчёт по createdAt |
| GET | `/api/audit` | журнал (фильтры, пагинация 20) | SUPER_ADMIN | — | ✅ |
| GET/POST | `/api/backup` | список/создать снапшот | SUPER_ADMIN | — | ✅ |
| GET | `/api/backup/download` | снапшот + скачать | SUPER_ADMIN | — | ✅ |
| GET | `/api/dashboard` | KPI/серии/разрезы | SUPER_ADMIN | — | ✅ |
| POST | `/api/admin/purge` | **СТЕРЕТЬ операционные данные** | SUPER_ADMIN | — | 🔴 удалить из кода |

---

## Фаза 6 — Frontend

- **Страницы (24):** перечислены в Фазе 2. Роутинг по ролям корректный: `/staff, /my-*` — ADMIN; управление — SUPER_ADMIN; календарь/касса/распределение — оба.
- **Layout:** сайдбар с секциями (nav.ts), BranchSwitcher, NotificationCenter, CommandPalette (Ctrl+K), ShortcutsDialog, PreferencesDialog (плотность), смена темы.
- **Формы:** react-hook-form + zod-резолверы в диалогах броней; BookingWizard — пошаговое создание; CurrencyInput — свой примитив.
- **Таблицы:** свой ui/table + useTableControls (сортировка/фильтры) + useColumnVisibility + pagination; экспорт CSV (lib/csv).
- **Состояние:** TanStack Query для сервера; localStorage для UX (избранное, saved views, недавние страницы/поиски, плотность, уборка).
- **Тема:** dark/light через ThemeContext + CSS-переменные; index.css 266 строк токенов.
- **Адаптивность:** есть (sidebar сворачивается), полноценно на телефоне не проверялась в этом аудите.
- **Недостающие экраны:** профиль пользователя/смена пароля для ADMIN, настройки системы, карточка гостя, реальная уборка, страница уведомлений, восстановление пароля.

---

## Фаза 7 — Аутентификация (точный статус)

| Возможность | Статус |
|---|---|
| Login | ✅ username+password, uniform-ошибка, rate limit 20/15мин |
| Logout | ⚠️ только клиент (удаление токена из localStorage); сервер токен не отзывает |
| Refresh Token | ❌ нет; access-JWT живёт 7 дней |
| JWT | ✅ HS256, payload: sub/role/adminId/branchId; секрет с небезопасным dev-дефолтом |
| RBAC | ✅ 2 роли (SUPER_ADMIN/ADMIN), проверка на роутере + владение записями (adminId) |
| Гранулярные permissions | ❌ нет (только роли) |
| Sessions / device management | ❌ нет |
| Forgot / Reset password | ❌ нет (email-инфраструктуры нет вообще) |
| Change password | ⚠️ есть, но **только SUPER_ADMIN**; ADMIN меняет пароль только через супер-админа |
| Email verification | ❌ нет |
| Audit auth-событий | ❌ вход/выход/смена пароля не журналируются |
| Rate limiting | ⚠️ только `/api/auth`; мутации не лимитируются |
| Хранение токена (клиент) | ⚠️ localStorage (XSS-доступен); interceptor на 401 → redirect /login |

---

## Фаза 8 — Инфраструктура

- **Docker:** ✅ multi-stage, prod-образ без dev-зависимостей, prisma generate на этапе сборки. Docker Compose — нет (не нужен при SQLite).
- **Render:** ✅ web-сервис + диск 1GB (`/data/prod.db`), JWT_SECRET генерируется, SUPER_ADMIN_PASSWORD — вручную. Миграции на старте контейнера.
- **Env:** `.env.example` полный и документированный ✓; `.env` в git не попал ✓ (проверено — в .gitignore).
- **Redis / PostgreSQL:** нет (SQLite единственное хранилище).
- **Логирование:** только console.log/console.error; структурных логов, request-логов, correlation id — нет.
- **Uploads / файлы:** нет вообще.
- **Кэширование:** только TanStack Query на клиенте.
- **Мониторинг/алерты:** нет (только health-check Render).
- **Бэкапы:** SQLite `VACUUM INTO` при старте + каждые 24ч, хранится 14 копий, скачивание из UI. **Хранение на том же диске** — при потере диска гибнет всё.

---

## Фаза 9 — Сборка и запуск (наблюдение, без исправлений)

| Проверка | Результат |
|---|---|
| `client: npm run build` (tsc -b + vite) | ✅ успех за 502мс; предупреждение: чанк `index` 586KB (gzip 177KB) и чанк с recharts 362KB (gzip 97KB) — выше лимита 500KB |
| `server: tsc --noEmit` | ✅ 0 ошибок |
| Запуск сервера (`tsx src/index.ts`) | ✅ поднялся, сид-данные, бэкап при старте создан |
| `GET /api/health` | ✅ `{"ok":true}` |
| Login с неверным паролем | ✅ 401 «Неверный логин или пароль» |
| Защищённый endpoint без токена | ✅ 401 «Не авторизован» |
| oxlint (клиент) | ⚠️ 6 предупреждений: 3× react-refresh в контекстах (безвредно), неиспользуемый импорт (ChangePasswordDialog), `exhaustive-deps` и `no-unused-expressions` в CalendarPage (строки 205, 642 — стоит посмотреть) |
| Runtime-ошибки | не обнаружены |
| Отсутствующие env | нет блокирующих: всё имеет дефолты (что само по себе риск для JWT_SECRET в проде вне Render) |
| Битые маршруты/страницы | не обнаружены (все 24 страницы собираются и маршрутизируются) |

---

## Фаза 10 — Мастер-отчёт

### Готовность по модулям

```
Аутентификация ............. 65%   (нет refresh/logout/reset; ADMIN без смены пароля)
Авторизация (RBAC) ......... 60%   (2 роли; нет гранулярных прав)
Филиалы .................... 95%
Администраторы ............. 90%
Номера ..................... 70%   (нет уникальности/статусов/вместимости)
Источники .................. 95%
Бронирования ............... 75%   (ядро работает; нет пагинации/индексов; Float)
Шахматка (календарь) ....... 80%
Расходы .................... 90%
Касса (смены) .............. 75%   (расчёт по createdAt — некорректен для задним числом)
Должники ................... 85%
Дашборд .................... 80%
Аналитика / Финцентр ....... 60%   (клиентские вычисления, дублируют сервер)
Гости ...................... 25%   (derived, без таблицы)
Уборка ..................... 15%   (localStorage)
Умное распределение ........ 40%   (клиентская эвристика)
Журнал изменений ........... 70%   (нет auth-событий, записи изменяемы)
Резервные копии ............ 60%   (на том же диске)
Уведомления ................ 30%   (derived на клиенте)
Тесты ...................... 0%
CI/CD ...................... 20%   (Docker+Render есть; pipeline нет)
Мониторинг/логирование ..... 5%
──────────────────────────────────
ИНТЕГРАЛЬНО (против фактического
назначения продукта) ....... ~62%
```

### Сломанная функциональность

Строго сломанного нет — всё собирается и работает. «Жёлтая зона»: расчёт кассовой смены при бронях задним числом; bulk-перенос комнат в обход проверки пересечений; `no-unused-expressions` в CalendarPage:642 (возможный неработающий вызов).

### Приоритетные исправления (High priority)

1. 🔴 Удалить `POST /api/admin/purge`.
2. 🔴 Разрешить ADMIN менять собственный пароль.
3. 🔴 Индексы на MonthlyReport/Expense + `@@unique([branchId, roomNumber])` на Room.
4. 🟠 Заменить каскадные удаления Branch/Room/Admin → Restrict (защита истории).
5. 🟠 Деньги: Float → Int (UZS не имеет копеек — целые суммы безопасны и просты).
6. 🟠 Аудит auth-событий; журналирование неудачных входов.
7. 🟠 Бэкапы за пределы диска (S3/Backblaze/любое object storage).
8. 🟠 Проверка пересечений в bulk MOVE_ROOM (переиспользовать `findRoomConflict`).
9. 🟡 Пагинация `/api/reports`; лимиты на выборки дашборда.
10. 🟡 Тесты (vitest + supertest): пересечения броней, закрытие смены, authz-матрица ролей.
11. 🟡 CI (GitHub Actions): tsc + oxlint + тесты + build на каждый push.
12. 🟡 CalendarPage: исправить два lint-warning'а, распилить файл.

### Рекомендуемый порядок реализации (нумерованный роадмап до production-ready)

**Этап A — безопасность и целостность (1–2 дня работы)**
1. Удалить purge-endpoint.
2. Смена пароля для ADMIN (+ аудит-событие).
3. Миграция: индексы + уникальность комнат + Restrict-каскады.
4. Аудит auth-событий; fail-fast без JWT_SECRET в production.
5. Фикс bulk MOVE_ROOM (проверка пересечений).

**Этап B — деньги и касса (2–3 дня)**
6. Миграция Float → Int для всех денежных полей + адаптация UI-форматирования.
7. Расчёт смены по дате операции (или фиксация shiftId у операций — правильнее).
8. Частичное погашение долга (доплаты вместо только полного settle).

**Этап C — надёжность (2–3 дня)**
9. Vitest + supertest; тесты на пересечения, кассу, RBAC (10–15 тестов покрывают 80% риска).
10. GitHub Actions CI.
11. Выгрузка бэкапов в object storage + проверка восстановления.
12. Структурные логи (pino) + Sentry (клиент и сервер).

**Этап D — доращивание продукта (по потребности бизнеса)**
13. Пагинация отчётов; серверные агрегаты для Аналитики/Финцентра (одна точка правды с дашбордом).
14. Таблица Guest (дедуп по телефону) → реальная страница гостей.
15. Таблица HousekeepingStatus → реальная уборка (сейчас честный localStorage-прототип).
16. Refresh-токены + серверный logout (по мере роста числа пользователей).
17. Переход SQLite → PostgreSQL (Render Postgres): когда появится >1 филиала с активной конкурентной записью или потребуется exclusion constraint для броней. Prisma-схема переносима; это осознанно отложенный шаг, не блокер сегодняшнего масштаба.
18. Распил CalendarPage/ReportsPage на компоненты.

**Этап E — направление PMS-спеки (только если бизнес этого требует)**
19. Далее действует roadmap из PMS-1.2-Architecture-Review.md и ADR-001…015 (мультиарендность, ledger, night audit) — это отдельный продукт-трек, а не доводка текущего.

---

*Отчёт составлен по результатам полного чтения серверного кода (18/18 файлов), схемы БД, миграций, инфраструктурных файлов, ключевых файлов клиента (роутинг, API-слой, контексты, хуки, крупнейшие страницы), успешной сборки клиента и сервера и live-проверки API. Код в ходе аудита не изменялся.*
