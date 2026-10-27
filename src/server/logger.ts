type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  event: string;
  level?: LogLevel;
  message?: string;
  [key: string]: unknown;
}

const isProduction = process.env.NODE_ENV === "production";

function formatLog(level: LogLevel, payload: LogPayload) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    ...payload,
  };

  if (isProduction) {
    return JSON.stringify(entry);
  }

  const { event, message, ...rest } = payload;
  const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : "";
  return `[${timestamp}] [${level.toUpperCase()}] [${event}]${message ? ` ${message}` : ""}${extra}`;
}

export const logger = {
  info(event: string, payload: Omit<LogPayload, "event" | "level"> = {}) {
    console.log(formatLog("info", { event, ...payload }));
  },
  warn(event: string, payload: Omit<LogPayload, "event" | "level"> = {}) {
    console.warn(formatLog("warn", { event, ...payload }));
  },
  error(event: string, error: unknown, payload: Omit<LogPayload, "event" | "level"> = {}) {
    const errObj =
      error instanceof Error
        ? { errorMessage: error.message, errorStack: error.stack }
        : { errorMessage: String(error) };

    console.error(formatLog("error", { event, ...errObj, ...payload }));
  },
};
