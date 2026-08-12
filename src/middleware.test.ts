import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getToken } = vi.hoisted(() => ({ getToken: vi.fn() }));

vi.mock("next-auth/jwt", () => ({ getToken }));

import { middleware } from "@/middleware";

describe("authentication middleware", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reads Auth.js's secure production cookie on HTTPS routes", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "athreix-outreach-saas");
    vi.stubEnv("DEMO_MODE", "false");
    getToken.mockResolvedValue({ sub: "admin-user", authInvalid: false });

    const response = await middleware(
      new NextRequest("https://outreach.athreix.com/admin"),
    );

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({ secureCookie: true }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
