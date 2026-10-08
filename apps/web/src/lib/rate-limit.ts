import { RATE_LIMITS } from "@feedbackport/core";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type RateLimitKind = keyof typeof RATE_LIMITS;

let redis: Redis | null = null;
const limiters = new Map<RateLimitKind, Ratelimit>();

function getRedis(): Redis {
  if (redis) return redis;
  redis = Redis.fromEnv();
  return redis;
}

function getLimiter(kind: RateLimitKind): Ratelimit {
  const existing = limiters.get(kind);
  if (existing) return existing;

  const { maxRequests, windowSeconds } = RATE_LIMITS[kind];
  const limiter = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
    prefix: `ratelimit:${kind}`,
  });
  limiters.set(kind, limiter);
  return limiter;
}

/** Thresholds all come from RATE_LIMITS in @feedbackport/core; see the three-layer anti-abuse design in docs/ARCHITECTURE.md */
export async function checkRateLimit(kind: RateLimitKind, identifier: string): Promise<boolean> {
  const { success } = await getLimiter(kind).limit(identifier);
  return success;
}
