import { z } from "zod";

import { apiRoute, apiSuccess } from "@/lib/server/api";
import { env } from "@/lib/server/env";
import { AppError, readJson } from "@/lib/server/errors";
import {
  createPrivacyConsentIntent,
  PRIVACY_CONSENT_INTENT_COOKIE,
  PRIVACY_CONSENT_INTENT_TTL_SECONDS,
} from "@/lib/server/privacy-consent";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requestMetadata } from "@/lib/server/request";

const schema = z
  .object({
    noticeVersion: z.string().min(1).max(50),
    accepted: z.literal(true),
  })
  .strict();

export async function POST(request: Request) {
  return apiRoute(async () => {
    const metadata = requestMetadata(request);
    await enforceRateLimit(
      `privacy-consent-intent:${metadata.ipHash}`,
      20,
      15 * 60,
    );
    const input = schema.parse(await readJson(request, 2_000));
    if (input.noticeVersion !== env.PRIVACY_NOTICE_VERSION) {
      throw new AppError(
        "PRIVACY_NOTICE_OUTDATED",
        "Review and accept the current Privacy Notice.",
        409,
      );
    }
    const response = apiSuccess({ ready: true });
    response.cookies.set({
      name: PRIVACY_CONSENT_INTENT_COOKIE,
      value: createPrivacyConsentIntent(metadata.ipHash),
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: PRIVACY_CONSENT_INTENT_TTL_SECONDS,
    });
    return response;
  });
}
