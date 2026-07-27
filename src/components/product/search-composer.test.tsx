import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchComposer } from "./search-composer";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const parsedSearch = {
  mode: "B2B" as const,
  intent:
    "Find SaaS founders in Mumbai with 20–200 employees, excluding Delhi, with public email and Series A funding.",
  targetDescription: "Mumbai SaaS founders · Series A",
  filters: {
    industries: ["SaaS"],
    locations: ["Mumbai"],
    excludedLocations: ["Delhi"],
    employeeMin: 20,
    employeeMax: 200,
    revenueMin: 10_000_000,
    revenueMax: null,
    jobTitles: ["Founder"],
    technologies: ["Salesforce"],
    keywords: ["B2B"],
    fundingStages: ["Series A"],
    emailRequirement: "AVAILABLE" as const,
    websiteRequirement: "ANY" as const,
    websiteSignals: [],
    growthSignals: ["active hiring"],
    isHiring: true,
  },
  researchPlan: ["google_search", "website", "contact", "careers"] as const,
  assumptions: ["Only public business information will be used."],
  clarificationNeeded: false,
  clarificationQuestion: null,
  confidence: 94,
};

function routedFetch(searchId: string, balance = 500) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/usage")
      return jsonResponse({ data: { balance, reserved: 0 } });
    if (url === "/api/ai/search-understanding") {
      const request = JSON.parse(String(_init?.body)) as {
        query: string;
        mode: "B2B";
      };
      if (request.query.includes("excluding Delhi"))
        return jsonResponse({ data: parsedSearch });
      return jsonResponse({
        data: {
          ...parsedSearch,
          mode: request.mode,
          intent: request.query,
          targetDescription: request.query,
          filters: {
            ...parsedSearch.filters,
            industries: request.query.includes("AI") ? ["Technology"] : [],
            locations: request.query.includes("Mumbai")
              ? ["Mumbai"]
              : request.query.includes("India")
                ? ["India"]
                : [],
            excludedLocations: [],
            employeeMin: null,
            employeeMax: null,
            revenueMin: null,
            revenueMax: null,
            jobTitles: [],
            technologies: [],
            keywords: [],
            fundingStages: [],
            emailRequirement: "ANY",
            websiteRequirement: "ANY",
            websiteSignals: [],
            growthSignals: [],
            isHiring: null,
          },
          researchPlan: ["google_search"],
        },
      });
    }
    if (url === "/api/search")
      return jsonResponse({ data: { search: { id: searchId } } });
    throw new Error(`Unexpected request: ${url}`);
  });
}

async function waitForUsage(fetchMock: ReturnType<typeof routedFetch>) {
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([input]) => String(input) === "/api/usage"),
    ).toBe(true),
  );
}

describe("SearchComposer filter contracts", () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("grows the same search bar line by line without losing focus", async () => {
    const fetchMock = routedFetch("search-expand", 188);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    const { container } = render(<SearchComposer />);
    await waitForUsage(fetchMock);
    const searchBrief = screen.getByLabelText("Search brief");
    expect(container.querySelector(".scan-beam")).toBeInTheDocument();
    expect(searchBrief).toHaveAttribute("rows", "1");
    const searchSurface = searchBrief.closest(".enterprise-card");
    expect(searchSurface).toHaveStyle({ borderRadius: "30px" });
    expect(
      screen.queryByRole("button", { name: "Advanced filters" }),
    ).not.toBeInTheDocument();
    Object.defineProperty(searchBrief, "scrollHeight", {
      configurable: true,
      value: 84,
    });

    await user.type(searchBrief, "A");
    expect(container.querySelector(".scan-beam")).toBeInTheDocument();
    expect(searchBrief).toHaveFocus();
    expect(searchBrief).toHaveAttribute("rows", "1");
    expect(searchBrief).toHaveStyle({ height: "84px" });
    expect(searchBrief.closest(".enterprise-card")).toBe(searchSurface);
    expect(searchSurface).toHaveStyle({ borderRadius: "30px" });
    expect(
      screen.getByRole("button", { name: "Advanced filters" }),
    ).toBeVisible();
    expect(screen.getByText("AI-parsed search inputs")).toBeVisible();
    expect(screen.queryByText("Search scope")).not.toBeInTheDocument();
    const leadLimit = screen.getByLabelText("Lead limit") as HTMLInputElement;
    expect(leadLimit).toHaveValue(100);
    expect(leadLimit).toHaveAttribute("min", "1");
    expect(leadLimit).toHaveAttribute("max", "1000");
  });

  it("uses an arbitrary lead count stated in the search brief", async () => {
    const fetchMock = routedFetch("search-exact-count", 500);
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SearchComposer />);
    await waitForUsage(fetchMock);
    await user.type(
      screen.getByLabelText("Search brief"),
      "Find 17 qualified leads for SaaS founders in India",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Lead limit")).toHaveValue(17),
    );
    await user.click(
      screen.getByRole("button", { name: "Generate prospects" }),
    );

    await waitFor(() => expect(push).toHaveBeenCalled());
    const searchCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/search",
    );
    const payload = JSON.parse(
      String((searchCall?.[1] as RequestInit).body),
    ) as { targetCount: number };
    expect(payload.targetCount).toBe(17);
    expect(push).toHaveBeenCalledWith(expect.stringContaining("target=17"));
  });

  it("interprets the complete sentence from Enter or the send button", async () => {
    const fetchMock = routedFetch("search-submit");
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SearchComposer />);
    await waitForUsage(fetchMock);
    const searchBrief = screen.getByLabelText("Search brief");
    const sendButton = screen.getByRole("button", {
      name: "Interpret search",
    });

    await user.type(searchBrief, "Find architecture firms in Pune");
    await user.keyboard("{Enter}");

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input]) => String(input) === "/api/ai/search-understanding",
        ),
      ).toHaveLength(1),
    );
    const enterRequest = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/ai/search-understanding",
    )?.[1] as RequestInit;
    expect(JSON.parse(String(enterRequest.body))).toMatchObject({
      query: "Find architecture firms in Pune",
      mode: "B2B",
    });

    await user.clear(searchBrief);
    await user.type(searchBrief, "Find SaaS companies in Mumbai");
    await user.click(sendButton);

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input]) => String(input) === "/api/ai/search-understanding",
        ),
      ).toHaveLength(2),
    );
    const sendRequest = fetchMock.mock.calls.filter(
      ([input]) => String(input) === "/api/ai/search-understanding",
    )[1]?.[1] as RequestInit;
    expect(JSON.parse(String(sendRequest.body))).toMatchObject({
      query: "Find SaaS companies in Mumbai",
      mode: "B2B",
    });
  });

  it("automatically parses a brief and fills the editable run template", async () => {
    const fetchMock = routedFetch("search-auto");
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SearchComposer />);
    await waitForUsage(fetchMock);
    await user.type(
      screen.getByLabelText("Search brief"),
      "Find SaaS founders in Mumbai with 20–200 employees, excluding Delhi, with public email and Series A funding.",
    );

    expect(screen.getByText("AI-parsed search inputs")).toBeInTheDocument();
    await screen.findByText("94% understood", {}, { timeout: 2_500 });
    expect(screen.getByLabelText("Run label")).toHaveValue(
      "Mumbai SaaS founders · Series A",
    );
    expect(screen.getByText("Delhi")).toBeInTheDocument();

    await user.click(screen.getByText("Job title"));
    expect(screen.getByLabelText("Decision-maker titles")).toHaveValue(
      "Founder",
    );
    expect(
      fetchMock.mock.calls.some(
        ([input]) => String(input) === "/api/ai/search-understanding",
      ),
    ).toBe(true);
  });

  it("maps explicit founded-after and founded-before fields without an ignored revenue filter", async () => {
    const fetchMock = routedFetch("search-b2b");
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SearchComposer />);
    await waitForUsage(fetchMock);
    await user.type(
      screen.getByLabelText("Search brief"),
      "AI companies in India",
    );
    await user.click(screen.getByRole("button", { name: "Advanced filters" }));
    await user.type(screen.getByLabelText("Founded after"), "2020");
    await user.type(screen.getByLabelText("Founded before"), "2024");
    await user.click(
      screen.getByRole("button", { name: "Generate prospects" }),
    );

    await waitFor(() => expect(push).toHaveBeenCalled());
    const searchCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/search",
    );
    const init = searchCall?.[1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as {
      filters: Record<string, unknown>;
    };
    expect(payload.filters).toMatchObject({
      foundedAfter: 2020,
      foundedBefore: 2024,
    });
    expect(payload.filters).not.toHaveProperty("revenue");
    expect(payload.filters).not.toHaveProperty("revenueMin");
    expect(payload.filters).not.toHaveProperty("revenueMax");
  });

  it("removes audience modes and always launches business research", async () => {
    const fetchMock = routedFetch("search-b2b-only");
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<SearchComposer />);
    await waitForUsage(fetchMock);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByText("Business prospects")).not.toBeInTheDocument();
    expect(screen.queryByText("Consumer audience")).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Search brief"),
      "Find architecture firms in Pune",
    );
    await user.click(
      screen.getByRole("button", { name: "Generate prospects" }),
    );

    await waitFor(() => expect(push).toHaveBeenCalled());
    const searchCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/search",
    );
    const init = searchCall?.[1] as RequestInit;
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(payload.mode).toBe("B2B");
    expect(payload).not.toHaveProperty("lawfulBasis");
    expect(payload).not.toHaveProperty("audienceSource");
    expect(push).toHaveBeenCalledWith(expect.stringContaining("mode=B2B"));
  });
});
