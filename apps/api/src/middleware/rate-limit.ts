import type { MiddlewareHandler } from "hono";

const RATE_LIMIT_HEADERS = {
  limit: "X-RateLimit-Limit",
  remaining: "X-RateLimit-Remaining",
  reset: "X-RateLimit-Reset"
} as const;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyGenerator?: (c: { req: { path: string; method: string }; header: (name: string) => string | undefined }) => string;
}

const buckets = new Map<string, RateLimitBucket>();

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function defaultKeyGenerator(c: {
  req: { path: string; method: string };
  header: (name: string) => string | undefined;
}): string {
  const forwarded = c.header("cf-connecting-ip") ?? c.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0];
    return first ? first.trim() : "unknown";
  }
  return c.header("x-real-ip") ?? "unknown";
}

export function rateLimit(config: RateLimitConfig): MiddlewareHandler {
  const keyGen = config.keyGenerator ?? defaultKeyGenerator;

  return async (c, next) => {
    const now = Date.now();
    cleanupExpired(now);

    const key = keyGen(c);
    const bucket = buckets.get(key);

    let current: RateLimitBucket;
    if (!bucket || bucket.resetAt <= now) {
      current = {
        count: 0,
        resetAt: now + config.windowMs
      };
      buckets.set(key, current);
    } else {
      current = bucket;
    }

    current.count += 1;

    const remaining = Math.max(0, config.max - current.count);
    const resetInSeconds = Math.ceil((current.resetAt - now) / 1000);

    c.header(RATE_LIMIT_HEADERS.limit, String(config.max));
    c.header(RATE_LIMIT_HEADERS.remaining, String(remaining));
    c.header(RATE_LIMIT_HEADERS.reset, String(resetInSeconds));

    if (current.count > config.max) {
      return c.json(
        {
          ok: false as const,
          error: {
            code: "rate_limited",
            message: "Too many requests. Please slow down."
          }
        },
        429
      );
    }

    await next();
  };
}

export const MUTATING_ENDPOINT_RATE_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 60
});

export const AUTH_ENDPOINT_RATE_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 10
});

export const LEADERBOARD_RATE_LIMIT = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});
