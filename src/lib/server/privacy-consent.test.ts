import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server/env", () => ({
  env: {
    AUTH_SECRET: "test-auth-secret-at-least-thirty-two-characters",
    PRIVACY_NOTICE_VERSION: "2026-08-11",
  },
}));

import {
  createPrivacyConsentIntent,
  PRIVACY_CONSENT_INTENT_TTL_SECONDS,
  verifyPrivacyConsentIntent,
} from "@/lib/server/privacy-consent";

describe("signed privacy-consent intent", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts an authentic, current consent intent", () => {
    const intent = createPrivacyConsentIntent("a".repeat(64));

    expect(verifyPrivacyConsentIntent(intent)).toMatchObject({
      noticeVersion: "2026-08-11",
      ipHash: "a".repeat(64),
    });
  });

  it("rejects tampering and expired consent intents", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T00:00:00.000Z"));
    const intent = createPrivacyConsentIntent("b".repeat(64));
    const [payload, signature] = intent.split(".");

    expect(verifyPrivacyConsentIntent(`${payload}x.${signature}`)).toBeNull();

    vi.advanceTimersByTime((PRIVACY_CONSENT_INTENT_TTL_SECONDS + 1) * 1_000);
    expect(verifyPrivacyConsentIntent(intent)).toBeNull();
  });
});
