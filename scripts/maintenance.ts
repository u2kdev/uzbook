import { cancelStalePayments, expireUnpaidPayments } from "../src/server/payments/expiry";
import { expireSubscriptions } from "../src/server/subscriptions/expiry";
import { cleanOrphanedUploads } from "../src/server/storage/cleanup";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env is optional */
}

async function main() {
  const [subscriptions, staleCancelled, unpaidExpired, uploads] = await Promise.all([
    expireSubscriptions(),
    cancelStalePayments(),
    expireUnpaidPayments(),
    cleanOrphanedUploads(),
  ]);

  console.log(
    `[maintenance] expired subscriptions: ${subscriptions.expired}/${subscriptions.scanned}; cancelled stale: ${staleCancelled}; expired unpaid: ${unpaidExpired}; cleaned uploads: ${uploads.deleted}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[maintenance] failed", error);
    process.exit(1);
  });
