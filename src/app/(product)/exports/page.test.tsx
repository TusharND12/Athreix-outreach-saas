import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExportsPage from "./page";

const { push, requestOrFallback } = vi.hoisted(() => ({
  push: vi.fn(),
  requestOrFallback: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("@/lib/demo/client", () => ({ requestOrFallback }));

const completedSearch = {
  id: "search-history-1",
  name: "Quarterly SaaS search",
  query: "SaaS founders in Mumbai",
  mode: "B2B",
  status: "COMPLETE",
  targetCount: 25,
  resultCount: 12,
  retentionUntil: "2099-01-01T00:00:00.000Z",
  createdAt: "2026-07-20T10:00:00.000Z",
};

describe("ExportsPage source selection", () => {
  beforeEach(() => {
    push.mockReset();
    window.history.replaceState(null, "", "/exports");
    requestOrFallback.mockImplementation(async (url: string) => {
      if (url === "/api/exports") {
        return { data: { data: [] }, source: "live" };
      }
      if (url.startsWith("/api/history")) {
        return {
          data: {
            data: [completedSearch],
            meta: { pagination: { pages: 1 } },
          },
          source: "live",
        };
      }
      if (url === "/api/lists") {
        return {
          data: {
            data: [
              {
                id: "list-1",
                name: "Priority founders",
                description: "Reviewed prospects for outreach",
                resultIds: ["result-1", "result-2"],
                updatedAt: "2026-07-21T10:00:00.000Z",
              },
            ],
          },
          source: "live",
        };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows search history and exports a chosen saved list in the chosen format", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return new Response('{"name":"A prospect"}', {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition":
              'attachment; filename="athreix-prospects.json"',
            "X-Athreix-Export-Id": "export-new",
            "X-Athreix-Record-Count": "2",
          },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ExportsPage />);

    expect(await screen.findByText("Quarterly SaaS search")).toBeVisible();
    expect(screen.getByDisplayValue("search-history-1")).toBeChecked();

    await user.click(screen.getByRole("button", { name: /Saved lists/i }));
    expect(await screen.findByText("Priority founders")).toBeVisible();
    expect(screen.getByDisplayValue("list-1")).toBeChecked();

    await user.click(screen.getByRole("radio", { name: /JSON/i }));
    await user.click(
      screen.getByRole("checkbox", { name: /documented lawful purpose/i }),
    );
    await user.click(screen.getByRole("button", { name: "Download JSON" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("/api/export");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      listId: "list-1",
      format: "JSON",
      onlyVerified: false,
      acknowledgeLawfulUse: true,
    });
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(
      await screen.findByText(
        "Downloaded 2 records as JSON. The run was added to export history.",
      ),
    ).toBeVisible();
  });

  it("honors a search selected from the History page URL", async () => {
    window.history.replaceState(
      null,
      "",
      "/exports?searchId=search-history-1#create-export",
    );

    render(<ExportsPage />);

    expect(await screen.findByDisplayValue("search-history-1")).toBeChecked();
    expect(screen.getByText("Source: Quarterly SaaS search")).toBeVisible();
  });
});
