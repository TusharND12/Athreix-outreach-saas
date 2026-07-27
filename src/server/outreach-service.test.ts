import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/errors";
import {
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
