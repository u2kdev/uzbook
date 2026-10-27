import { cancelStalePayments } from "../src/server/payments/expiry";
import { expireSubscriptions } from "../src/server/subscriptions/expiry";
import { cleanOrphanedUploads } from "../src/server/storage/cleanup";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

async function main() {
  const [subscriptions, payments, uploads] = await Promise.all([
    expireSubscriptions(),
    cancelStalePayments(),
    cleanOrphanedUploads(),
  ]);

  console.log(
    `[maintenance] expired subscriptions: ${subscriptions.expired}/${subscriptions.scanned}; cancelled stale payments: ${payments}; cleaned orphaned uploads: ${uploads.deleted} (${uploads.freedBytes} bytes)`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[maintenance] failed", error);
    process.exit(1);
  });
