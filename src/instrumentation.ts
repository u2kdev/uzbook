/**
 * Runs once when the Next.js server starts. Environment problems must stop the
 * process before it serves traffic, otherwise production can boot with the
 * development session secret or fake acquiring credentials.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { assertProductionEnv } = await import("./server/config/env");
  assertProductionEnv();
}
