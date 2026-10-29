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

function normalizeIp(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase().startsWith("::ffff:")) {
    return trimmed.slice(7);
  }
  return trimmed;
}

/**
 * Extracts client IP from reverse-proxy headers.
 * Prefers `x-real-ip` set directly by nginx (`$remote_addr`), or the LAST hop in
 * `x-forwarded-for` appended by the trusted proxy — never the first hop, which
 * an attacker can spoof via a custom `X-Forwarded-For` request header.
 */
export function clientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return normalizeIp(realIp);

  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return normalizeIp(last);
  }
  return "unknown";
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let num = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet < 0 || octet > 255) return null;
    num = ((num << 8) | octet) >>> 0;
  }
  return num;
}

/**
 * Validates whether an incoming client IP matches a comma-separated allowlist.
 * Supports exact IPs, any IPv4 CIDR prefix (/0..32), or empty (unrestricted).
 */
export function isIpAllowed(ip: string, allowlistRaw?: string): boolean {
  if (!allowlistRaw || allowlistRaw.trim() === "" || allowlistRaw.trim() === "*") {
    return true;
  }

  const normalizedIp = normalizeIp(ip);

  // Allow localhost automatically only outside production
  if (
    process.env.NODE_ENV !== "production" &&
    (normalizedIp === "127.0.0.1" || normalizedIp === "::1" || normalizedIp === "localhost")
  ) {
    return true;
  }

  const allowed = allowlistRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;

  const ipInt = ipv4ToUint32(normalizedIp);

  return allowed.some((pattern) => {
    const cleanPattern = normalizeIp(pattern);
    if (cleanPattern.includes("/")) {
      const [network, prefixStr] = cleanPattern.split("/");
      const prefix = Number(prefixStr);
      const netInt = ipv4ToUint32(network ?? "");
      if (
        ipInt === null ||
        netInt === null ||
        !Number.isInteger(prefix) ||
        prefix < 0 ||
        prefix > 32
      ) {
        return false;
      }
      if (prefix === 0) return true;
      const mask = (0xffffffff << (32 - prefix)) >>> 0;
      return (ipInt & mask) >>> 0 === (netInt & mask) >>> 0;
    }
    return cleanPattern === normalizedIp;
  });
}
