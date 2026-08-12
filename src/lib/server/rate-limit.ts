import { createHash } from "node:crypto";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { firebaseDb } from "@/lib/server/firebase-admin";

type MemoryEntry = { count: number; resetAt: number };
const memory = new Map<string, MemoryEntry>();

async function enforceFirestoreRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const documentId = createHash("sha256").update(key).digest("hex");
  const reference = firebaseDb.collection("_rateLimits").doc(documentId);
  const now = Date.now();
  return firebaseDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const current = snapshot.data() as
      { count?: unknown; resetAt?: unknown } | undefined;
    const currentCount = Number(current?.count);
    const currentResetAt = Number(current?.resetAt);
    const expired =
      !snapshot.exists ||
      !Number.isFinite(currentCount) ||
      !Number.isFinite(currentResetAt) ||
      currentResetAt <= now;
    const count = expired ? 1 : currentCount + 1;
    const resetAt = expired ? now + windowSeconds * 1000 : currentResetAt;
    if (count > limit) {
      throw new AppError(
        "RATE_LIMITED",
        "Too many requests. Try again shortly.",
        429,
      );
    }
    transaction.set(reference, {
      count,
      resetAt,
      expiresAt: new Date(resetAt),
      updatedAt: new Date(now),
    });
    return { remaining: Math.max(0, limit - count) };
  });
}

async function enforceSharedFallback(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  if (!env.firebaseEnabled) {
    throw new AppError(
      "RATE_LIMIT_UNAVAILABLE",
      "This operation is temporarily unavailable because abuse protection is not configured.",
      503,
    );
  }
  try {
    return await enforceFirestoreRateLimit(key, limit, windowSeconds);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "RATE_LIMIT_UNAVAILABLE",
      "This operation is temporarily unavailable because abuse protection could not be verified.",
      503,
    );
  }
}

export async function enforceRateLimit(
  key: string,
  limit = 30,
  windowSeconds = 60,
) {
  if (env.NODE_ENV === "production" && !env.demoMode) {
    return enforceSharedFallback(key, limit, windowSeconds);
  }

  // A per-process fallback is suitable only for local development, tests, and
  // the explicitly enabled demo. Production uses an atomic Firestore bucket so
  // limits remain shared across instances.
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
