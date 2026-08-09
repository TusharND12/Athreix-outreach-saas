import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/errors";
import {
  appendWorkspaceSignature,
  assertConsumerOutreachRole,
  canAccessConsumerOutreach,
} from "@/server/outreach-service";

describe("consumer outreach access", () => {
  it.each(["MEMBER", "VIEWER"] as const)(
    "rejects the %s role before consumer context is used",
    (role) => {
      expect(canAccessConsumerOutreach(role)).toBe(false);
      expect(() => assertConsumerOutreachRole(role, true)).toThrowError(
        expect.objectContaining<Partial<AppError>>({
          code: "FORBIDDEN",
          status: 403,
        }),
      );
    },
  );

  it.each(["OWNER", "ADMIN"] as const)(
    "allows the %s role to draft consumer outreach",
    (role) => {
      expect(canAccessConsumerOutreach(role)).toBe(true);
      expect(() => assertConsumerOutreachRole(role, true)).not.toThrow();
    },
  );

  it("does not raise the consumer-only gate for professional outreach", () => {
    expect(() => assertConsumerOutreachRole("MEMBER", false)).not.toThrow();
  });
});

describe("workspace outreach signature", () => {
  it("appends a configured signature exactly once", () => {
    expect(appendWorkspaceSignature("Hello there", "— Uma\nAthreix")).toBe(
      "Hello there\n\n— Uma\nAthreix",
    );
    expect(
      appendWorkspaceSignature(
        "Hello there\n\n— Uma\nAthreix",
        "— Uma\nAthreix",
      ),
    ).toBe("Hello there\n\n— Uma\nAthreix");
  });

  it("leaves the body unchanged when no signature is configured", () => {
    expect(appendWorkspaceSignature("Hello there", " ")).toBe("Hello there");
  });
});
