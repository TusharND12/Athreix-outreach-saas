import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  decryptSensitive: vi.fn(),
  encryptSensitive: vi.fn(),
  writeAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth-context", () => ({
  requirePlatformAdmin: mocks.requirePlatformAdmin,
}));
vi.mock("@/lib/server/rate-limit", () => ({
  enforceRateLimit: mocks.enforceRateLimit,
}));
vi.mock("@/lib/server/db", () => ({
  db: {
    dataSubjectRequest: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));
vi.mock("@/lib/server/crypto", () => ({
  decryptSensitive: mocks.decryptSensitive,
  encryptSensitive: mocks.encryptSensitive,
}));
vi.mock("@/server/audit", () => ({ writeAudit: mocks.writeAudit }));

beforeEach(() => {
  mocks.requirePlatformAdmin.mockResolvedValue({
    userId: "admin-a",
    workspaceId: "admin-workspace",
    role: "OWNER",
    isPlatformAdmin: true,
    demo: false,
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.writeAudit.mockResolvedValue(undefined);
  mocks.encryptSensitive.mockReturnValue("encrypted-resolution");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("admin privacy operations", () => {
  it("decrypts a selected request and audits the reveal", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "request-a",
      workspaceId: "workspace-a",
      type: "DELETION",
      status: "RECEIVED",
      requestEncrypted: "encrypted-request",
      resolution: "encrypted-resolution",
      dueAt: new Date("2026-09-01T00:00:00.000Z"),
      createdAt: new Date("2026-08-01T00:00:00.000Z"),
      workspace: { name: "Example workspace" },
    });
    mocks.decryptSensitive
      .mockReturnValueOnce(
        JSON.stringify({ identity: "person@example.com", details: "Erase me" }),
      )
      .mockReturnValueOnce(
        JSON.stringify({ summary: "Completed", evidenceReference: "ticket-1" }),
      );
    const { GET } = await import("@/app/api/admin/privacy/route");

    const response = await GET(
      new Request(
        "https://outreach.athreix.com/api/admin/privacy?id=request-a",
      ),
    );
    const payload = (await response.json()) as {
      data: { requestPayload: { identity: string } };
    };

    expect(response.status).toBe(200);
    expect(payload.data.requestPayload.identity).toBe("person@example.com");
    expect(payload.data).not.toHaveProperty("requestEncrypted");
    expect(payload.data).not.toHaveProperty("resolution");
    expect(mocks.writeAudit).toHaveBeenCalledWith({
      workspaceId: "workspace-a",
      actorId: "admin-a",
      action: "privacy.request.reveal",
      entityType: "data_subject_request",
      entityId: "request-a",
    });
  });

  it("requires an evidence reference before completion", async () => {
    const { PATCH } = await import("@/app/api/admin/privacy/route");

    const response = await PATCH(
      new Request("https://outreach.athreix.com/api/admin/privacy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "request-a",
          status: "COMPLETE",
          resolution: "The verified request was completed.",
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("stores an encrypted resolution and audits the status change", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "request-a",
      workspaceId: "workspace-a",
      type: "DELETION",
    });
    mocks.update.mockResolvedValue({
      id: "request-a",
      type: "DELETION",
      status: "COMPLETE",
      dueAt: new Date("2026-09-01T00:00:00.000Z"),
      completedAt: new Date("2026-08-10T00:00:00.000Z"),
    });
    const { PATCH } = await import("@/app/api/admin/privacy/route");

    const response = await PATCH(
      new Request("https://outreach.athreix.com/api/admin/privacy", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "request-a",
          status: "COMPLETE",
          resolution: "The verified records were erased.",
          evidenceReference: "ticket-1234",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.encryptSensitive).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "request-a" },
        data: expect.objectContaining({
          status: "COMPLETE",
          resolution: "encrypted-resolution",
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(mocks.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-a",
        actorId: "admin-a",
        action: "privacy.request.status_update",
        entityId: "request-a",
      }),
    );
  });
});
