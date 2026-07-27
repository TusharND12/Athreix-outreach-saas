import { describe, expect, it } from "vitest";
import { csrfViolation } from "@/lib/server/csrf";

describe("same-origin mutation protection", () => {
  it("blocks cross-site browser mutations", () => {
    expect(
      csrfViolation({
        method: "POST",
        origin: "https://attacker.example",
        secFetchSite: "cross-site",
        requestOrigin: "https://app.athreix.example",
      }),
    ).toMatch(/Cross-site/);
  });

  it("allows same-origin mutations and safe methods", () => {
    expect(
      csrfViolation({
        method: "POST",
        origin: "https://app.athreix.example",
        secFetchSite: "same-origin",
        requestOrigin: "https://app.athreix.example",
      }),
    ).toBeNull();
    expect(
      csrfViolation({
        method: "GET",
        origin: "https://attacker.example",
        secFetchSite: "cross-site",
        requestOrigin: "https://app.athreix.example",
      }),
    ).toBeNull();
  });
});
