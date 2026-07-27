import { z } from "zod";
import { apiRoute, apiSuccess, searchParams } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requestMetadata } from "@/lib/server/request";
import { verifyEmailToken } from "@/server/auth-service";

const schema = z.object({
  email: z.string().trim().email().max(254),
  token: z.string().min(32).max(256),
});

async function verify(request: Request, payload: unknown) {
  return apiRoute(async () => {
    if (!env.databaseEnabled) {
      throw new AppError(
        "SERVICE_NOT_CONFIGURED",
        "Email verification storage is not configured.",
        503,
      );
    }
    const metadata = requestMetadata(request);
    await enforceRateLimit(`verify-email:${metadata.ipHash}`, 10, 15 * 60);
    const input = schema.parse(payload);
    await verifyEmailToken(input.email, input.token);
    return apiSuccess({
      ok: true,
      message: "Email verified. You can now sign in.",
    });
  });
}

export async function GET(request: Request) {
  return verify(request, searchParams(request));
}

export async function POST(request: Request) {
  return verify(request, await readJson(request));
}
