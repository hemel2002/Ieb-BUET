import "server-only";
import { db } from "./db";

export type AttemptLimit = { key: string; max: number };

/**
 * Concurrency-safe attempt limiting. Each attempt records itself *before* the expensive
 * check and then counts the window including itself. The n-th row to commit always sees at
 * least n rows, so a burst of parallel requests cannot all slip under the limit (a count
 * taken before recording would let every request in the burst see the same old total).
 *
 * Returns the reserved row ids and the first key whose limit is exceeded, if any.
 * The caller keeps the rows as the failure record, or releases them on success or rejection.
 */
export async function reserveAttempts(limits: AttemptLimit[], windowMs: number) {
  const rows = await db.loginAttempt.createManyAndReturn({
    data: limits.map(({ key }) => ({ key })),
    select: { id: true },
  });
  const since = new Date(Date.now() - windowMs);
  const counts = await Promise.all(
    limits.map(({ key }) => db.loginAttempt.count({ where: { key, createdAt: { gt: since } } })),
  );
  const exceeded = limits.find((limit, i) => counts[i] > limit.max)?.key ?? null;
  return { ids: rows.map((r) => r.id), exceeded };
}

export async function releaseAttempts(ids: number[]) {
  if (ids.length) await db.loginAttempt.deleteMany({ where: { id: { in: ids } } });
}
