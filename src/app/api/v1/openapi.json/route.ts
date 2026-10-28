import { NextResponse } from "next/server";
import { appUrl } from "@/server/payments/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const currentAppUrl = appUrl();

  const openapiSpec = {
    openapi: "3.1.0",
    info: {
      title: "uzbook Mobile & Public REST API",
      version: "1.0.0",
      description:
        "Официальный REST API платформы uzbook для мобильных приложений (iOS / Android Expo) и публичных интеграций.",
      contact: {
        name: "uzbook Support",
        url: currentAppUrl,
      },
    },
    servers: [
      {
        url: `${currentAppUrl}/api/v1`,
        description: "Основной сервер API",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Передавайте access_token в заголовке `Authorization: Bearer <token>`",
        },
      },
      schemas: {
        ApiSuccess: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { type: "object" },
            meta: { type: "object" },
          },
          required: ["success", "data"],
        },
        ApiError: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                code: { type: "string", example: "validation_error" },
                message: { type: "string", example: "Неверные входные данные" },
                details: {},
              },
              required: ["code", "message"],
            },
          },
          required: ["success", "error"],
        },
      },
    },
    paths: {
      "/auth/login": {
        post: {
          summary: "Авторизация владельца / мастера",
          description: "Возвращает пару JWT токенов (access + refresh), данные пользователя и информацию о салоне.",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email", example: "salon@example.uz" },
                    password: { type: "string", example: "strong_password_123" },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: {
            200: { description: "Успешная авторизация" },
            401: { description: "Неверный логин или пароль" },
            422: { description: "Ошибка валидации полей" },
          },
        },
      },
      "/auth/refresh": {
        post: {
          summary: "Обновление access токена",
          description: "Обменивает долгоживущий refreshToken на новую пару токенов.",
          tags: ["Auth"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    refreshToken: { type: "string" },
                  },
                  required: ["refreshToken"],
                },
              },
            },
          },
          responses: {
            200: { description: "Токены успешно обновлены" },
            401: { description: "Недействительный refreshToken" },
          },
        },
      },
      "/auth/me": {
        get: {
          summary: "Текущий профиль",
          tags: ["Auth"],
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Профиль авторизованного пользователя и салон" },
            401: { description: "Не авторизован" },
          },
        },
      },
      "/salons/{slug}": {
        get: {
          summary: "Публичные данные салона",
          description: "Возвращает информацию о салоне, прайс-лист услуг, список мастеров и галерею.",
          tags: ["Public Salons"],
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Информация о салоне" },
            404: { description: "Салон не найден" },
          },
        },
      },
      "/salons/{slug}/availability": {
        get: {
          summary: "Доступные слоты для записи",
          tags: ["Public Salons"],
          parameters: [
            { name: "slug", in: "path", required: true, schema: { type: "string" } },
            { name: "staffId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
            { name: "serviceId", in: "query", required: true, schema: { type: "string", format: "uuid" } },
            { name: "date", in: "query", required: false, schema: { type: "string", example: "2026-10-30" } },
            { name: "days", in: "query", required: false, schema: { type: "integer", default: 1, maximum: 14 } },
          ],
          responses: {
            200: { description: "Свободные интервалы времени" },
            400: { description: "Мастер не оказывает услугу" },
          },
        },
      },
      "/bookings": {
        post: {
          summary: "Создание онлайн-записи",
          tags: ["Public Bookings"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    slug: { type: "string" },
                    staffId: { type: "string", format: "uuid" },
                    serviceId: { type: "string", format: "uuid" },
                    startAt: { type: "string", format: "date-time" },
                    name: { type: "string" },
                    phone: { type: "string", example: "+998901234567" },
                    email: { type: "string", format: "email" },
                    note: { type: "string" },
                  },
                  required: ["slug", "staffId", "serviceId", "startAt", "name", "phone"],
                },
              },
            },
          },
          responses: {
            201: { description: "Запись успешно создана" },
            409: { description: "Выбранный слот уже занят" },
          },
        },
        get: {
          summary: "Поиск записей клиента по номеру телефона",
          description: "Позволяет мобильному приложению получить список «Мои записи» клиента без регистрации.",
          tags: ["Public Bookings"],
          parameters: [
            { name: "phone", in: "query", required: true, schema: { type: "string", example: "+998901234567" } },
          ],
          responses: {
            200: { description: "История записей клиента" },
          },
        },
      },
      "/bookings/{token}": {
        get: {
          summary: "Детали записи по секретному токену",
          tags: ["Public Bookings"],
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            200: { description: "Детали записи" },
            404: { description: "Запись не найдена" },
          },
        },
      },
      "/bookings/{token}/cancel": {
        post: {
          summary: "Отмена записи клиентом",
          tags: ["Public Bookings"],
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    reason: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: "Запись успешно отменена" },
          },
        },
      },
      "/bookings/{token}/reschedule": {
        post: {
          summary: "Перенос записи на другое время",
          tags: ["Public Bookings"],
          parameters: [
            { name: "token", in: "path", required: true, schema: { type: "string" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    startAt: { type: "string", format: "date-time" },
                  },
                  required: ["startAt"],
                },
              },
            },
          },
          responses: {
            200: { description: "Запись успешно перенесена" },
            409: { description: "Новое время уже занято" },
          },
        },
      },
      "/owner/today": {
        get: {
          summary: "Расписание и сводка на сегодня",
          tags: ["Owner / Management"],
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "date", in: "query", required: false, schema: { type: "string", example: "2026-10-30" } },
          ],
          responses: {
            200: { description: "Таймлайн и метрики за выбранный день" },
            401: { description: "Не авторизован" },
          },
        },
      },
      "/owner/bookings": {
        get: {
          summary: "Список записей салона с пагинацией и фильтрами",
          tags: ["Owner / Management"],
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] } },
            { name: "staffId", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "fromDate", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "toDate", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
            { name: "offset", in: "query", schema: { type: "integer", default: 0 } },
          ],
          responses: {
            200: { description: "Список записей" },
          },
        },
      },
      "/owner/bookings/{id}/status": {
        patch: {
          summary: "Изменение статуса записи владельцем",
          tags: ["Owner / Management"],
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", enum: ["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"] },
                    reason: { type: "string" },
                  },
                  required: ["status"],
                },
              },
            },
          },
          responses: {
            200: { description: "Статус успешно изменён" },
          },
        },
      },
      "/owner/services": {
        get: {
          summary: "Список услуг салона",
          tags: ["Owner / Management"],
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Каталог услуг" },
          },
        },
      },
      "/owner/staff": {
        get: {
          summary: "Список мастеров салона",
          tags: ["Owner / Management"],
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Мастера, графики и привязанные услуги" },
          },
        },
      },
    },
  };

  return NextResponse.json(openapiSpec, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
