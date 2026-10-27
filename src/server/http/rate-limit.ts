/**
 * Small in-memory limiter for public webhooks. It is intentionally simple:
 * the app is deployed as one Node process in the Docker setup. If you scale to
 * multiple replicas, replace this with Redis or a provider-side allowlist.
 */

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  // Drop expired buckets occasionally so a long-running process does not grow
  // its map forever.
  if (now - lastSweep > 60_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    lastSweep = now;
  }

  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (current.count >= limit) {
    return { ok: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { ok: true, remaining: limit - current.count, resetAt: current.resetAt };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Validates whether an incoming client IP matches a comma-separated allowlist.
 * Supports exact IPs, CIDR prefixes (/24, /16), or empty (unrestricted).
 */
export function isIpAllowed(ip: string, allowlistRaw?: string): boolean {
  if (!allowlistRaw || allowlistRaw.trim() === "" || allowlistRaw.trim() === "*") {
    return true;
  }
  // Allow localhost during local testing
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") {
    return true;
  }
  const allowed = allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) return true;

  return allowed.some((pattern) => {
    if (pattern.includes("/")) {
      const [network, prefixStr] = pattern.split("/");
      const prefix = parseInt(prefixStr, 10);
      if (prefix === 24) {
        const netParts = network.split(".").slice(0, 3).join(".");
        return ip.startsWith(netParts + ".");
      }
      if (prefix === 16) {
        const netParts = network.split(".").slice(0, 2).join(".");
        return ip.startsWith(netParts + ".");
      }
      if (prefix === 32) {
        return network === ip;
      }
    }
    return pattern === ip;
  });
}
