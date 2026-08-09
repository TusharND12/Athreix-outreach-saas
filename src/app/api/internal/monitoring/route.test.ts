import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchJobCount: vi.fn(),
  exportCount: vi.fn(),
  subscriptionCount: vi.fn(),
  privacyCount: vi.fn(),
  dataSourceCount: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/env", () => ({
  env: {
    databaseEnabled: true,
    CRON_SECRET: "a-production-cron-secret",
    SEARCH_JOB_STALE_AFTER_MS: 90_000,
    mockDataEnabled: false,
  },
}));
vi.mock("@/lib/server/db", () => ({
  db: {
    searchJob: { count: mocks.searchJobCount },
    export: { count: mocks.exportCount },
    subscription: { count: mocks.subscriptionCount },
    dataSubjectRequest: { count: mocks.privacyCount },
    dataSourceRecord: { count: mocks.dataSourceCount },
  },
}));

beforeEach(() => {
  mocks.searchJobCount.mockResolvedValue(0);
  mocks.exportCount.mockResolvedValue(0);
  mocks.subscriptionCount.mockResolvedValue(0);
  mocks.privacyCount.mockResolvedValue(0);
  mocks.dataSourceCount.mockResolvedValue(0);
});

afterEach(() => {
  vi.clearAllMocks();
});

function monitoringRequest(secret = "a-production-cron-secret") {
  return new Request("https://outreach.athreix.com/api/internal/monitoring", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("operational monitoring", () => {
  it("rejects an invalid scheduler secret", async () => {
    const { GET } = await import("@/app/api/internal/monitoring/route");

    const response = await GET(monitoringRequest("incorrect-secret"));

    expect(response.status).toBe(401);
    expect(mocks.searchJobCount).not.toHaveBeenCalled();
  });

  it("returns 200 when all alert counters are clear", async () => {
    const { GET } = await import("@/app/api/internal/monitoring/route");

    const response = await GET(monitoringRequest());
    const payload = (await response.json()) as {
      data: { status: string; alerts: Record<string, number> };
    };

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe("ok");
    expect(Object.values(payload.data.alerts)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("returns 503 when any operator alert is active", async () => {
    mocks.subscriptionCount.mockResolvedValue(2);
    const { GET } = await import("@/app/api/internal/monitoring/route");

    const response = await GET(monitoringRequest());
    const payload = (await response.json()) as {
      data: { status: string; alerts: { pastDueSubscriptions: number } };
    };

    expect(response.status).toBe(503);
    expect(payload.data.status).toBe("alert");
    expect(payload.data.alerts.pastDueSubscriptions).toBe(2);
  });
});
