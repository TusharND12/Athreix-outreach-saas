import { timingSafeEqual } from "node:crypto";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { AppError } from "@/lib/server/errors";
import { runRetention } from "@/server/retention";

function equalSecret(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  return apiRoute(async () => {
    if (!env.databaseEnabled) {
      if (env.demoMode)
        return apiSuccess({ skipped: true, reason: "demo_mode" });
      throw new AppError(
        "SERVICE_NOT_CONFIGURED",
        "Retention storage is not configured.",
        503,
      );
    }
    if (!env.CRON_SECRET) {
      throw new AppError(
        "CRON_NOT_CONFIGURED",
        "Scheduled retention authentication is not configured.",
        503,
      );
    }
    const authorization = request.headers.get("authorization") ?? "";
    const headerSecret = request.headers.get("x-cron-secret") ?? "";
    const candidate = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : headerSecret;
    if (!candidate || !equalSecret(candidate, env.CRON_SECRET)) {
      throw new AppError(
        "UNAUTHORIZED",
        "Invalid scheduled task credentials.",
        401,
      );
    }
    return apiSuccess({ ok: true, counts: await runRetention() });
  });
}
