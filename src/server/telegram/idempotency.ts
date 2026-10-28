const processedUpdates = new Map<number, number>();
const MAX_UPDATES = 10_000;
const TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Checks whether this Telegram update_id has already been processed within the TTL window.
 * Protects against Telegram retry storms and duplicate processing.
 */
export function isUpdateProcessed(updateId: number): boolean {
  const now = Date.now();
  const existing = processedUpdates.get(updateId);
  if (existing && now - existing < TTL_MS) {
    return true;
  }
  return false;
}

/**
 * Marks a Telegram update_id as successfully processed.
 */
export function markUpdateProcessed(updateId: number): void {
  const now = Date.now();
  processedUpdates.set(updateId, now);

  if (processedUpdates.size > MAX_UPDATES) {
    for (const [id, ts] of processedUpdates.entries()) {
      if (now - ts > TTL_MS) {
        processedUpdates.delete(id);
      }
    }
  }
}
