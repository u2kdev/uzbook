# uzbook

Онлайн-запись для малого бизнеса: салоны красоты, барбершопы, стоматологии, мастера.
Владелец получает мини-лендинг со ссылкой на запись и таймлайн дня.
Клиент записывается без регистрации и сам переносит или отменяет запись по ссылке.

Альтернатива altg.io, заточенная под Узбекистан: русский интерфейс, UZS, локальное время,
веб-интерфейс и мобильное приложение.

## Что уже работает

**Для владельца бизнеса**

- регистрация → онбординг (название, slug, тип бизнеса, город);
- кабинет `/dashboard`: таймлайн дня, загрузка, ожидаемая выручка, мастера;
- услуги: цена, длительность, буферы до/после, категории, скрытие с сайта;
- мастера: профиль, цвет, привязка услуг, недельное расписание;
- записи: журнал за 2 недели и вперёд, поиск, ручная запись по звонку, статусы
  (подтвердить / пришёл / не пришёл / отменить), ссылка для клиента;
- страница бизнеса `/dashboard/profile`: логотип, обложка, описание, контакты,
  акцентный цвет, правила записи (шаг слотов, lead time, горизонт, автоподтверждение,
  показ цен, email);
- тариф и оплата `/dashboard/billing`: текущий план, лимиты, заявка на тариф,
  история подписок.

**Для клиента**

- страница `/<slug>`: описание, услуги, мастера и ближайшие свободные слоты;
- запись за несколько шагов: услуга → мастер → дата и время → контакты;
- запись без логина; после брони — ссылка на управление `/b/<token>`
  (перенести или отменить), срок отмены задаёт владелец.

**Для платформы**

- `/admin` — обзор: бизнесы, пользователи, записи, MRR, заявки на тарифы;
- `/admin/businesses` — тариф, блокировка, продление trial;
- `/admin/requests` — подтверждение оплат и история подписок;
- `/admin/users` — роли `OWNER` / `SUPPORT` / `ADMIN`;
- роль `SUPPORT` видит данные, но не меняет тарифы и роли.

## Стек

- Next.js 16 (App Router, Server Actions), React 19, TypeScript;
- Tailwind CSS 4, lucide-react;
- PostgreSQL + Drizzle ORM;
- PGlite для локальной разработки без установки Postgres;
- jose + bcryptjs (сессии и пароли).

## Быстрый старт

```bash
npm install
npm run db:migrate     # применить миграции (локально — в ./.data/pg)
npm run db:seed        # демо-салон, платформа, заявка на тариф
npm run dev            # http://localhost:3000
```

Если миграция применялась вручную, синхронизируйте журнал: `npm run db:sync`.

Демо-доступы (только локальная разработка; `npm run db:seed` отказывается
работать при `NODE_ENV=production`):

| Роль | Email | Пароль |
| --- | --- | --- |
| Владелец салона Atelier Noir | `owner@uzbook.online` | `owner1234` |
| Администратор платформы | `admin@uzbook.online` | `admin1234` |
| Поддержка | `support@uzbook.online` | `support1234` |
| Владелец демо-салона | `demo@uzbook.online` | `demo1234` |
| Владелец Barber House | `barber@uzbook.online` | `barber1234` |

В production демо-пользователи не создаются. Первого администратора создайте
из своих значений:

```bash
# в .env: ADMIN_EMAIL, ADMIN_PASSWORD (12+ символов), ADMIN_NAME
npm run admin:create
```

Демо-страницы записи: http://localhost:3000/atelier-noir и http://localhost:3000/barber-house

После входа администратору платформы (`admin@uzbook.online`) доступна админка `/admin`:
MRR, бизнесы, пользователи и подтверждение оплат по тарифам. Владелец салона видит
конструктор страницы в `/dashboard/profile` (основное, блоки, дизайн, галерея, QR-код).

## Переменные окружения

```env
# Пусто → локальный PGlite в ./.data/pg
DATABASE_URL=

# ВНИМАНИЕ: PGlite работает в файловой системе и строго поддерживает только ОДИН процесс.
# Нельзя подключать к одной директории PGlite несколько параллельных процессов (например, Next.js и maintenance или несколько реплик).
# Для продакшена и масштабирования обязательно используйте PostgreSQL через DATABASE_URL.

# Docker compose: PostgreSQL и порт на хосте
POSTGRES_DB=uzbook
POSTGRES_USER=uzbook
POSTGRES_PASSWORD=change-me-in-production
APP_PORT=3000

# Обязательно поменять в production (мин. 32 символа)
AUTH_SECRET=dev-only-secret-change-me-please-32chars-min

# Публичный адрес: страница записи и возврат после оплаты
APP_URL=http://localhost:3000

# Тестовые платежи: включают тариф бесплатно. В production выключить!
PAYMENTS_DEMO=off

# Payme (checkout + webhook /api/payments/payme)
PAYME_MERCHANT_ID=
PAYME_KEY=

# Click (checkout + webhook /api/payments/click)
CLICK_SERVICE_ID=
CLICK_MERCHANT_ID=
CLICK_SECRET_KEY=

# Реальные реквизиты для ручного перевода (пусто — показываем только поддержку)
PAYMENT_DETAILS=
SUPPORT_TELEGRAM=@uzbook_support

# Показывать демо-доступы на /login (в production только для staging)
SHOW_DEMO_ACCOUNTS=off

# Первый администратор для `npm run admin:create`
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=Администратор
```

При старте production-сервера `src/instrumentation.ts` проверяет окружение:
`AUTH_SECRET`, `APP_URL`, пароль PostgreSQL, целостность пар Payme/Click и
отсутствие тестовой карты в `PAYMENT_DETAILS`. Ошибка останавливает контейнер,
чтобы приложение не работало с dev-секретом или фейковыми реквизитами.

## Оплата и лимиты

Онлайн-оплата включается автоматически после подтверждения провайдером:

- **Payme** — `https://checkout.paycom.uz`, webhook `POST /api/payments/payme`
  (Merchant API: CheckPerform/Create/Perform/Cancel/Check/GetStatement).
  В кабинете Payme укажите URL webhook и ключ из `PAYME_KEY`.
- **Click** — `https://my.click.uz/services/pay`, webhook `POST /api/payments/click`
  (Prepare/Complete, MD5-подпись). Нужны `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`,
  `CLICK_SECRET_KEY`.
- **Тестовый платёж** — работает при `PAYMENTS_DEMO=on`, включает тариф без денег.
  Перед production обязательно `PAYMENTS_DEMO=off`.
- **Ручной перевод** — заявка `PENDING`, подтверждает админ в `/admin/requests`.

Тариф активируется на 30 дней; при продлении дни добавляются к текущему периоду.
Лимиты мастеров, услуг и хранилища проверяются на сервере при создании и загрузке.
После окончания trial редактирование страницы, услуг, мастеров и галереи блокируется,
а записи клиентов и публичная страница продолжают работать.

## Структура

```
src/app/                 маршруты (публичные, кабинет, админка, API)
src/components/          UI: публичная страница, кабинет, админка
src/server/actions/      server actions: auth, каталог, записи, профиль, админ
src/server/booking/      слоты, создание/перенос/отмена, время
src/server/business/     выборки бизнеса, расписание дня, данные админки
src/server/db/           Drizzle schema и подключение
drizzle/                 SQL-миграции
scripts/                 migrate, seed, maintenance
Dockerfile               standalone-образ + цель maintenance
docker-compose*.yml       PostgreSQL / PGlite, uploads volumes
```

## Модель данных (кратко)

- `users` — владельцы, поддержка, админы;
- `businesses` — один бизнес на владельца (MVP), slug = публичный адрес,
  `settings` (JSONB) и `theme` (JSONB);
- `staff`, `services`, `staff_services` — команда и каталог;
- `working_hours` — недельное расписание, `schedule_exceptions` — выходные/особые дни;
- `clients` — клиенты бизнеса, уникальны по телефону в рамках бизнеса;
- `bookings` — запись с буферами, ценой, статусом, источником и `manage_token`;
- `subscriptions` — история тарифов и заявок (`PENDING` → `ACTIVE`);
- `payments` — онлайн-платежи: провайдер, сумма, статус, внешний номер заказа.

## Деплой

### Docker + PostgreSQL (рекомендуется)

Нужны Docker Engine и Compose v2. На сервере:

```bash
cp .env.example .env
# откройте .env и задайте:
#   APP_URL=https://uzbook.online
#   AUTH_SECRET=$(openssl rand -base64 32)
#   POSTGRES_PASSWORD=<сильный пароль>
#   PAYMENTS_DEMO=off
#   PAYME_* / CLICK_* / CRYPTO_* — реальные ключи

docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health

# первый администратор (использует ADMIN_EMAIL / ADMIN_PASSWORD из .env)
docker compose run --rm --no-deps maintenance \
  node ./node_modules/tsx/dist/cli.mjs scripts/create-admin.ts
```

Что делает compose:

- `db` — PostgreSQL 17, данные в volume `pg_data`;
- `app` — Next.js standalone в непривилегированном контейнере, миграции
  применяются при старте (`RUN_MIGRATIONS_ON_START=true`);
- `maintenance` — раз в час закрывает истёкшие подписки и отменяет брошенные
  платежи старше 24 часов (отдельный образ с `tsx`);
- загруженные картинки — в volume `uploads` (`/app/.data/uploads`);
- healthcheck — `GET /api/health` (проверяет и БД).

Автоматические миграции рассчитаны на один экземпляр `app`. Для нескольких
реплик вынесите миграции в отдельный job и настройте общий кэш Next.js. Если
нужна внешняя PostgreSQL, уберите сервис `db` и задайте `DATABASE_URL`
вручную в `environment` сервиса `app`.

В compose `PAYMENTS_DEMO` принудительно выставлен в `off`, чтобы локальный
`.env` не включил бесплатные тестовые оплаты в production. Для тестового
стенда поменяйте значение в compose на `on`.

Поставьте HTTPS-прокси (nginx/Caddy) перед портом приложения. Compose публикует
порт только на `127.0.0.1`, поэтому снаружи должен быть только прокси. Готовый
пример с лимитом тела 12 МБ, редиректом на HTTPS и rate limit для webhook:
[`deploy/nginx.conf`](./deploy/nginx.conf).

`APP_URL` должен совпадать с публичным HTTPS-адресом: от него зависят QR-коды
и возврат после оплаты.

CI (`.github/workflows/ci.yml`) запускает `typecheck`, `build` и
`npm audit --omit=dev` на каждый push в `main` и pull request.

Сборка образа требует интернет: `npm ci` скачивает зависимости, а
`next/font/google` — шрифты. Если у сервера нет выхода наружу, соберите образ
на CI и перенесите его через registry.

### Docker + PGlite (маленький сервер)

Для одного небольшого бизнеса можно без PostgreSQL:

```bash
docker compose -f docker-compose.pglite.yml up -d --build
```

PGlite и загрузки лежат в volume `app_data`. Это один процесс и одна реплика:
нельзя запускать второй контейнер приложения на том же volume. Для отдельных
worker-контейнеров нужен PostgreSQL-вариант.

### Обновление и бэкапы

```bash
# обновление + healthcheck
./deploy/deploy.sh

# PostgreSQL + uploads в ./backups/<timestamp>
./deploy/backup.sh

# PGlite: сначала остановить приложение, потом скопировать volume.
# Имя volume смотрите в `docker volume ls` (обычно <проект>_app_data).
docker compose -f docker-compose.pglite.yml stop app
docker run --rm -v uzbook_app_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/uzbook-pglite.tgz -C /data .
```

`docker compose down -v` удаляет базы и загрузки — не используйте его без
резервной копии. В пароле PostgreSQL не должно быть символов `@`, `:` и `/`
без процентного кодирования: он подставляется в `DATABASE_URL`.

### Без Docker

1. Поднимите PostgreSQL и задайте `DATABASE_URL`.
2. `npm ci && npm run db:migrate && npm run build`.
3. `npm start` под systemd/pm2.
4. `npm run maintenance` — по cron раз в час (или отдельным worker-процессом).

Перед production: выключите `PAYMENTS_DEMO`, смените `AUTH_SECRET` и пароль
PostgreSQL, уберите демо-пользователей и демо-данные. Cookie сессии в
production уходит только по `secure`, поэтому HTTPS обязателен.

Локальная PGlite подходит для разработки и одного небольшого инстанса: один
процесс, нет репликации. Для нескольких реплик нужен обычный Postgres.

### Тестирование и валидация

В проект включен набор интеграционных тестов, проверяющих всю бизнес-логику:

```bash
# 1. Проверка типов TypeScript
npm run typecheck

# 2. Сквозные сценарии платформы
npx tsx scripts/test-fullstack-scenarios.ts

# 3. Лимиты тарифов и история подписок
npx tsx scripts/test-billing-feature.ts

# 4. Платежи beta (Payme, Click, Crypto USDT, возвраты, TTL)
npx tsx scripts/test-payments-lifecycle.ts

# 5. REST API v1 (JWT Access/Refresh, слоты, бронирования, кабинет владельца)
npx tsx scripts/test-api-v1.ts

# 6. Мобильное приложение (хранилище токенов, Deep Links, клиент)
npx tsx scripts/test-mobile-app.ts

# 7. Предрелизный аудит (Release Gates)
npx tsx scripts/release-check.ts
```

## REST API v1 и Мобильное приложение

- **Интерактивная документация API (Swagger UI):** доступна по адресу `https://uzbook.uz/api/v1/docs` (спецификация OpenAPI: `/api/v1/openapi.json`).
- **Мобильное приложение (iOS & Android):** исходный код и конфигурация EAS Build расположены в директории [`mobile/`](./mobile/README.md).
- **Регламент эксплуатации и деплоя:** описан в [`deploy/RUNBOOK.md`](./deploy/RUNBOOK.md).
- **Политика конфиденциальности:** доступна в [`docs/PRIVACY.md`](./docs/PRIVACY.md).

