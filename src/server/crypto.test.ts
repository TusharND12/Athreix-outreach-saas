import { describe, expect, it } from "vitest";
import {
  canonicalPhone,
  decryptSensitive,
  encryptSensitive,
  hashIdentifier,
  hashPhone,
  privacySafetyIdentifier,
} from "@/lib/server/crypto";

describe("sensitive-field protection", () => {
  it("encrypts with randomized authenticated ciphertext", () => {
    const first = encryptSensitive("person@example.com");
    const second = encryptSensitive("person@example.com");
    expect(first).not.toBe(second);
    expect(decryptSensitive(first)).toBe("person@example.com");
  });

  it("creates deterministic hashes and pseudonymous AI safety identifiers", () => {
    expect(hashIdentifier(" Person@Example.com ")).toBe(
      hashIdentifier("person@example.com"),
    );
    const safety = privacySafetyIdentifier("workspace-raw", "user-raw");
    expect(safety).toMatch(/^ath_/);
    expect(safety).not.toContain("workspace-raw");
    expect(safety).not.toContain("user-raw");
  });

  it("canonicalizes regional phones to E.164 and rejects ambiguity", () => {
    expect(canonicalPhone("09000000001", "India")).toBe("+919000000001");
    expect(hashPhone("09000000001", "IN")).toBe(hashPhone("+91 90000 00001"));
    expect(canonicalPhone("9000000001")).toBeUndefined();
    expect(() => hashPhone("9000000001")).toThrowError(/explicit country/i);
  });
});
