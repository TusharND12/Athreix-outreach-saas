import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UsagePage from "./page";

const { requestOrFallback } = vi.hoisted(() => ({
  requestOrFallback: vi.fn(),
}));

vi.mock("@/lib/demo/client", () => ({ requestOrFallback }));

describe("UsagePage", () => {
  beforeEach(() => {
    requestOrFallback.mockResolvedValue({
      data: {
        data: {
          balance: 497,
          reserved: 0,
          monthlyCap: 500,
          transactions: [],
        },
      },
      source: "live",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows search scope and live available credits in Usage", async () => {
    render(<UsagePage />);

    expect(screen.getByText("Search scope")).toBeVisible();
    expect(screen.getByText("Maximum results")).toBeVisible();
    expect(screen.getByText("100")).toBeVisible();
    expect(screen.getByText("up to 100 credits")).toBeVisible();
    expect(await screen.findByText("497 credits")).toBeVisible();
  });
});
