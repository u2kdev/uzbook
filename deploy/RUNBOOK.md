# uzbook Production Operations Runbook

Данный регламент описывает эксплуатацию, деплой, мониторинг, резервное копирование и разбор инцидентов для платформы **uzbook** в production-окружении.

---

## 1. Архитектура и компоненты системы

- **Web & API Backend:** Next.js 16 (App Router, Node.js runtime, standalone container).
- **База данных:** PostgreSQL 17 (Drizzle ORM).
- **Интеграции:**
  - Платежи: Payme, Click, Telegram Stars, Crypto (USDT TRC-20/TON), ручные заявки.
  - Telegram: бот (`@uzbook_bot`), Webhook + Mini App (`initData` crypto-validation).
  - Мобильное приложение: Expo React Native (REST API `/api/v1` с Bearer JWT).
- **Обратный прокси:** Nginx с TLS (Let's Encrypt Certbot), rate-limiting и HTTP/2.

---

## 2. Конфигурация окружения (.env)

| Переменная | Описание | Пример значения |
|---|---|---|
| `NODE_ENV` | Режим работы | `production` |
| `APP_URL` | Публичный HTTPS домен | `https://uzbook.uz` |
| `AUTH_SECRET` | 32+ байта случайный ключ JWT | `openssl rand -hex 32` |
| `DATABASE_URL` | Подключение к PostgreSQL | `postgresql://uzbook:pass@postgres:5432/uzbook` |
| `PAYMENTS_DEMO` | Тестовые мгновенные платежи | `off` в проде! |
| `CLICK_SERVICE_ID` | Идентификатор сервиса Click | из кабинета мерчанта Click |
| `CLICK_MERCHANT_ID` | Идентификатор мерчанта Click | из кабинета мерчанта Click |
| `CLICK_SECRET_KEY` | Секретный ключ подписи Click | из кабинета мерчанта Click |
| `PAYME_MERCHANT_ID` | Идентификатор мерчанта Payme | из кабинета Paycom |
| `PAYME_KEY` | Секретный ключ мерчанта Payme | из кабинета Paycom |
| `TELEGRAM_BOT_TOKEN`| Токен бота от BotFather | `123456:ABC-DEF...` |
| `TELEGRAM_BOT_USERNAME`| Юзернейм бота | `uzbook_bot` |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет заголовка Telegram | `openssl rand -hex 24` |
| `TELEGRAM_MINIAPP_URL`| URL веб-приложения Mini App | `https://uzbook.uz/dashboard` |

---

## 3. Регламент деплоя (Release Checklist)

### 3.1 Преддеплойная проверка
1. Убедитесь, что все CI проверки зелёные:
   ```bash
   npm run typecheck
   npm run build
   npx tsx scripts/release-check.ts
   ```
2. Проверьте актуальность миграций:
   ```bash
   npx tsx scripts/migrate.ts
   ```

### 3.2 Процедура обновления (Zero-Downtime)
```bash
# 1. Переход в директорию проекта
cd /opt/uzbook

# 2. Создание превентивного бэкапа БД
./deploy/backup.sh pre_deploy

# 3. Подтягивание изменений из Git
git pull origin main

# 4. Сборка и перезапуск контейнеров
docker compose build --pull web
docker compose up -d --no-deps web

# 5. Проверка статуса здоровья сервиса
curl -fsS https://uzbook.uz/api/health || echo "HEALTHCHECK FAILED!"
```

---

## 4. Резервное копирование и восстановление

### 4.1 Автоматический бэкап
Бэкап базы данных выполняется ежедневно по cron (`0 3 * * *`):
```bash
# Запуск вручную:
./deploy/backup.sh manual_backup
```
Архивы сохраняются в `/opt/uzbook/backups/uzbook_YYYYMMDD_HHMMSS.sql.gz`. Хранится глубина в 14 дней (автоматическая ротация).

### 4.2 Восстановление из бэкапа
```bash
./deploy/restore.sh /opt/uzbook/backups/uzbook_20261028_030000.sql.gz
```

---

## 5. Регламентные задачи (Cron & Maintenance)

Каждые 15 минут запускается регламентный скрипт:
```bash
*/15 * * * * cd /opt/uzbook && npx tsx scripts/maintenance.ts >> /var/log/uzbook_cron.log 2>&1
```
Что делает регламентный скрипт:
1. `expireUnpaidPayments(30)` — отменяет просроченные заказы со статусом `CREATED` старше 30 минут (переводит в `EXPIRED`).
2. `cancelStalePayments()` — очищает брошенные заказы старше 24 часов.
3. Очищает временные загрузки и неиспользуемые токены.

---

## 6. Разбор инцидентов и чеклист поддержки

### 6.1 Не прошёл платёж клиента / не включился тариф
1. Откройте панель `/admin/businesses` или найдите платёж в базе данных:
   ```sql
   SELECT id, business_id, provider, status, amount, provider_txn_id, created_at 
   FROM payments 
   WHERE external_id = 'ORDER_UUID';
   ```
2. Если платёж успешен в выписке Payme/Click, но завис в системе:
   - Выполните сверку через административное действие или скрипт:
     ```bash
     npx tsx -e 'import { completePayment } from "./src/server/payments/service"; completePayment({ externalId: "ORDER_UUID", providerTxnId: "BANK_TXN_ID" })'
     ```
3. Проверьте `audit_logs` для отслеживания истории изменений:
   ```sql
   SELECT * FROM audit_logs WHERE entity_id = 'PAYMENT_ID' ORDER BY created_at DESC;
   ```

### 6.2 Возврат средств (Refund)
- Возврат инициируется администратором через `adminRefundPaymentAction` в кабинете `/admin` или `refundPayment()` в `service.ts`.
- При возврате статус заказа становится `REFUNDED`, подписка аннулируется, тариф сбрасывается на `TRIAL`, а в `audit_logs` записывается причина и ID ответственного оператора.

### 6.3 Блокировка и аномалии вебхуков
- При превышении 10 сбоев валидации подписи за 5 минут срабатывает алерт `trackWebhookFailure`.
- Проверьте логи: `docker compose logs -f web | grep "payment.webhook_failure"`.
- Проверьте актуальность IP-адресов в `CLICK_IP_ALLOWLIST` и `PAYME_IP_ALLOWLIST`.

---

## 7. Контакты экстренной поддержки

- **DevOps / Sysadmin:** devops@uzbook.uz
- **Telegram Support:** `@uzbook_support`
