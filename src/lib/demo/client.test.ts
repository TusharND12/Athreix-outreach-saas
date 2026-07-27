import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiRequestError,
  ApiUnavailableError,
  requestOrFallback,
} from "./client";

describe("requestOrFallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("never converts an HTTP compliance rejection into demo success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "PROHIBITED_USE", message: "Search blocked" },
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    await expect(
      requestOrFallback("/api/search", { id: "demo" }, { method: "POST" }),
    ).rejects.toMatchObject({
      status: 422,
      code: "PROHIBITED_USE",
      message: "Search blocked",
    } satisfies Partial<ApiRequestError>);
  });

  it("returns a live response without changing its envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ data: { balance: 497 }, meta: { demo: true } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
    );

    const result = await requestOrFallback("/api/usage", {
      data: { balance: 0 },
    });
    expect(result).toEqual({
      data: { data: { balance: 497 }, meta: { demo: true } },
      source: "live",
    });
  });

  it("permits a fixture only when demo fallback is explicitly enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_LIVE_DATA_ONLY", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("connection refused")),
    );

    await expect(
      requestOrFallback("/api/usage", { balance: 500 }),
    ).resolves.toEqual({
      data: { balance: 500 },
      source: "demo",
    });
  });

  it("fails closed when a production network request cannot connect", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("connection refused")),
    );

    await expect(
      requestOrFallback("/api/usage", { balance: 500 }),
    ).rejects.toBeInstanceOf(ApiUnavailableError);
  });

  it("fails closed in live-data-only mode even when demo mode is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_LIVE_DATA_ONLY", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("connection refused")),
    );

    await expect(
      requestOrFallback("/api/usage", { balance: 500 }),
    ).rejects.toBeInstanceOf(ApiUnavailableError);
  });
});
