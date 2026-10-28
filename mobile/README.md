# uzbook Mobile Application (iOS & Android)

Официальное кроссплатформенное мобильное приложение uzbook, разработанное на **React Native** и **Expo SDK 52**.

Приложение предназначено для двух целевых аудиторий:
1. **Клиенты салонов:**
   - Поиск салона и переход по QR-коду или ссылке (`uzbook://salon/:slug`).
   - Просмотр каталога услуг, прайс-листа и мастеров.
   - Выбор удобного времени через интерактивную сетку свободных окон.
   - Создание записи без обязательной регистрации.
   - Просмотр «Моих записей» по номеру телефона, перенос слота и отмена.
2. **Владельцы салонов и мастера:**
   - Авторизация с Bearer JWT токенами и автоматической ротацией через Refresh Token.
   - Экран «Сегодня» с ключевыми метриками (выручка, общее количество, ожидающие подтверждения).
   - Таймлайн записей на текущий день с действиями в 1 клик: «Подтвердить», «Завершить», «Отменить», «Не явился».
   - Push-уведомления о новых онлайн-записях.

---

## Структура проекта

```
mobile/
├── App.tsx                     # Корневой компонент с маршрутизацией экранов и deep links
├── app.json                    # Конфигурация Expo (scheme: uzbook, permissions, plugins)
├── eas.json                    # Профили сборки EAS Build (development, preview APK, production)
├── index.js                    # Точка входа Expo registerRootComponent
├── package.json                # Зависимости Expo, React Native
├── tsconfig.json               # Настройки TypeScript
└── src/
    ├── api/
    │   ├── client.ts           # Типизированный клиент REST API v1 с автообновлением токенов
    │   └── storage.ts          # Безопасное хранилище SecureStore / Memory fallback
    ├── config/
    │   └── env.ts              # Конфигурация URL бекенда и ключей хранилища
    ├── linking/
    │   └── deep-links.ts       # Парсер deep-ссылок (uzbook://salon/..., uzbook://booking/...)
    ├── notifications/
    │   └── push.ts             # Управление Push-уведомлениями через expo-notifications
    └── screens/
        ├── ClientHomeScreen.tsx    # Поиск салона и вход по номеру телефона
        ├── SalonDetailScreen.tsx   # Прайс-лист, мастера и профиль салона
        ├── BookingWizardScreen.tsx # Пошаговый выбор слота и оформление записи
        ├── MyBookingsScreen.tsx    # История записей клиента, перенос и отмена
        ├── OwnerLoginScreen.tsx    # Авторизация владельца / мастера
        └── OwnerTodayScreen.tsx    # Дашборд дня с быстрыми статусами
```

---

## Запуск в разработке

1. **Установка зависимостей:**
   ```bash
   cd mobile
   npm install
   ```

2. **Запуск Expo Dev Server:**
   ```bash
   npx expo start
   ```

3. **Тестирование:**
   - Нажмите `a` для запуска в Android Emulator.
   - Нажмите `i` для запуска в iOS Simulator.
   - Отсканируйте QR-код в приложении **Expo Go** на физическом смартфоне (Android / iPhone).

---

## Сборка через Expo EAS Build (10.4)

Для сборки автономных установочных файлов без необходимости локального Android Studio / Xcode используется облачная сборка **Expo Application Services (EAS)**:

1. **Установка EAS CLI и авторизация:**
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. **Сборка тестового APK (для реальных Android устройств):**
   ```bash
   eas build --profile preview --platform android
   ```
   *По завершении EAS сгенерирует прямую ссылку на скачивание `.apk` файла.*

3. **Сборка для iOS (TestFlight / AdHoc):**
   ```bash
   eas build --profile preview --platform ios
   ```

4. **Продакшн-сборка для магазинов (Google Play & App Store):**
   ```bash
   eas build --profile production --platform all
   ```
   *Создаёт `.aab` для Google Play Console и `.ipa` для App Store Connect.*

---

## Deep Linking

Приложение поддерживает схему `uzbook://`:
- `uzbook://salon/barber-pro` — прямой переход на карточку салона.
- `uzbook://booking/xyz123token` — переход к карточке управления записью.
- `uzbook://owner/today` — переход к дашборду владельца.

## Push-уведомления

Интегрирован модуль `expo-notifications`. При первом запуске запрашиваются разрешения `POST_NOTIFICATIONS`. Полученный токен передаётся на бекенд для отправки уведомлений о напоминаниях и новых записях.
