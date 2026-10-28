# Telegram в Production (Бот, Webhook, Mini App)

Платформа **uzbook** поддерживает два режима работы Telegram-бота:
1. **Webhook (рекомендуется для высоконагруженного продакшена)**: запросы от Telegram приходят напрямую в Next.js API `/api/telegram/webhook`. Не требует отдельного запущенного фонового демона бота.
2. **Long Polling**: отдельный фоновый контейнер `bot`, который опрашивает Telegram API (`getUpdates`). Идеален для локальной разработки или серверов без прямого входящего HTTPS на Node.js.

---

## 1. Режим Webhook

### Настройка переменных окружения (`.env`)
```bash
TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
TELEGRAM_BOT_USERNAME="uzbook_bot"
TELEGRAM_WEBHOOK_SECRET="super-secret-webhook-token-min-32-chars"
APP_URL="https://uzbook.uz"
```

### Регистрация вебхука
Запустите команду для привязки вебхука с секретным токеном:
```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -d "url=${APP_URL}/api/telegram/webhook" \
  -d "secret_token=${TELEGRAM_WEBHOOK_SECRET}" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\"]"
```

### Безопасность и проверка подписи
- Каждый входящий запрос проверяется на равенство заголовка `X-Telegram-Bot-Api-Secret-Token` значению `TELEGRAM_WEBHOOK_SECRET` с использованием константного по времени сравнения (`crypto.timingSafeEqual`).
- Если заголовок не совпадает, сервер немедленно возвращает `401 Unauthorized`.

### Идемпотентность и защита от повторов
- Telegram автоматически повторяет отправку апдейта, если сервер не ответил за отведенный таймаут.
- Сервер отслеживает скользящее окно обработанных `update_id` (`src/server/telegram/idempotency.ts`), гарантируя, что платежи, привязки и записи не выполняются дважды.

---

## 2. Режим Long Polling (через Docker Compose)

Если вебхук не используется:
```bash
# Запуск приложения вместе с ботом в фоне:
docker compose --profile bot up -d --build
```

Контейнер `bot`:
- Автоматически перезапускается при падении (`restart: unless-stopped`).
- Дожидается готовности базы данных (`condition: service_healthy`) и применения миграций приложением `app`.
- Имеет `stop_grace_period: 20s` для корректного завершения активных соединений (`SIGTERM`).

---

## 3. Админ-команды и ограничение доступа

Команда `/stats` выводит сводную статистику платформы (число бизнесов, пользователей, активных подписок и состояние сервисов).
- Доступна исключительно пользователям с ролью `ADMIN` в таблице `users`.
- При вызове обычным пользователем или владельцем салона бот возвращает отказ в доступе.

---

## 4. Telegram Mini App (TMA)

Публичная страница салона (`/[slug]`) и страница управления записью (`/b/[token]`) оптимизированы для запуска внутри Telegram WebApp:
- Поддерживают deep links: `https://t.me/<bot>?start=book_<slug>`.
- Авторизация и защита через HMAC-SHA256 валидацию `initData` (`src/server/telegram/webapp.ts`).
- Stars-оплата тарифов (`/pay/[id]`) открывает нативный диалог оплаты внутри Telegram через `Telegram.WebApp.openInvoice`.
