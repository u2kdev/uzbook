import { initBotInstance } from "../src/server/telegram/bot-instance";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();

if (!token) {
  console.error(
    "TELEGRAM_BOT_TOKEN не задан. Добавьте токен от @BotFather в .env и запустите `npm run bot` снова.",
  );
  process.exit(1);
}

const bot = initBotInstance(token);

async function main() {
  await bot.api.setMyCommands([
    { command: "today", description: "Записи на сегодня" },
    { command: "app", description: "Открыть Mini App" },
    { command: "help", description: "Помощь и команды" },
    { command: "unlink", description: "Отвязать аккаунт" },
    { command: "stats", description: "Статистика системы (ADMIN)" },
  ]);

  console.log(`[Telegram Bot] Started long polling (pid: ${process.pid}, node: ${process.version})`);

  // Graceful shutdown handling
  const stop = () => {
    console.log("[Telegram Bot] Stopping gracefully...");
    bot.stop();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await bot.start({
    drop_pending_updates: false,
    allowed_updates: ["message", "callback_query", "pre_checkout_query"],
  });
}

main().catch((error) => {
  console.error("[Telegram Bot] Fatal error on startup:", error);
  process.exit(1);
});
