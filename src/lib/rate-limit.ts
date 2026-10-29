import "server-only";

/**
 * Fixed-window in-memory limiter. Suitable for the single-instance deployment this
 * app targets; comment limits are additionally enforced from the database so they
 * survive restarts.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  bucket.count++;
  return { ok: bucket.count <= limit, retryAfterMs: bucket.resetAt - now };
}

export function reset(key: string) {
  buckets.delete(key);
}
