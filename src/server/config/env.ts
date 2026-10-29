/**
 * Production environment checks.
 *
 * Next.js calls `instrumentation.ts` once when a server instance starts. The
 * checks below fail fast instead of silently running production with the local
 * development secret, a fake payment card or half-configured acquiring.
 */

export const DEV_AUTH_SECRET = "dev-only-secret-change-me-please-32chars-min";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const FAKE_CARD = /8600[\s-]*0000[\s-]*0000[\s-]*0000/;

export type EnvCheck = {
  errors: string[];
  warnings: string[];
};

function value(env: NodeJS.ProcessEnv, key: string): string {
  return env[key]?.trim() ?? "";
}

function isProduction(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
}

export function validateProductionEnv(env: NodeJS.ProcessEnv = process.env): EnvCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isProduction(env)) return { errors, warnings };

  const secret = value(env, "AUTH_SECRET");
  if (!secret) {
    errors.push("AUTH_SECRET is required in production.");
  } else if (secret === DEV_AUTH_SECRET || secret.length < 32) {
    errors.push("AUTH_SECRET must be a unique random value of at least 32 characters.");
  }

  const appUrl = value(env, "APP_URL");
  if (!appUrl) {
    errors.push("APP_URL is required in production (for example https://uzbook.online).");
  } else {
    try {
      const parsed = new URL(appUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        errors.push("APP_URL must use http or https.");
      } else if (parsed.protocol !== "https:" && !LOCAL_HOSTS.has(parsed.hostname)) {
        errors.push("APP_URL must use https outside localhost; secure session cookies require it.");
      }
    } catch {
      errors.push("APP_URL must be a valid absolute URL.");
    }
  }

  if (!value(env, "DATABASE_URL")) {
    warnings.push(
      "DATABASE_URL is empty: the app will use PGlite. Use PostgreSQL for production, especially with the Telegram bot or more than one process.",
    );
  }

  const postgresPassword = value(env, "POSTGRES_PASSWORD");
  if (postgresPassword === "change-me-in-production") {
    errors.push("POSTGRES_PASSWORD still has the example value.");
  }

  const demoFlag = value(env, "PAYMENTS_DEMO").toLowerCase();
  if (["on", "true", "1", "yes"].includes(demoFlag)) {
    if (value(env, "ALLOW_PRODUCTION_DEMO_PAYMENTS").toLowerCase() === "on") {
      warnings.push("PAYMENTS_DEMO is on with ALLOW_PRODUCTION_DEMO_PAYMENTS=on: free test payments are enabled.");
    } else {
      errors.push("PAYMENTS_DEMO must be off in production (or set ALLOW_PRODUCTION_DEMO_PAYMENTS=on for a staging demo).");
    }
  }

  const payme = [value(env, "PAYME_MERCHANT_ID"), value(env, "PAYME_KEY")];
  if (payme.some(Boolean) && !payme.every(Boolean)) {
    errors.push("Payme is partially configured: set both PAYME_MERCHANT_ID and PAYME_KEY.");
  } else if (payme.every(Boolean) && !value(env, "PAYME_IP_ALLOWLIST")) {
    warnings.push("PAYME_IP_ALLOWLIST is empty: set Payme webhook subnet allowlist in production.");
  }

  const click = [
    value(env, "CLICK_SERVICE_ID"),
    value(env, "CLICK_MERCHANT_ID"),
    value(env, "CLICK_SECRET_KEY"),
  ];
  if (click.some(Boolean) && !click.every(Boolean)) {
    errors.push(
      "Click is partially configured: set CLICK_SERVICE_ID, CLICK_MERCHANT_ID and CLICK_SECRET_KEY.",
    );
  } else if (click.every(Boolean) && !value(env, "CLICK_IP_ALLOWLIST")) {
    warnings.push("CLICK_IP_ALLOWLIST is empty: set Click webhook subnet allowlist in production.");
  }

  const cryptoFlag = value(env, "PAYMENTS_CRYPTO").toLowerCase();
  if (["on", "true", "1", "yes"].includes(cryptoFlag) && !value(env, "CRYPTO_DEPOSIT_ADDRESS")) {
    errors.push("PAYMENTS_CRYPTO is enabled, but CRYPTO_DEPOSIT_ADDRESS is not set.");
  }

  const botToken = value(env, "TELEGRAM_BOT_TOKEN");
  const botUsername = value(env, "TELEGRAM_BOT_USERNAME");
  if (botToken && !botUsername) {
    warnings.push("TELEGRAM_BOT_USERNAME is empty: Telegram payment and linking links may not work.");
  }
  if (!botToken && botUsername) {
    warnings.push("TELEGRAM_BOT_USERNAME is set without TELEGRAM_BOT_TOKEN.");
  }

  const paymentDetails = value(env, "PAYMENT_DETAILS");
  if (FAKE_CARD.test(paymentDetails)) {
    errors.push("PAYMENT_DETAILS still contains the example card number.");
  } else if (!paymentDetails) {
    warnings.push("PAYMENT_DETAILS is empty: the billing page will only show the support contact.");
  }

  if (["on", "true", "1", "yes"].includes(value(env, "SHOW_DEMO_ACCOUNTS").toLowerCase())) {
    warnings.push("SHOW_DEMO_ACCOUNTS is on: demo credentials are visible on the login page.");
  }

  return { errors, warnings };
}

/** Throws when a production server starts with an unsafe configuration. */
export function assertProductionEnv(env: NodeJS.ProcessEnv = process.env): void {
  const { errors, warnings } = validateProductionEnv(env);

  for (const warning of warnings) console.warn(`[env] ${warning}`);

  if (errors.length > 0) {
    throw new Error(
      `Invalid production environment:\n- ${errors.join("\n- ")}\n` +
        "Fix the values in .env and restart the container.",
    );
  }
}

/**
 * Returns the session signing secret. Development keeps the old fallback so
 * local setup stays zero-config; production refuses a missing/default secret.
 */
export function authSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = value(env, "AUTH_SECRET");
  if (isProduction(env) && (!secret || secret === DEV_AUTH_SECRET || secret.length < 32)) {
    throw new Error("AUTH_SECRET must be a unique random value of at least 32 characters.");
  }
  return secret || DEV_AUTH_SECRET;
}
