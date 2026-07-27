import { Redis } from "ioredis";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";

type MemoryEntry = { count: number; resetAt: number };
const memory = new Map<string, MemoryEntry>();
let redis: Redis | null = null;

function getRedis() {
  if (!env.REDIS_URL) return null;
  redis ??= new Redis(env.REDIS_URL, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  return redis;
}

export async function enforceRateLimit(
  key: string,
  limit = 30,
  windowSeconds = 60,
) {
  const client = getRedis();
  if (client) {
    try {
      if (client.status === "wait") await client.connect();
      const redisKey = `athreix:rate:${key}`;
      const count = await client.incr(redisKey);
      if (count === 1) await client.expire(redisKey, windowSeconds);
      if (count > limit) {
        throw new AppError(
          "RATE_LIMITED",
          "Too many requests. Try again shortly.",
          429,
        );
      }
      return { remaining: Math.max(0, limit - count) };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (env.NODE_ENV === "production" && !env.demoMode) {
        throw new AppError(
          "RATE_LIMIT_UNAVAILABLE",
          "This operation is temporarily unavailable because abuse protection could not be verified.",
          503,
        );
      }
    }
  } else if (env.NODE_ENV === "production" && !env.demoMode) {
    throw new AppError(
      "RATE_LIMIT_UNAVAILABLE",
      "This operation is temporarily unavailable because abuse protection is not configured.",
      503,
    );
  }

  // A per-process fallback is suitable only for local development, tests, and
  // the explicitly enabled demo. Production mutations must use shared state.
  const now = Date.now();
  const current = memory.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + windowSeconds * 1000 }
      : { count: current.count + 1, resetAt: current.resetAt };
  memory.set(key, entry);
  if (entry.count > limit) {
    throw new AppError(
      "RATE_LIMITED",
      "Too many requests. Try again shortly.",
      429,
    );
  }
  return { remaining: Math.max(0, limit - entry.count) };
}
