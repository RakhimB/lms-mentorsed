/**
 * Simple in-memory rate limiter.
 *
 * Notes:
 * - Works best on long-lived Node servers.
 * - In serverless environments, memory can reset between invocations.
 * - Still useful as a first-line protection; for strict guarantees use Redis/Upstash.
 */

type Bucket = {
  resetAt: number;
  count: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __MENTORSED_RATE_LIMIT__: Map<string, Bucket> | undefined;
}

function store(): Map<string, Bucket> {
  if (!globalThis.__MENTORSED_RATE_LIMIT__) {
    globalThis.__MENTORSED_RATE_LIMIT__ = new Map();
  }
  return globalThis.__MENTORSED_RATE_LIMIT__;
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const { key, limit, windowMs } = params;
  const now = Date.now();
  const s = store();
  const b = s.get(key);

  // create/reset bucket
  if (!b || now >= b.resetAt) {
    const next: Bucket = { resetAt: now + windowMs, count: 1 };
    s.set(key, next);
    return {
      ok: true,
      limit,
      remaining: limit - 1,
      resetAt: next.resetAt,
      retryAfterSec: 0,
    };
  }

  // exceeded
  if (b.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
    return {
      ok: false,
      limit,
      remaining: 0,
      resetAt: b.resetAt,
      retryAfterSec,
    };
  }

  // consume
  b.count += 1;
  s.set(key, b);

  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - b.count),
    resetAt: b.resetAt,
    retryAfterSec: 0,
  };
}
