import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/server/env";

export const PRIVACY_CONSENT_INTENT_COOKIE = "athreix_dpdp_consent_intent";
export const PRIVACY_CONSENT_INTENT_TTL_SECONDS = 10 * 60;

type PrivacyConsentIntent = {
  noticeVersion: string;
  issuedAt: number;
  intentId: string;
  ipHash: string;
};

function signature(value: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(value)
    .digest("base64url");
}

export function createPrivacyConsentIntent(ipHash: string) {
  const payload: PrivacyConsentIntent = {
    noticeVersion: env.PRIVACY_NOTICE_VERSION,
    issuedAt: Date.now(),
    intentId: randomUUID(),
    ipHash,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

export function verifyPrivacyConsentIntent(
  value?: string,
): PrivacyConsentIntent | null {
  if (!value || value.length > 2_000) return null;
  const [encoded, suppliedSignature, ...extra] = value.split(".");
  if (!encoded || !suppliedSignature || extra.length) return null;
  const expectedSignature = signature(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<PrivacyConsentIntent>;
    const age = Date.now() - Number(payload.issuedAt);
    if (
      payload.noticeVersion !== env.PRIVACY_NOTICE_VERSION ||
      typeof payload.intentId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.intentId) ||
      typeof payload.ipHash !== "string" ||
      payload.ipHash.length < 16 ||
      !Number.isFinite(age) ||
      age < -60_000 ||
      age > PRIVACY_CONSENT_INTENT_TTL_SECONDS * 1_000
    ) {
      return null;
    }
    return payload as PrivacyConsentIntent;
  } catch {
    return null;
  }
}
