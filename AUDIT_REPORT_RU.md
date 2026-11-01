# ПОЛНЫЙ ТЕХНИЧЕСКИЙ АУДИТ ПЛАТФОРМЫ UZBOOK (`uzbook.online`)

**Дата аудита:** 1 ноября 2026 г.  
**Репозиторий:** `https://github.com/u2kdev/uzbook` (локальная рабочая копия `d:\uzbook`, коммит `b52ef7e`)  
**Роли аудитора:** Senior Software Architect, Principal Full-Stack Engineer, DevSecOps Engineer, QA Automation Engineer, Application Security Auditor  
**Режим работы:** Строгий Audit-Only (без внесения изменений в исходный код проекта)

---

## A. Резюме для руководства (Executive Summary)

### 1. Общее состояние проекта
**UzBook** — это мультитенантная B2B2C SaaS-платформа онлайн-записи, CRM и конструктора мини-лендингов для салонов красоты, барбершопов и клиник в Узбекистане с партнерской сетью провайдеров (`PROVIDER`). Архитектурно проект построен на современном монолитном стеке (**Next.js 16.2.4 App Router**, **React 19**, **TypeScript 5**, **Drizzle ORM**, **PostgreSQL 16**, **Tailwind CSS 4**) и обладает хорошо продуманной доменной моделью: поддерживаются гибкое расписание, исключения в графике мастеров, защита от двойного бронирования (через транзакции с `pg_advisory_xact_lock`), система ролей (`OWNER`, `ADMIN`, `SUPPORT`, `PROVIDER`), аудит-логи и кастомизируемый конструктор секций страницы салона.

Однако **на текущий момент проект НЕ ГОТОВ к запуску в коммерческий продакшен** из-за трех критических блокеров уровня **P0** и ряда серьезных архитектурных, финансовых и защитных уязвимостей уровня **P1**.

### 2. Оценка готовности к продакшену
- **Интегральная оценка готовности:** **56 / 100 (Стадия: Late Beta / Pre-Production — требуется устранение P0/P1 блокеров)**.
- В текущем виде (коммит `b52ef7e`) приложение **падает с ошибкой HTTP 500 при сборке и выполнении в Next.js 16 Turbopack**, а при приеме онлайн-платежей (Payme, Click, Crypto) **теряет кастомные цены и 60% комиссионных выплат провайдерам**.

### 3. Главные критические проблемы (Top Blockers)
1. **[P0 — Падение всего приложения в Runtime / Build Failure]:** В файле серверных экшенов `src/app/(auth)/actions.ts:44` экспортирована синхронная вспомогательная функция `export function normalizeAuthPhone(raw: string): string`. В Next.js 16 (App Router / Turbopack) любой модуль с директивой `"use server"` обязан экспортировать **только `async` функции**. Из-за этого компилятор Next.js выбрасывает фатальную ошибку `Error: Server Actions must be async functions`, и абсолютно все маршруты сайта (включая `/`, `/login`, `/become-provider`, `/api/health`) возвращают **HTTP 500**. При этом `tsc --noEmit` проходит без ошибок, что скрыло проблему при статической проверке типов.
2. **[P0 — Финансовая ошибка: Потеря кастомной цены и комиссии провайдера (60%) при онлайн-оплате]:** Когда провайдер (`PROVIDER`) подключает салон и устанавливает ему индивидуальную цену (`businesses.customPriceUzs`), лимит сотрудников (`customStaffLimit`) и лимит клиентов (`customClientLimit`), страница биллинга владельца салона (`/dashboard/billing`) и платежный сервис (`createPayment`, `completePayment` в `src/server/payments/service.ts`) **полностью игнорируют эти настройки**. При оплате через Payme, Click, Crypto или Demo с клиента списывается стандартная цена тарифа (`99 000 / 199 000 / 399 000 UZS`), а созданная запись в таблице `subscriptions` сохраняется с `providerId = null` и `providerPayoutAmount = 0`. В результате провайдер получает **0 UZS вместо своих 60%**, а клиент платит неверную сумму.
3. **[P0 — Нарушение контроля доступа и изоляции ролей в `/dashboard`]:** Layout панели салона (`src/app/dashboard/layout.tsx:14`) принудительно перенаправляет всех пользователей, чья роль не равна `"OWNER"`, на `/admin` (`if (session.role !== "OWNER") redirect("/admin")`), а все Server Actions салона жестко требуют `requireRole("OWNER")`. Если главный администратор (`ADMIN`) имеет собственный салон или пытается проверить панель салона, он блокируется. Напротив, в панели провайдера (`src/components/provider/provider-dashboard.tsx:121`) кнопка перехода в `/admin` проверяет `provider.username === "admin"` вместо `role === "ADMIN"`.
4. **[P1 — Автоматическое удаление загруженных логотипов партнеров («Нам доверяют») через 1 час]:** Фоновый воркер очистки хранилища `cleanOrphanedUploads()` (`src/server/storage/cleanup.ts:10-51`) каждый час сканирует БД на используемые файлы в `/api/uploads/...`, но проверяет только таблицы `businesses`, `staff`, `gallery_images` и `page_sections`, **забывая таблицу `trusted_logos`**. Любой PNG-логотип, загруженный владельцем платформы в карусель «Нам доверяют», физически удаляется с диска через 60 минут (`MIN_ORPHAN_AGE_MS`).
5. **[P1 — Лимит клиентов провайдера (`customClientLimit`) нигде не проверяется]:** Провайдер может задать кастомный лимит клиентов (`customClientLimit`), он сохраняется в БД и отображается в таблицах, но в бизнес-логике (`src/server/limits.ts`, `createBooking`, `saveClientAction`) **отсутствует проверка этого лимита**. Салон с лимитом в 50 клиентов может бесконечно добавлять тысячи клиентов.

### 4. Общая оценка архитектуры
Архитектура приложения чистая, модульная и хорошо структурирована вокруг `src/server/*` (слои `auth`, `booking`, `business`, `db`, `payments`, `storage`, `actions`) и `src/app/*`. Использование PostgreSQL транзакций с `pg_advisory_xact_lock` для предотвращения овербукинга — сильное инженерное решение. Слабыми местами архитектуры являются:
- Хранение состояния rate-лимитера и отозванных/использованных JWT refresh-токенов (`consumedRefreshJtis`) в оперативной памяти процесса Node.js (`Map`), что не работает при перезапуске контейнера или горизонтальном масштабировании.
- Полная выгрузка таблиц `businesses` и `subscriptions` в память Node.js без SQL-фильтрации `WHERE` в методах аналитики админки и провайдера (`getAdminProviders`, `getProviderDashboardData`).
- Каскад N+1 SQL-запросов при рендеринге публичной страницы салона `/[slug]` (до 560 последовательных запросов к БД на одно открытие страницы при расчете превью-слотов на 14 дней вперед).

---

## B. Техническая архитектура (Technical Architecture)

### 1. Стек технологий
| Слой | Технологии и версии | Назначение |
| :--- | :--- | :--- |
| **Frontend & Meta-Framework** | Next.js `16.2.4` (App Router, Turbopack), React `19.2.4`, TypeScript `5.x` | SSR/RSC рендеринг, маршрутизация, Server Actions, клиентские интерфейсы |
| **Стилизация и UI** | Tailwind CSS `4.x`, Lucide React `1.16.0` | Адаптивная верстка, иконки, кастомная дизайн-система |
| **Backend & API** | Next.js Route Handlers (`/api/*`) + Server Actions (`src/server/actions/*`) | REST API v1 для мобильных/внешних клиентов, JSON-RPC для Payme, Webhooks для Click/NowPayments |
| **База данных и ORM** | PostgreSQL `16-alpine`, Drizzle ORM `0.45.2`, драйвер `postgres` (`3.4.8`), Drizzle Kit `0.31.10` | Реляционное хранение данных, транзакции, миграции (`drizzle/*.sql`) |
| **Аутентификация и криптография** | Собственная сессионная система (Cookie `uzbook_session` + таблица `sessions`), `bcryptjs` (`3.0.3`), Node `crypto` (`scrypt`, `createHmac`, `timingSafeEqual`), JWT HS256 для `/api/v1/*` | Веб-сессии, хеширование паролей (`scrypt` + fallback на `bcrypt`), подпись токенов |
| **Валидация и санитизация** | `zod` (`4.3.6`), `sanitize-html` (`2.17.2`) | Валидация входных форм и REST payload, очистка пользовательского HTML в конструкторе лендинга |
| **Файловое хранилище** | Локальная файловая система (`.data/uploads`), раздача через `/api/uploads/[name]` | Хранение логотипов, обложек, фото мастеров, галереи и карусели брендов |

### 2. Структура репозитория и модулей
```text
d:\uzbook
├── drizzle/                        # SQL-миграции PostgreSQL (0000 .. 0011) и мета-журнал
├── public/                         # Статические ассеты
├── scripts/                        # Скрипты миграции (migrate.ts), фонового обслуживания (maintenance.ts) и ручных тестов (test-*.ts)
├── src/
│   ├── app/                        # Маршруты Next.js App Router
│   │   ├── (auth)/                 # Группа авторизации (/login, /register, /logout) и Server Actions входа/регистрации
│   │   ├── [slug]/                 # Публичная страница салона и виджет онлайн-записи
│   │   ├── admin/                  # Панель владельца платформы (ADMIN / SUPPORT): салоны, пользователи, провайдеры, логи, платежи, логотипы
│   │   ├── api/                    # HTTP Route Handlers: /api/health, /api/public/*, /api/payments/*, /api/uploads/[name], /api/v1/*
│   │   ├── b/[token]/              # Публичная страница управления бронью по токену (отмена / перенос клиентом)
│   │   ├── become-provider/        # Публичная форма подачи заявки на статус провайдера
│   │   ├── dashboard/              # Личный кабинет владельца салона (OWNER): расписание, услуги, мастера, клиенты, конструктор, биллинг
│   │   ├── pay/[id]/               # Страница чекаута/инструкций по оплате подписки
│   │   └── provider/               # Личный кабинет партнера-провайдера (PROVIDER)
│   ├── components/                 # Клиентские и серверные UI-компоненты (booking, dashboard, admin, provider, ui)
│   ├── lib/                        # Изоморфные утилиты (utils.ts, section-templates.ts)
│   ├── proxy.ts                    # Next.js 16 Proxy (бывший middleware) для защиты маршрутов /dashboard, /admin, /provider по cookie
│   └── server/                     # Серверное ядро приложения
│       ├── actions/                # Server Actions (admin, bookings, catalog, clients, gallery, logos, page-sections, payments, profile, providers)
│       ├── api/v1/                 # Логика JWT HS256 и ответов для REST API /api/v1
│       ├── auth/                   # Сессии, хеширование паролей (scrypt/bcrypt), RBAC-гарды (requireUser, requireRole, requireAdmin)
│       ├── booking/                # Расчет слотов (slots.ts) и транзакционный сервис бронирования (service.ts)
│       ├── business/               # Чтение данных для публичной страницы (public.ts), дашборда (dashboard.ts) и админки (admin.ts)
│       ├── db/                     # Схема Drizzle (schema.ts), пул соединений (index.ts), сидер демо-данных (seed.ts)
│       ├── http/                   # In-memory rate-limiter и извлечение IP клиента
│       ├── payments/               # Конфигурация тарифов (config.ts) и платежный движок (service.ts)
│       ├── storage/                # Загрузка файлов с проверкой magic bytes (uploads.ts) и очистка сирот (cleanup.ts)
│       ├── audit.ts                # Запись событий в таблицу audit_logs
│       ├── env.ts                  # Валидация переменных окружения
│       └── limits.ts               # Проверка лимитов тарифа (trialExpired, staffLimitError, writeBlockedReason)
├── Dockerfile                      # Multi-stage сборка для продакшена (Node 20 Alpine, non-root user nextjs:1001)
└── docker-compose.yml              # Стек из 4 сервисов: db (Postgres 16), migrate, app, maintenance
```

### 3. Схема базы данных
База данных PostgreSQL включает **17 таблиц** и **6 перечислений (`pgEnum`)**, определенных в `src/server/db/schema.ts`:
- **Enums:** `user_role` (`OWNER`, `ADMIN`, `SUPPORT`, `PROVIDER`), `plan` (`TRIAL`, `SOLO`, `PRO`, `PRO_PLUS`), `booking_status` (`CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), `payment_provider` (`DEMO`, `MANUAL`, `CLICK`, `PAYME`, `CRYPTO`), `payment_status` (`CREATED`, `PENDING`, `PAID`, `FAILED`, `EXPIRED`, `REFUNDED`), `subscription_status` (`PENDING`, `ACTIVE`, `EXPIRED`, `CANCELLED`).
- **Таблицы:** `users`, `sessions`, `businesses`, `services`, `staff`, `staff_services`, `working_hours`, `schedule_exceptions`, `clients`, `bookings`, `payments`, `gallery_images`, `page_sections`, `provider_applications`, `subscriptions`, `audit_logs`, `trusted_logos`.

### 4. Механизмы аутентификации и авторизации
В системе реализованы **два параллельных механизма аутентификации**:
1. **Веб-сессии (Cookies + БД) для браузера:**
   - При входе (`loginAction` в `src/app/(auth)/actions.ts`) создается случайный 32-байтный токен (`randomBytes(32).toString("hex")`), сохраняется в таблицу `sessions` на 30 дней и устанавливается в `httpOnly`, `sameSite: "lax"` cookie `uzbook_session`.
   - Первичная фильтрация маршрутов выполняется в `src/proxy.ts` (проверяет только наличие непустой cookie `uzbook_session`), а полноценная проверка сессии и ролей выполняется на уровне Server Components и Server Actions через `getSession()`, `requireUser()`, `requireRole()`, `requireAdminOrSupport()`, `requireProvider()`.
2. **JWT (HS256) для REST API (`/api/v1/*`):**
   - Реализован в `src/server/api/v1/auth.ts`. Выдает `accessToken` (TTL 1 час) и `refreshToken` (TTL 30 дней), подписанные секретом `JWT_SECRET` (или `SESSION_SECRET`).

### 5. Внешние интеграции и переменные окружения
- **Платежные шлюзы:**
  - **Payme (Paycom):** JSON-RPC 2.0 endpoint `/api/payments/payme` (`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`, `CheckTransaction`, `GetStatement`). Переменные: `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_TEST_KEY`, `PAYME_ACCOUNT_FIELD`.
  - **Click:** Shop API webhook `/api/payments/click` (`action=0` Prepare, `action=1` Complete). Переменные: `CLICK_MERCHANT_ID`, `CLICK_SERVICE_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID`.
  - **Crypto (NOWPayments):** Webhook `/api/payments/crypto` с проверкой HMAC-SHA512 (`x-nowpayments-sig`). Переменные: `CRYPTO_API_KEY`, `CRYPTO_IPN_SECRET`, `CRYPTO_WALLET_USDT_TRC20`.
- **Уведомления (Telegram):** В ранних версиях присутствовала интеграция с Telegram-ботом, но миграцией `drizzle/0006_drop_telegram.sql` все колонки Telegram были удалены. В настоящий момент внешние каналы уведомлений (SMS, Telegram, Email) **отсутствуют**.

### 6. Конфигурация деплоя и существующие тесты
- **Деплой:** Описан в `Dockerfile` и `docker-compose.yml`. Включает контейнеры `db` (`postgres:16-alpine`), `migrate` (одноразовый прогон `scripts/migrate.ts`), `app` (`next start` на порту 3000) и `maintenance` (бесконечный цикл каждые 3600 сек, запускающий `scripts/maintenance.ts` для экспирации платежей и очистки сиротских файлов).
- **Тестовое покрытие:** В проекте **отсутствует полноценный тестовый фреймворк** (нет Vitest / Jest / Playwright, в `package.json` нет скрипта `"test"`). В папке `scripts/` находятся 4 императивных скрипта (`test-providers.ts`, `test-phone-auth.ts`, `test-customizer.ts`, `test-audit-Check.ts`), которые выполняют прямые мутации в локальной базе данных. Оценка покрытия автоматическими тестами — **менее 15%**.

---

## C. Функциональный аудит (Functional Audit)

Ниже представлена сводная таблица проверки всех функциональных блоков платформы (статический анализ кода + динамическое тестирование запущенного сервера и БД).

| Функция | Статус | Проблема | Доказательства (Файлы и строки) |
| :--- | :--- | :--- | :--- |
| **Запуск сервера и работа маршрутов (Next.js 16 Runtime)** | ❌ **СЛОМАНО (P0)** | Приложение возвращает **HTTP 500** на всех страницах (`/`, `/login`, `/become-provider`, `/api/health`, `/api/v1/*`) из-за экспорта синхронной функции `normalizeAuthPhone` из файла с `"use server"`. | `src/app/(auth)/actions.ts:1, 44` (`export function normalizeAuthPhone`). Ответ сервера: `Error: Server Actions must be async functions`. |
| **Регистрация владельца салона (`/register`)** | ⚠️ **Работает частично (после фикса P0)** | Обязательный ввод телефона, валидация `normalizeAuthPhone`, создание `users` + `businesses` + дефолтных `workingHours` и `services` в транзакции реализованы. Однако в БД нет `UNIQUE` индекса на `users.phone` — при параллельных запросах возможна регистрация дублей телефона. | `src/app/(auth)/actions.ts:122-279`, `src/server/db/schema.ts:126-144` (отсутствует `uniqueIndex` на `phone`). |
| **Вход в систему (`/login` и `/api/v1/auth/login`)** | ⚠️ **Частично** | Веб-форма `/login` поддерживает вход по Email, телефону или `username`. Однако REST API `/api/v1/auth/login` принимает **только `email`** (телефон и `username` отклоняются Zod-схемой `z.string().email()`). | `src/app/(auth)/actions.ts:52-119` vs `src/app/api/v1/auth/login/route.ts:12-15`. |
| **Профиль и настройки аккаунта (`/dashboard/profile`)** | ⚠️ **Неполная функциональность** | Владелец салона может редактировать карточку салона (`businesses.name`, `slug`, `phone`, `address`, логотип, обложку), но **не может изменить свой личный пароль, Email или телефон для входа (`users.phone`)**. | `src/server/actions/profile.ts:19-115`, `src/components/dashboard/profile-form.tsx`. |
| **Подача заявки на провайдера (`/become-provider`)** | ⚠️ **Уязвимо к спаму** | Публичная форма сохраняет заявку в `provider_applications`, но у Server Action **полностью отсутствует rate-limiting** и капча. | `src/server/actions/providers.ts:37-71` (`submitProviderApplicationAction`). |
| **Одобрение провайдера админом (`/admin/providers`)** | ✅ **Работает (логика БД)** | Админ одобряет заявку, задает `username`, пароль и `% комиссии` (`commissionPercent`, по умолчанию 60%). Создается запись `users` с ролью `PROVIDER` или обновляется существующая. | `src/server/actions/providers.ts:74-184` (`approveProviderApplicationAction`). |
| **Редактирование настроек провайдера админом** | ❌ **Баг 500 при коллизии (P2)** | При смене `username` провайдера в `updateProviderSettingsAction` не проверяется уникальность нового `username` перед `UPDATE users`, что вызывает необработанное исключение PostgreSQL `23505`. | `src/server/actions/providers.ts:227-278` (строки `254-261`). |
| **Панель провайдера: подключение салона и кастомная подписка (`/provider`)** | ⚠️ **Частично** | Провайдер может подключить салон (создать `OWNER` + `businesses`) и оформить кастомную подписку (`14/30` дней бесплатно или платный тариф со своей ценой, лимитом мастеров и клиентов). Но провайдер **не может сбросить пароль клиенту** или отредактировать контактные данные салона после создания. | `src/server/actions/providers.ts:281-521`, `src/components/provider/provider-dashboard.tsx`. |
| **Управление услугами, мастерами и расписанием (`/dashboard/services`, `/staff`)** | ✅ **Работает корректно** | Полный CRUD услуг, мастеров, привязки `staff_services`, рабочих часов (`working_hours`) и выходных/отпусков (`schedule_exceptions`). Лимит мастеров учитывает `customStaffLimit`. | `src/server/actions/catalog.ts:1-460`, `src/server/limits.ts:106-127`. |
| **Конструктор лендинга салона (`/dashboard/page-builder`)** | ✅ **Работает корректно** | Поддерживает добавление по шаблонам, скрытие/показ, сортировку вверх/вниз и редактирование секций (`hero`, `services`, `staff`, `gallery`, `reviews`, `faq`, `promotions`, `contacts`, `custom_html`), включая мобильный предпросмотр. | `src/components/dashboard/page-sections-manager.tsx`, `src/server/actions/page-sections.ts`. |
| **Онлайн-запись клиента (`/[slug]`) и управление бронью (`/b/[token]`)** | ✅ **Работает корректно** | Пошаговый визард выбора услуги, мастера, даты/слота и ввода контактов. Защита от двойной записи через `pg_advisory_xact_lock`. Отмена и перенос клиентом по токену `/b/[token]` работают. | `src/server/booking/service.ts:149-456`, `src/app/b/[token]/page.tsx`. |
| **Кастомное ценообразование и 60% комиссия при онлайн-оплате (`/dashboard/billing`)** | ❌ **СЛОМАНО (P0)** | Страница `/dashboard/billing` игнорирует `business.customPriceUzs` и показывает стандартные цены. При оплате через Payme / Click / Crypto / Demo списывается стандартная цена тарифа, а запись в `subscriptions` создается **без `providerId` и с выплатой провайдеру `0 UZS`**. | `src/components/dashboard/billing-plans.tsx:165`, `src/server/payments/service.ts:55, 113, 276-286`. |
| **Соблюдение лимита клиентов (`customClientLimit`)** | ❌ **НЕ РЕАЛИЗОВАНО (P1)** | Поле `customClientLimit` задается провайдером и хранится в `businesses` и `subscriptions`, но **нигде не проверяется** при создании брони или добавлении клиента в CRM. | `src/server/limits.ts` (проверяется только `staffLimit`), `src/server/booking/service.ts:149`, `src/server/actions/clients.ts:417`. |
| **Отображение лимита сотрудников в `/dashboard/billing`** | ❌ **Несоответствие UI и бэкенда (P1)** | В блоке «Сотрудники» на странице `/dashboard/billing` выводится жесткий лимит тарифа `current.staffLimit` вместо кастомного `business.customStaffLimit ?? current.staffLimit`. | `src/app/dashboard/billing/page.tsx:90-93`. |
| **Карусель логотипов «Нам доверяют» (`/admin/logos` и `/`)** | ❌ **Потеря файлов через 1 час (P1)** | Загрузка PNG/WebP логотипов и крутящаяся CSS-карусель работают, но фоновый скрипт `cleanOrphanedUploads()` не знает о таблице `trusted_logos` и **удаляет все загруженные логотипы с диска через 1 час**. | `src/server/storage/cleanup.ts:10-51` (`findReferencedUploadNames`). |
| **Система уведомлений (SMS / Telegram / Email)** | ❌ **ОТСУТСТВУЕТ (P2)** | Клиенты не получают SMS/Telegram подтверждений или напоминаний о записи; админ не получает уведомлений о новых заявках провайдеров или запросах на подписку. Поле `bookings.reminderSentAt` мертвое. | `src/server/db/schema.ts:319`, `drizzle/0006_drop_telegram.sql`. |
| **Админ-панель и логи (`/admin/*`)** | ✅ **Работает (с ограничениями)** | Отдельные списки админов/саппортов, провайдеров, салонов, платежей и детальный журнал `audit_logs` с фильтрами по ролям и салонам работают. Однако админ не может зайти в `/dashboard` из-за редиректа в `dashboard/layout.tsx`. | `src/app/admin/*`, `src/app/dashboard/layout.tsx:14`. |

---

## D. Аудит бизнеса и финансовой модели (Business Logic Audit)

Особое внимание в ходе аудита было уделено подписочной модели и партнерской программе провайдеров (`PROVIDER`).

### 1. Как должна работать модель (по требованиям и схеме БД)
1. **Прямые продажи владельцем платформы (`ADMIN`):** Владелец платформы продает тарифы напрямую (`SOLO` — 99 000 сум, `PRO` — 199 000 сум, `PRO_PLUS` — 399 000 сум) и получает 100% оплаты.
2. **Продажи через провайдера (`PROVIDER`):**
   - Заявитель оставляет заявку на `/become-provider` (без автоматического получения роли).
   - Главный админ (`ADMIN`) одобряет заявку, вручную задает логин (`username`), пароль и индивидуальный процент вознаграждения (`commissionPercent`, по умолчанию **60%**, но настраивается от 0% до 100%).
   - Провайдер подключает салон (или привязывает существующий по email) и настраивает для него кастомную подписку:
     - Бесплатный триал на **14 или 30 дней** (`TRIAL`).
     - Платный тариф с кастомным количеством сотрудников (`customStaffLimit`), кастомным количеством клиентов (`customClientLimit`) и собственной ценой (`customPriceUzs`).
   - Вся оплата поступает владельцу платформы, а провайдеру начисляется его доля (`providerPayoutAmount = Math.round(priceAmount * commissionPercent / 100)`), которая отображается в дашборде провайдера и в финансовой сводке админа.

### 2. Выявленные противоречия и критические дыры в бизнес-логике

#### Проблема БЛ-1 (P0): Полный разрыв между настройками провайдера и модулем онлайн-оплаты (`src/server/payments/service.ts`)
В системе существуют **два несвязанных между собой пути создания подписки**:
- **Путь 1 (через форму провайдера `createProviderSubscriptionAction` в `src/server/actions/providers.ts:390-521`):**
  Провайдер создает запись в таблице `subscriptions` со статусом `PENDING` (для платного тарифа) или `ACTIVE` (для триала), корректно заполняя `priceAmount`, `providerCommissionPercent`, `providerPayoutAmount`, `customStaffLimit`, `customClientLimit`, и обновляет поля `customPriceUzs`, `customStaffLimit`, `customClientLimit` в таблице `businesses`. Затем админ вручную нажимает «Подтвердить оплату» (`activateSubscriptionAction`), переводя подписку в `ACTIVE`. **При этом запись в таблице `payments` вообще не создается!**
- **Путь 2 (самостоятельная оплата владельцем салона в `/dashboard/billing` через `startCheckoutAction` / `submitManualRequestAction` -> `createPayment` -> `completePayment`):**
  1. В `src/components/dashboard/billing-plans.tsx:165` владельцу салона показываются жестко зашитые цены из `PLANS` (`99 000 / 199 000 / 399 000 UZS`). Индивидуальная цена провайдера (`business.customPriceUzs`) на экране биллинга **даже не отображается**.
  2. В `createPayment()` (`src/server/payments/service.ts:55, 113`) сумма платежа берется строго из `getPlan(input.plan).priceUzs * months`. Поле `business.customPriceUzs` **игнорируется**.
  3. В `completePayment()` (`src/server/payments/service.ts:276-286`), когда платеж подтверждается через Payme, Click, Crypto, Demo или через кнопку одобрения в `/admin/payments`, создается новая запись в `subscriptions`:
     ```ts
     await tx.insert(subscriptions).values({
       businessId: business.id,
       providerId: null, // <-- ВСЕГДА NULL, даже если у салона есть business.providerId!
       plan: payment.plan,
       status: "ACTIVE",
       priceAmount: payment.amountUzs,
       providerCommissionPercent: 0, // <-- ВСЕГДА 0%!
       providerPayoutAmount: 0,      // <-- ПРОВАЙДЕР ПОЛУЧАЕТ 0 СУМ!
       ...
     });
     ```
     Более того, `completePayment()` **не перезаписывает и не учитывает** уже висящую в статусе `PENDING` подписку, которую создал провайдер! В итоге в таблице `subscriptions` остается старая `PENDING` подписка от провайдера и появляется вторая `ACTIVE` подписка с `providerId: null` и выплатой `0 UZS`.

#### Проблема БЛ-2 (P1): Неработающий лимит клиентов (`customClientLimit`)
По условиям бизнес-модели провайдер может кастомизировать подписку и *«самому указать количество людей (клиентов), указать сотрудников»*.
- Для сотрудников проверка реализована в `src/server/limits.ts:111`:
  `const maxStaff = business.customStaffLimit !== null && business.customStaffLimit !== undefined ? business.customStaffLimit : plan.staffLimit;`
- Для клиентов (`customClientLimit`) в `src/server/limits.ts` **вообще нет функции проверки**! Ни при онлайн-записи клиента (`createBooking` в `src/server/booking/service.ts`), ни при ручном добавлении клиента в CRM (`saveClientAction` в `src/server/actions/clients.ts`) количество записей в таблице `clients` не сверяется с `business.customClientLimit`.

#### Проблема БЛ-3 (P2): Бесконечный бесплатный доступ после возврата средств (`refundPayment`)
В `src/server/payments/service.ts:432-436` при оформлении возврата платежа (`refundPayment`) код откатывает тариф салона обратно на `TRIAL`:
```ts
await tx.update(businesses).set({
  plan: "TRIAL",
  planExpiresAt: null,
  ...
})
```
При этом поле `trialEndsAt` было обнулено (`trialEndsAt: null`) в момент первой активации платного тарифа (`completePayment`, строка 266) и **не восстанавливается** при возврате! А функция проверки блокировки `writeBlockedReason()` (`src/server/limits.ts:95-96`) проверяет истечение триала так:
```ts
const trialExpired = business.plan === "TRIAL" && business.trialEndsAt && business.trialEndsAt.getTime() < Date.now();
```
Так как `trialEndsAt === null`, условие `trialExpired` всегда возвращает `false`. **Итог:** любой салон после возврата платежа (`REFUNDED`) получает **вечный бесплатный тариф `TRIAL`** без каких-либо ограничений по времени!

#### Проблема БЛ-4 (P2): Ошибка при продлении подписки через провайдера (`activateSubscriptionAction`)
Когда админ подтверждает оплату подписки, созданной провайдером (`activateSubscriptionAction` в `src/server/actions/providers.ts:483-521`), новая дата окончания рассчитывается от текущего момента (`new Date(now.getTime() + durationDays * 86400_000)`), а не от текущей `business.planExpiresAt`, если подписка продлевается заранее. Кроме того, старые активные подписки этого салона в таблице `subscriptions` не переводятся в статус `EXPIRED` или `CANCELLED`, из-за чего у одного салона в таблице `subscriptions` одновременно числятся несколько записей со статусом `ACTIVE`.

### 3. Открытые вопросы по бизнес-логике (требуют подтверждения владельца продукта)
1. **Смысл `customClientLimit`:** Означает ли лимит клиентов максимальное общее число уникальных карточек в базе `clients` салона за все время, или максимальное число активных записей (`bookings`) в месяц?
2. **Самостоятельное продление подписки клиентом провайдера:** Если салон был подключен провайдером с ценой `250 000 UZS/мес`, должен ли владелец салона при самостоятельной оплате через Payme/Click на странице `/dashboard/billing` платить именно `250 000 UZS`, и должен ли провайдер получать свои 60% с каждого последующего (рекуррентного) продления, или только с первого подключения?
3. **Учет выплат провайдерам (Payout Tracking):** Сейчас в БД хранится только начисленная сумма `providerPayoutAmount` в таблице `subscriptions`, но нет статуса выплаты провайдеру на карту (`UNPAID` / `PAID_OUT`, дата перевода, номер транзакции). Нужно ли добавить учет фактически выплаченных провайдеру средств?

---

## E. Аудит информационной безопасности (Security Audit — OWASP Top 10)

### 1. Сводная таблица уязвимостей

| Уязвимость | Критичность | Расположение | Влияние (Impact) | Рекомендуемое исправление |
| :--- | :--- | :--- | :--- | :--- |
| **1. Привилегированный тупик / некорректный RBAC в `/dashboard` и проверка `username === "admin"`** | **P0 (Critical)** | `src/app/dashboard/layout.tsx:14`, `src/components/provider/provider-dashboard.tsx:121`, `src/server/actions/*.ts` | Пользователь с ролью `ADMIN` выбрасывается из `/dashboard` в `/admin` и не может управлять своим салоном. В `provider-dashboard.tsx` ссылка на `/admin` показана по `username === "admin"`, а не по роли `ADMIN`. | Разрешить доступ к `/dashboard` для `OWNER` и `ADMIN` (при наличии салона); заменить проверку `username === "admin"` на проверку роли. |
| **2. Stored XSS / Фишинг через `javascript:` URI в карусели логотипов (`trustedLogos`)** | **P1 (High)** | `src/server/actions/logos.ts:44-63`, `src/components/trusted-logos-carousel.tsx:59` | В `uploadTrustedLogoAction` поле `linkUrl` не валидируется на схему `https?://`. Если загрузить логотип с `linkUrl = "javascript:..."`, клик по логотипу на главной странице выполнит произвольный JS-код в браузере жертвы. | Валидировать `linkUrl` через `z.string().regex(/^https?:\/\//i)` и добавить `rel="noopener noreferrer"` (уже есть) + фильтрацию протокола в `TrustedLogosCarousel`. |
| **3. Отсутствие валидации JSON-схемы `config` для секций лендинга (кроме `custom_html`)** | **P1 (High)** | `src/server/actions/page-sections.ts:37-48, 92, 134` | `sanitizeSectionConfig` очищает только `custom_html`, а для `reviews`, `promotions`, `faq`, `gallery`, `vacancies` записывает любой переданный JSON-объект без проверки типов и длины полей (вплоть до лимита тела запроса `12 MB` из `next.config.ts`). | Описать строгие `Zod`-схемы для каждого `SectionType` и ограничить размер `config` (например, до 64 KB). |
| **4. Отсутствие Rate Limiting на подаче заявки провайдера и публичных токенах брони** | **P1 (High)** | `src/server/actions/providers.ts:37`, `src/app/api/public/bookings/[token]/route.ts` | Злоумышленник может отправить миллионы запросов в `submitProviderApplicationAction`, переполнив таблицы `provider_applications` и `audit_logs` (DoS базы данных). | Добавить `rateLimit()` по IP клиента (например, 5 заявок в час с одного IP) аналогично `loginAction`. |
| **5. Неаутентифицированный доступ к странице платежа `/pay/[id]` (IDOR / Info Disclosure)** | **P1 (High)** | `src/app/pay/[id]/page.tsx:33-60` | Маршрут `/pay/[id]` не вызывает `requireUser()`. Любой, кто перехватил UUID платежа (из логов, истории браузера или реферера), видит название салона, тариф, сумму, статус и `payload` (включая крипто-кошельки и ссылки на оплату). | Добавить `const user = await requireUser()` в `/pay/[id]/page.tsx` и проверять принадлежность `payment.businessId` текущему пользователю (или роль `ADMIN`/`SUPPORT`). |
| **6. Перечисление пользователей (Timing Enumeration) в `/api/v1/auth/login`** | **P1 (High)** | `src/app/api/v1/auth/login/route.ts:40-44` | При отсутствии `email` в БД API сразу возвращает 401 за ~2 мс, а при наличии — вычисляет `scrypt`/`bcrypt` (~80–150 мс). Позволяет атакующему перебирать базу email-адресов клиентов по времени ответа. | Вызывать `verifyPassword(password, DUMMY_PASSWORD_HASH)` при `!user`, как это уже сделано в `src/app/(auth)/actions.ts:95`. |
| **7. In-Memory хранение Rate Limiter и отозванных Refresh-токенов (`consumedRefreshJtis`)** | **P2 (Medium)** | `src/server/http/rate-limit.ts:12`, `src/server/api/v1/auth.ts:14` | При перезапуске контейнера `app` все счетчики брутфорса сбрасываются, а ранее использованные `refreshToken` снова становятся валидными (Replay Attack в пределах 30 дней). Кроме того, при поддельной заголовке `x-forwarded-for` без доверенного прокси атакующий может обходить rate-limit, меняя IP в заголовке. | Перенести хранение JTIs или сессий API в PostgreSQL; для `extractClientIp` доверять `x-forwarded-for` только при наличии флага `TRUST_PROXY=true`. |
| **8. Загрузка SVG или не-изображений через внешние URL (`imageUrl`)** | **P2 (Medium)** | `src/server/actions/logos.ts:52`, `src/server/actions/gallery.ts:27` | При загрузке файла на диск `uploads.ts` надежно проверяет magic bytes (PNG/JPEG/WebP/GIF). Однако `uploadTrustedLogoAction` и `addGalleryImageAction` также принимают произвольный текстовый `imageUrl`, который не проверяется на `https://` в `logos.ts`. | Разрешать в `imageUrl` либо внутренний путь `^\/api\/uploads\/[a-z0-9._-]+$`, либо валидный `^https:\/\/`. |
| **9. Отсутствие заголовков безопасности CSP и HSTS** | **P2 (Medium)** | `next.config.ts` | В `next.config.ts` не настроены HTTP-заголовки `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`. | Добавить секцию `headers()` в `next.config.ts` с базовой политикой безопасности. |

### 2. Что реализовано безопасно (Положительные стороны)
- **Защита от SQL Injection:** Все запросы к БД используют параметризованный конструктор Drizzle ORM (`eq`, `and`, `sql\`...\`` с биндингом параметров). Ни одной конкатенации строк в SQL не обнаружено.
- **Хранение паролей:** Используется `crypto.scrypt` (`N=16384, r=8, p=1`, соль 16 байт, ключ 64 байта) и сравнение через `timingSafeEqual` (`src/server/auth/password.ts`).
- **Криптографическая проверка вебхуков оплаты:**
  - В `/api/payments/payme/route.ts` используется `timingSafeEqual` для проверки Basic Auth ключа Paycom.
  - В `/api/payments/click/route.ts` используется `timingSafeEqual` для сверки MD5-подписи Click и проверяется точное совпадение суммы (`Math.abs(amount - payment.amountUzs) > 0.01`).
  - В `/api/payments/crypto/route.ts` используется HMAC-SHA512 с канонической сортировкой ключей JSON и `timingSafeEqual`.
- **Загрузка файлов (`src/server/storage/uploads.ts`):** Имена файлов генерируются через `randomBytes(16).toString("hex")`, проверяются сигнатуры первых байтов файла (magic bytes для PNG, JPEG, WebP, GIF), а формат SVG запрещен, что исключает Stored XSS через загрузку файлов.
- **Изоляция тенантов (Tenant Isolation):** Во всех Server Actions салона (`catalog.ts`, `clients.ts`, `bookings.ts`, `gallery.ts`, `page-sections.ts`, `profile.ts`) `businessId` никогда не берется из параметров клиента — он извлекается на сервере через `requireUserBusiness(user.id)` (`WHERE businesses.owner_user_id = session.user.id`), а все операции `UPDATE`/`DELETE` содержат составное условие `and(eq(table.id, id), eq(table.businessId, business.id))`. Взаимная утечка данных между салонами или между провайдерами через IDOR в кабинете исключена.

---

## F. Аудит базы данных и целостности данных (Database Audit)

### 1. Схема, индексы и внешние ключи (`src/server/db/schema.ts` и `drizzle/*.sql`)
1. **Отсутствие `UNIQUE` индекса на `users.phone` (P2):**
   - Таблица `users` (`src/server/db/schema.ts:126-144`) имеет `uniqueIndex("users_email_uq").on(t.email)` и `uniqueIndex("users_username_uq").on(t.username)`, но на колонке `phone` установлен только обычный не-уникальный индекс `index("users_phone_idx").on(t.phone)`.
   - Поскольку телефон теперь используется как идентификатор для входа в `loginAction` (`eq(users.phone, normalizedPhone)`), отсутствие `UNIQUE` индекса на уровне СУБД позволяет при состояниях гонки (race condition) или через прямое обновление создать двух пользователей с одинаковым номером телефона.
2. **Необработанная коллизия `users_username_uq` при редактировании провайдера (P2):**
   - В `updateProviderSettingsAction` (`src/server/actions/providers.ts:254-261`) админ может изменить `username` провайдера. В отличие от `approveProviderApplicationAction`, здесь нет предварительной проверки `SELECT id FROM users WHERE username = ...`, что приводит к падению запроса с ошибкой БД при совпадении логина.
3. **Хранение денежных сумм и времени:**
   - Денежные суммы (`priceUzs`, `amountUzs`, `priceAmount`, `providerPayoutAmount`) хранятся в целочисленном типе `integer` (в сумах без тийинов). Для сумм до `2 147 483 647 UZS` (~2,14 млрд сум) типа `integer` достаточно, однако для долгосрочной финансовой отчетности и агрегаций рекомендуется `bigint` (особенно с учетом того, что Payme оперирует суммой в тийинах `amountUzs * 100`, где порог `int32` достигается уже при `21 474 836 UZS`).
   - Рабочие часы (`startTime`, `endTime`) и даты исключений (`schedule_exceptions.date`) хранятся как `varchar(5)` (`"09:00"`) и `varchar(10)` (`"2026-11-01"`). Это упрощает работу без сдвигов часовых поясов (все салоны работают в `Asia/Tashkent`), но лишает БД встроенной валидации типов `TIME` и `DATE`.
4. **Отсутствующие составные индексы для частых запросов (P2):**
   - В таблице `subscriptions` есть индексы `subscriptions_business_idx` и `subscriptions_provider_idx`, но нет составного индекса `(business_id, status, created_at DESC)`, который постоянно используется для поиска текущей подписки салона.
   - В таблице `audit_logs` нет составного индекса `(actor_role, created_at DESC)` и `(business_id, created_at DESC)` для фильтрации вкладок в `/admin/logs`.

### 2. Транзакции и состояния гонки (Race Conditions)
- **Бронирование слотов (`src/server/booking/service.ts:227-302`):** Реализовано образцово. Внутри `db.transaction` вызывается `SELECT pg_advisory_xact_lock(hashtext(${lockKey}))` по ключу `booking:${businessId}:${staffId}:${dayStr}`, после чего повторно проверяются пересечения в таблице `bookings`. Это гарантирует отсутствие двойных записей даже при сотнях одновременных запросов на одно и то же время.
- **Оплата и активация тарифа (`src/server/payments/service.ts:228-290`):** Внутри `completePayment` используется транзакция с `SELECT * FROM payments WHERE id = ... FOR UPDATE`, что защищает от двойного начисления подписки при одновременных вебхуках от платежной системы.
- **Уязвимое место (отсутствие блокировки в `activateSubscriptionAction`):** В `src/server/actions/providers.ts:483-521` подтверждение подписки провайдера выполняется **без `SELECT ... FOR UPDATE`** и без атомарного `WHERE status = 'PENDING'`. Если админ дважды быстро нажмет кнопку «Подтвердить оплату», код выполнится дважды.

---

## G. Аудит производительности и масштабируемости (Performance Audit)

### 1. Критическое узкое место: N+1 каскад запросов на публичной странице салона `/[slug]` (P2)
- **Расположение:** `src/server/business/public.ts:107-138` (`getPublicBusiness`) -> `src/server/booking/slots.ts:35-149` (`computeSlots` / `getPreviewSlots`).
- **Механика проблемы:**
  При каждом открытии страницы салона `/[slug]` функция `getPublicBusiness` загружает список активных мастеров (`staffRows`) и для каждого мастера запускает цикл по 14 дням вперед (`for (let offset = 0; offset < 14; offset++)`), вызывая `getPreviewSlots()`.
  Внутри `computeSlots()` на каждый вызов выполняются **4 отдельных SQL-запроса**:
  1. `SELECT * FROM staff WHERE id = ...` (хотя объект мастера уже был загружен в `getPublicBusiness`!).
  2. `SELECT * FROM schedule_exceptions WHERE staff_id = ... AND date = ...`
  3. `SELECT * FROM working_hours WHERE business_id = ... AND staff_id IS NOT NULL`
  4. `SELECT ... FROM bookings INNER JOIN services ... WHERE staff_id = ...`
- **Масштаб ущерба:**
  - В лучшем случае (если у всех 8 мастеров есть свободные окошки прямо сегодня): `5 базовых запросов + (8 мастеров × 4 запроса) = 37 SQL-запросов` на один просмотр страницы.
  - В худшем случае (если у салона 10 мастеров в отпуске или с полной записью на 2 недели вперед): `5 + (10 мастеров × 14 дней × 4 запроса) = 565 SQL-запросов` на **одно открытие страницы**!
- **Рекомендация:** Загружать расписание (`working_hours`), исключения (`schedule_exceptions`) и брони (`bookings`) на 14 дней вперед **одним пакетным запросом (Batch Query)** для всех мастеров салона сразу (`WHERE business_id = ... AND starts_at BETWEEN ...`) и рассчитывать слоты в памяти Node.js за `O(1)` обращений к БД.

### 2. Полное чтение таблиц (`Full Table Scan` в память Node.js) в дашбордах админа и провайдера (P2)
- **Расположение:**
  - `src/server/business/admin.ts:271-273` (`getAdminProviders`):
    ```ts
    const allBusinesses = await db.select().from(businesses);
    const allSubs = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
    ```
  - `src/server/business/admin.ts:359` (`getProviderDashboardData`):
    ```ts
    const allSubs = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
    ```
- **Механика проблемы:** Даже когда в кабинет `/provider` заходит один конкретный провайдер, у которого подключено всего 3 салона, сервер выгружает из PostgreSQL **абсолютно все подписки всех салонов всей платформы (`SELECT * FROM subscriptions`)** и фильтрует их в JavaScript: `allSubs.filter((s) => s.providerId === providerId)`.
- **Рекомендация:** Добавить SQL-условие `.where(eq(subscriptions.providerId, providerId))` в `getProviderDashboardData` и использовать SQL-агрегацию (`GROUP BY provider_id`) в `getAdminProviders`.

### 3. Оптимизация изображений и фронтенд-бандла (P3)
- Все загруженные пользователями изображения (`/api/uploads/[name]`) отдаются как есть (до 5 МБ каждое) и рендерятся через обычные теги `<img src=...>` без ресайза, конвертации в WebP/AVIF или использования `next/image`. Если салон загрузит 12 фотографий в портфолио по 4 МБ каждая, публичная страница `/[slug]` заставит мобильного пользователя скачать **~50 МБ трафика**.

### 4. Выдержит ли текущая архитектура 500–2 000 салонов?
- **При 500 салонах (~5 000 визитов клиентов в день):** Сервер справится с базовыми операциями CRM, но публичные страницы `/[slug]` при пиковом трафике (например, переход по рекламе в Instagram) быстро исчерпают пул из 10 соединений PostgreSQL (`max: 10` в `src/server/db/index.ts:18`) из-за проблемы **N+1 в `getPreviewSlots`**.
- **При 2 000 салонах (~25 000 подписок в истории, ~50 000 визитов в день):** Без устранения N+1 запросов в `getPublicBusiness` и `SELECT * FROM subscriptions` без `WHERE` в `admin.ts`, база данных и Node.js процесс начнут испытывать деградацию задержек (p95 > 2–4 сек) и нехватку памяти (OOM). После перевода расчета слотов на пакетную выборку (3 запроса вместо 40–500) и добавления `WHERE` в запросы подписок один инстанс PostgreSQL + Node.js легко выдержит **5 000+ салонов**.

---

## H. Аудит фронтенда и UX/UI (UX/UI Audit)

1. **Визуальная консистентность и мобильная адаптивность:**
   - Публичные страницы салонов (`/[slug]`), визард записи (`BookingFlow`), обновленный конструктор лендинга (`/dashboard/page-builder`), панель провайдера (`/provider`) и панель администратора (`/admin`) сверстаны качественно, с хорошей типографикой, адаптивными сетками и удобными кнопками для сенсорных экранов.
2. **Путаница в тарифах и лимитах для владельца салона (`/dashboard/billing`):**
   - Если салон подключен через провайдера с индивидуальными условиями (например, `customStaffLimit = 10`, `customClientLimit = 500`, `customPriceUzs = 250 000 сум`), владелец салона на странице `/dashboard/billing` видит стандартный лимит `2 сотрудника` (`current.staffLimit` в `src/app/dashboard/billing/page.tsx:91`) и стандартные карточки тарифов (`99 000 / 199 000 / 399 000 сум`), что вводит клиента в заблуждение относительно его реальных условий договора с провайдером.
3. **Отсутствие управления собственным профилем безопасности (`/dashboard/profile`):**
   - Ни владелец салона (`OWNER`), ни провайдер (`PROVIDER`), ни саппорт (`SUPPORT`) не имеют в интерфейсе формы «Сменить пароль» или «Изменить телефон/Email для входа».
4. **Отсутствие обратной связи (Toast / Уведомлений) в ряде таблиц:**
   - В конструкторе лендинга и настройках профиля есть понятные баннеры успеха/ошибки, однако при удалении логотипа в `/admin/logos` или переключении статуса заявки действия происходят мгновенно без предварительного модального подтверждения (`confirm`) или тост-уведомления.

---

## I. Реестр критических и важных проблем (Prioritized Findings: P0 — P3)

### 🔴 P0 — Critical (Блокеры продакшена: падение приложения, потеря выручки, нарушение доступа)

#### P0-1. Падение всего приложения в Next.js 16 из-за синхронного экспорта в файле `"use server"`
- **Файл и функция:** `src/app/(auth)/actions.ts`, строка `44` (`export function normalizeAuthPhone(raw: string): string`).
- **Объяснение:** Файл `src/app/(auth)/actions.ts` начинается с директивы `"use server";` (строка 1). По спецификации React 19 / Next.js 16 каждый экспорт из `"use server"` модуля компилируется как Server Action endpoint и **обязан быть асинхронной функцией (`async function`)**. Функция `normalizeAuthPhone` объявлена синхронной и экспортирована.
- **Шаги воспроизведения:**
  1. Запустить сервер `npm run dev` или сборку `npm run build`.
  2. Открыть любую страницу (`http://localhost:3000/`, `http://localhost:3000/login`, `http://localhost:3000/api/health`).
  3. Сервер возвращает **HTTP 500** с текстом: `Error: ./src/app/(auth)/actions.ts:44:17 — Server Actions must be async functions`.
- **Рекомендуемое решение:** Убрать ключевое слово `export` перед `function normalizeAuthPhone` в `src/app/(auth)/actions.ts` и вынести `normalizeAuthPhone` в отдельный изоморфный модуль `src/lib/phone.ts` без директивы `"use server"`.

#### P0-2. Потеря кастомной цены (`customPriceUzs`) и 60% комиссии провайдера при любой онлайн-оплате или ручной заявке из `/dashboard/billing`
- **Файлы и функции:**
  - `src/server/payments/service.ts` — функции `createPayment` (строки `47-149`) и `completePayment` (строки `225-305`).
  - `src/components/dashboard/billing-plans.tsx` — компонент `BillingPlans` (строки `152-222`).
  - `src/app/dashboard/billing/page.tsx` — компонент `BillingPage`.
- **Объяснение:**
  1. `createPayment()` берет цену исключительно из константы `getPlan(input.plan).priceUzs`, игнорируя `business.customPriceUzs`.
  2. `completePayment()` при успешной оплате (Payme, Click, Crypto, Demo, Manual) создает запись в `subscriptions` с `providerId: null`, `providerCommissionPercent: 0`, `providerPayoutAmount: 0`, даже если салон закреплен за провайдером (`business.providerId !== null`).
- **Шаги воспроизведения:**
  1. Войти под провайдером (`prov_ali`) и подключить салон с кастомной ценой `300 000 UZS` и комиссией провайдера `60%`.
  2. Войти под владельцем этого салона в `/dashboard/billing` и оплатить тариф через Demo / Payme / Click.
  3. Проверить таблицу `subscriptions` и панель провайдера `/provider`: с клиента списалась стандартная сумма вместо `300 000 UZS`, а начисленная выплата провайдеру составила **0 UZS**.
- **Рекомендуемое решение:**
  1. В `createPayment()` загружать `business` и при наличии `business.customPriceUzs` использовать его как базовую месячную стоимость.
  2. В `completePayment()` проверять `business.providerId`: если салон закреплен за провайдером, загружать `users.commissionPercent` этого провайдера, обновлять существующую `PENDING` подписку (или создавать новую с `providerId: business.providerId`, `providerCommissionPercent: pct`, `providerPayoutAmount: Math.round(payment.amountUzs * pct / 100)`, `customStaffLimit: business.customStaffLimit`, `customClientLimit: business.customClientLimit`).
  3. Передавать `customPriceUzs`, `customStaffLimit`, `customClientLimit` в компонент `BillingPlans` для корректного отображения индивидуального тарифа.

#### P0-3. Блокировка доступа `ADMIN` к `/dashboard` и проверка прав админа по `username === "admin"`
- **Файлы и функции:**
  - `src/app/dashboard/layout.tsx:14` (`if (session.role !== "OWNER") redirect("/admin");`)
  - `src/components/provider/provider-dashboard.tsx:121` (`{provider.username === "admin" && ...}`)
  - `src/server/actions/catalog.ts:16`, `src/server/actions/profile.ts:21`, `src/server/actions/page-sections.ts:62`, `src/server/actions/gallery.ts:15`, `src/server/actions/payments.ts:31`.
- **Объяснение:** Если у пользователя с ролью `ADMIN` есть собственный бизнес (как в сидере или после назначения роли), он не может зайти в `/dashboard`, так как `dashboard/layout.tsx` перенаправляет всех не-`OWNER` в `/admin`. В то же время в `provider-dashboard.tsx` кнопка возврата в админ-панель проверяет строку `provider.username === "admin"` вместо роли пользователя.
- **Рекомендуемое решение:** В `dashboard/layout.tsx` и Server Actions салона разрешить роли `OWNER` и `ADMIN` (при наличии привязанного салона), а в `provider-dashboard.tsx` проверять `provider.role === "ADMIN"`.

---

### 🟠 P1 — High (Высокий риск потери данных, обхода ограничений тарифа или уязвимости безопасности)

#### P1-1. Автоматическое удаление всех загруженных логотипов карусели «Нам доверяют» через 1 час
- **Файл и функция:** `src/server/storage/cleanup.ts`, функция `findReferencedUploadNames` (строки `10-51`).
- **Объяснение:** Фоновый сервис `maintenance` каждый час запускает `cleanOrphanedUploads()`. Функция собирает список используемых файлов из `businesses.logoUrl`, `businesses.coverUrl`, `staff.photoUrl`, `galleryImages.url` и JSON-конфигов `pageSections`, но **не запрашивает таблицу `trustedLogos` (`trusted_logos.image_url`)**. Через 60 минут после загрузки любой логотип из `/admin/logos` считается «сиротой» и удаляется с диска (`unlink`).
- **Рекомендуемое решение:** В `findReferencedUploadNames()` (`src/server/storage/cleanup.ts`) добавить выборку `db.select({ imageUrl: trustedLogos.imageUrl }).from(trustedLogos)` и регистрировать имена файлов через `collectFromValue(row.imageUrl)`.

#### P1-2. Кастомный лимит клиентов провайдера (`customClientLimit`) не проверяется на бэкенде
- **Файлы и функции:** `src/server/limits.ts`, `src/server/booking/service.ts:149` (`createBooking`), `src/server/actions/clients.ts:417` (`saveClientAction`).
- **Объяснение:** Поле `businesses.customClientLimit` сохраняется в БД, но в `src/server/limits.ts` нет функции `clientLimitError(business)`. Салон может превышать установленный провайдером лимит клиентов без каких-либо ограничений.
- **Рекомендуемое решение:** Добавить в `src/server/limits.ts` функцию `clientLimitError(business)` (считающую `count()` в таблице `clients` для данного `businessId` при добавлении нового клиента) и вызывать ее в `saveClientAction` и `createBooking` (если клиент новый).

#### P1-3. Неверное отображение лимита сотрудников на странице `/dashboard/billing`
- **Файл и функция:** `src/app/dashboard/billing/page.tsx`, строки `90-93`.
- **Объяснение:** На странице биллинга выводится `${usage.staff} из ${current.staffLimit}` вместо учета `business.customStaffLimit ?? current.staffLimit`.
- **Рекомендуемое решение:** Вычислять `const effectiveStaffLimit = business.customStaffLimit ?? current.staffLimit` и передавать его в прогресс-бар и текст.

#### P1-4. Stored XSS / Невалидированный `linkUrl` в карусели логотипов и невалидированный JSON в `page_sections`
- **Файлы и функции:** `src/server/actions/logos.ts:44-63` (`uploadTrustedLogoAction`), `src/server/actions/page-sections.ts:37-48` (`sanitizeSectionConfig`).
- **Рекомендуемое решение:**
  1. В `uploadTrustedLogoAction` проверять `linkUrl` регулярным выражением `/^https?:\/\//i`.
  2. В `page-sections.ts` валидировать структуру `config` через `Zod` для каждого типа секции и ограничивать размер JSON.

#### P1-5. Отсутствие Rate Limiting в `submitProviderApplicationAction` и `/api/public/bookings/[token]`
- **Файлы и функции:** `src/server/actions/providers.ts:37`, `src/app/api/public/bookings/[token]/route.ts`.
- **Рекомендуемое решение:** Добавить вызов `rateLimit(\`provider-apply:\${ip}\`, 5, 60 * 60_000)` в `submitProviderApplicationAction` и `rateLimit(\`booking-token:\${ip}\`, 30, 60_000)` в публичный эндпоинт токена брони.

#### P1-6. Неаутентифицированный доступ к странице чекаута `/pay/[id]`
- **Файл и функция:** `src/app/pay/[id]/page.tsx:33-60`.
- **Рекомендуемое решение:** Вызывать `requireUser()` в начале `PayPage`, проверять права доступа пользователя к `payment.businessId`, а также исправить `isPaymentExpired(payment)` в `src/server/payments/service.ts:471`, чтобы истечение проверялось для обоих статусов `CREATED` и `PENDING`.

#### P1-7. Тайминг-атака (Account Enumeration) и отсутствие входа по телефону в `/api/v1/auth/login`
- **Файл и функция:** `src/app/api/v1/auth/login/route.ts:12-45`.
- **Рекомендуемое решение:** Привести `/api/v1/auth/login` к единой логике с `loginAction` (поддержка входа по email/телефону/username и вызов `verifyPassword(password, DUMMY_PASSWORD_HASH)` при отсутствии пользователя).

---

### 🟡 P2 — Medium (Производительность, целостность БД, полнота функций)

#### P2-1. Каскад N+1 запросов (до 560 SQL-запросов) при открытии страницы салона `/[slug]`
- **Файлы:** `src/server/business/public.ts:107-138`, `src/server/booking/slots.ts:35-149`.
- **Рекомендуемое решение:** Заменить поштучный вызов `computeSlots()` в цикле на пакетную загрузку рабочих часов, исключений и броней всех мастеров салона за 14 дней в 3 SQL-запроса.

#### P2-2. Полная выгрузка таблиц `businesses` и `subscriptions` в память в `src/server/business/admin.ts`
- **Файл:** `src/server/business/admin.ts:271-273, 359`.
- **Рекомендуемое решение:** Фильтровать записи на стороне PostgreSQL через `WHERE provider_id = ...` и агрегировать статистику через SQL `GROUP BY`.

#### P2-3. Отсутствие `UNIQUE` индекса на `users.phone` и необработанная коллизия `username` в `updateProviderSettingsAction`
- **Файлы:** `src/server/db/schema.ts:126-144`, `src/server/actions/providers.ts:254-261`.
- **Рекомендуемое решение:** Добавить `uniqueIndex("users_phone_uq").on(t.phone)` (с нормализацией телефонов в миграции) и проверять занятость `username` перед `db.update(users)` в `updateProviderSettingsAction`.

#### P2-4. Бесконечный бесплатный триал после возврата платежа (`refundPayment`)
- **Файл:** `src/server/payments/service.ts:432-436`.
- **Рекомендуемое решение:** При откате тарифа на `TRIAL` в `refundPayment` устанавливать `trialEndsAt: new Date()` (чтобы триал считался истекшим до новой оплаты), либо сохранять прежнюю дату `trialEndsAt`.

#### P2-5. Отсутствие внешних каналов уведомлений (SMS / Telegram / Email)
- **Файлы:** `src/server/booking/service.ts`, `src/server/db/schema.ts:319`.
- **Рекомендуемое решение:** Подключить локального SMS-провайдера Узбекистана (Eskiz.uz / PlayMobile) или вернуть опционального Telegram-бота для уведомлений о новых записях и заявках.

#### P2-6. Хранение Rate Limiter и использованных Refresh JTI в памяти процесса (`Map`)
- **Файлы:** `src/server/http/rate-limit.ts:12`, `src/server/api/v1/auth.ts:14`.
- **Рекомендуемое решение:** Хранить сессии/JTI и счетчики лимитов в PostgreSQL или Redis.

---

### 🟢 P3 — Low (Улучшения UX, инфраструктуры и тестирования)

1. **P3-1 (UX):** Добавить форму смены собственного пароля и телефона владельца в `/dashboard/profile` и `/provider`.
2. **P3-2 (UX):** Дать провайдеру в `/provider` возможность сбрасывать временный пароль подключенному им салону.
3. **P3-3 (Performance):** Сжимать загружаемые изображения в WebP (например, через `sharp`) при сохранении в `src/server/storage/uploads.ts`.
4. **P3-4 (QA / DevSecOps):** Настроить тестовый раннер (`Vitest` + `Playwright`) с отдельной тестовой БД (`uzbook_test`) и добавить скрипт `"test"` в `package.json`.

---

## J. Оценка готовности к продакшену (Production Readiness Score)

Оценка выставлена по 100-балльной шкале на основе фактического состояния кода и тестов без завышения:

| Категория | Оценка (0–100) | Обоснование оценки |
| :--- | :---: | :--- |
| **1. Функциональность (Functionality)** | **58 / 100** | Богатое ядро (бронирование, расписание, CRM, конструктор лендинга, роли, логи), но приложение падает в рантайме (P0-1), онлайн-оплата теряет кастомные цены и комиссии провайдеров (P0-2), а лимит клиентов не проверяется (P1-2). |
| **2. Безопасность (Security)** | **64 / 100** | Отличная защита паролей (`scrypt`), транзакций, SQL-запросов, magic-bytes при загрузке файлов и подписей платежных шлюзов. Оценка снижена за конфликт ролей в `/dashboard`, отсутствие rate-limit на заявках провайдеров, открытый `/pay/[id]` и `linkUrl` без проверки схемы в `trustedLogos`. |
| **3. Архитектура (Architecture)** | **74 / 100** | Четкое разделение слоев в `src/server/*`, грамотный монолит на Next.js App Router + Drizzle. Минусы: in-memory состояние для rate-limit/JWT и смешение синхронных утилит с `"use server"` экшенами. |
| **4. База данных (Database)** | **76 / 100** | Хорошо нормализованная схема из 17 таблиц, транзакционные блокировки `pg_advisory_xact_lock` и `FOR UPDATE`. Минусы: нет `UNIQUE` индекса на `users.phone`, возможны дубли `ACTIVE` подписок в `subscriptions`. |
| **5. Производительность (Performance)** | **55 / 100** | Каскад N+1 в `getPreviewSlots` (до 560 запросов на открытие `/[slug]`), полная выгрузка `businesses` и `subscriptions` в память в `admin.ts`, отсутствие сжатия изображений при загрузке. |
| **6. UX / UI (Интерфейс и удобство)** | **78 / 100** | Современный, чистый и мобильно-адаптивный интерфейс во всех кабинетах, удобный пошаговый конструктор лендинга. Минусы: несоответствие цен и лимитов на странице `/dashboard/billing` для клиентов провайдеров и отсутствие смены пароля в профиле. |
| **7. Деплой и инфраструктура (Deployment)** | **65 / 100** | Готовый multi-stage `Dockerfile` (non-root) и `docker-compose.yml` с контейнерами миграций и обслуживания. Однако `npm run build` сейчас падает из-за P0-1, а воркер `maintenance` удаляет логотипы партнеров (P1-1). |
| **8. Тестирование (Testing)** | **20 / 100** | Отсутствует автоматизированный тестовый пайплайн (`npm test`), нет unit/integration тестов для платежей и комиссий провайдеров, имеющиеся скрипты в `scripts/test-*.ts` модифицируют рабочую БД. |
| **ИТОГОВЫЙ БАЛЛ ГОТОВНОСТИ** | **56 / 100** | **Статус: Требуется выполнение Фазы 1 перед выкладкой в продакшен.** |

---

## K. Рекомендуемый пошаговый план действий (Action Plan)

### Фаза 1: Критические исправления перед выкладкой в продакшен (Срок: 1–2 дня)
1. **Починить падение Next.js 16 (P0-1):** Вынести `normalizeAuthPhone` из `src/app/(auth)/actions.ts` в `src/lib/phone.ts`, чтобы в `src/app/(auth)/actions.ts` остались только `async` функции. Проверить успешность `npm run build`.
2. **Остановить удаление логотипов карусели (P1-1):** Добавить сканирование `trustedLogos.imageUrl` в `findReferencedUploadNames()` (`src/server/storage/cleanup.ts`).
3. **Связать онлайн-оплату с кастомными ценами и комиссией провайдера 60% (P0-2):**
   - В `createPayment()` учитывать `business.customPriceUzs`.
   - В `completePayment()` подтягивать `business.providerId` и `provider.commissionPercent`, рассчитывать `providerPayoutAmount` и сохранять их в `subscriptions` (либо переводить существующую `PENDING` подписку провайдера в `ACTIVE`).
   - В `/dashboard/billing` (`BillingPage` и `BillingPlans`) отображать индивидуальную цену `customPriceUzs` и кастомные лимиты `customStaffLimit` / `customClientLimit`.
4. **Включить проверку лимита клиентов `customClientLimit` (P1-2):** Добавить `clientLimitError()` в `src/server/limits.ts` и вызывать ее при создании нового клиента в `createBooking` и `saveClientAction`.
5. **Исправить RBAC и защиту публичных форм (P0-3, P1-4, P1-5, P1-6):**
   - Разрешить `ADMIN` доступ к `/dashboard` (при наличии салона) и убрать проверку `username === "admin"` в `provider-dashboard.tsx`.
   - Закрыть `/pay/[id]` авторизацией `requireUser()`.
   - Добавить `rateLimit` в `submitProviderApplicationAction` и валидацию `^https?:\/\/` для `linkUrl` в `uploadTrustedLogoAction`.

### Фаза 2: Важные улучшения перед коммерческим запуском (Срок: 3–5 дней)
1. **Устранить N+1 запросов на странице салона `/[slug]` (P2-1):** Переписать `getPreviewSlots` / `getPublicBusiness` на пакетную загрузку расписания и броней за 3 SQL-запроса.
2. **Убрать полные сканы таблиц в `admin.ts` (P2-2):** Перевести `getProviderDashboardData` и `getAdminProviders` на фильтрацию `WHERE provider_id = ...` в SQL.
3. **Укрепить целостность БД и возвратов (P2-3, P2-4):**
   - Добавить `uniqueIndex("users_phone_uq")` на `users.phone` и проверку уникальности `username` в `updateProviderSettingsAction`.
   - Исправить `refundPayment()`, чтобы при откате на `TRIAL` устанавливался `trialEndsAt: new Date()`, исключая бесконечный бесплатный доступ.
4. **Добавить валидацию `Zod` для всех секций конструктора лендинга (P1-4)** в `src/server/actions/page-sections.ts`.
5. **Добавить возможность смены собственного пароля и телефона (P3-1)** в `/dashboard/profile` и сброса пароля клиенту из панели провайдера (P3-2).

### Фаза 3: Долгосрочная масштабируемость и надежность (Срок: 1–2 недели)
1. **Интеграция уведомлений (P2-5):** Подключить SMS-шлюз (Eskiz.uz) и/или Telegram-бота для отправки клиентам подтверждений записи, ссылок `/b/[token]` и напоминаний за 24/2 часа до визита.
2. **Оптимизация медиафайлов (P3-3):** Внедрить автоматическое сжатие и конвертацию загружаемых изображений в WebP через `sharp` в `src/server/storage/uploads.ts`.
3. **Вынос состояния из памяти (P2-6):** Перенести хранение `rateLimit` и `consumedRefreshJtis` из памяти процесса в PostgreSQL или Redis.
4. **Автоматизация тестирования (P3-4):** Настроить `Vitest` + `Playwright` в CI/CD с изолированной тестовой БД для автоматической проверки сценариев бронирования, расчета комиссий провайдеров и безопасности ролей перед каждым деплоем.
