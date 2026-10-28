import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { clientIp, rateLimit } from "@/server/http/rate-limit";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json(
    {
      success: true,
      data,
      ...(meta ? { meta } : {}),
    },
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

export function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    return apiError(err.code, err.message, err.status, err.details);
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return apiError(
      "validation_error",
      "Неверные входные данные запроса",
      422,
      issues,
    );
  }

  const message = err instanceof Error ? err.message : "Неизвестная ошибка сервера";
  console.error("Unhandled API v1 Error:", err);
  return apiError("internal_error", message, 500);
}

export function checkApiRateLimit(
  request: Request,
  prefix: string,
  maxRequests = 100,
  windowMs = 60_000,
): Response | null {
  const ip = clientIp(request);
  const result = rateLimit(`api_v1:${prefix}:${ip}`, maxRequests, windowMs);
  if (!result.ok) {
    return apiError(
      "rate_limit_exceeded",
      "Слишком много запросов. Попробуйте позже",
      429,
      {
        retryAfterSec: Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000)),
      },
    );
  }
  return null;
}
