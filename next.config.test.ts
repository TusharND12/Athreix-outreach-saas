import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("security headers", () => {
  it("allows only the Paddle origins required for hosted checkout", async () => {
    expect(nextConfig.headers).toBeTypeOf("function");
    const entries = await nextConfig.headers!();
    const policy = entries[0]?.headers.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;

    expect(policy).toContain("script-src 'self' 'unsafe-inline'");
    expect(policy).toContain("https://cdn.paddle.com");
    expect(policy).toContain(
      "style-src 'self' 'unsafe-inline' https://*.paddle.com",
    );
    expect(policy).toContain("font-src 'self' data: https://*.paddle.com");
    expect(policy).toContain("connect-src 'self' https://*.paddle.com");
    expect(policy).toContain("frame-src https://*.paddle.com");
  });
});
