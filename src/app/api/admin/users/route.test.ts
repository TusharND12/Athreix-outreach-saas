import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformAdmin: vi.fn(),
  enforceRateLimit: vi.fn(),
  auditCreate: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
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
    user: { findUnique: mocks.findUnique, update: mocks.update },
    $transaction: mocks.transaction,
  },
}));

beforeEach(() => {
  mocks.requirePlatformAdmin.mockResolvedValue({
    userId: "admin-a",
    workspaceId: "admin-workspace",
    role: "OWNER",
    isPlatformAdmin: true,
    demo: false,
  });
  mocks.enforceRateLimit.mockResolvedValue(undefined);
  mocks.auditCreate.mockResolvedValue({});
  mocks.transaction.mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) =>
      callback({
        user: { findUnique: mocks.findUnique, update: mocks.update },
        auditLog: { create: mocks.auditCreate },
      }),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

function request(body: Record<string, unknown>) {
  return new Request("https://outreach.athreix.com/api/admin/users", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("admin account controls", () => {
  it("approves a verified user and rotates their session version", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-a",
      email: "user@example.com",
      emailVerified: new Date(),
      isPlatformAdmin: false,
      approvalStatus: "PENDING",
      suspendedAt: null,
      memberships: [{ workspaceId: "workspace-a" }],
    });
    mocks.update.mockResolvedValue({
      id: "user-a",
      approvalStatus: "APPROVED",
      approvedAt: new Date(),
      rejectedAt: null,
      suspendedAt: null,
      sessionVersion: 2,
    });
    const { PATCH } = await import("@/app/api/admin/users/route");

    const response = await PATCH(
      request({ userId: "user-a", action: "APPROVE", note: "Beta customer" }),
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-a" },
        data: expect.objectContaining({
          approvalStatus: "APPROVED",
          approvedById: "admin-a",
          sessionVersion: { increment: 1 },
        }),
      }),
    );
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "workspace-a",
          actorId: "admin-a",
          action: "account.approve",
          entityId: "user-a",
        }),
      }),
    );
  });

  it("refuses approval before email verification", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "user-a",
      email: "user@example.com",
      emailVerified: null,
      isPlatformAdmin: false,
      approvalStatus: "PENDING",
      suspendedAt: null,
      memberships: [{ workspaceId: "workspace-a" }],
    });
    const { PATCH } = await import("@/app/api/admin/users/route");

    const response = await PATCH(
      request({ userId: "user-a", action: "APPROVE" }),
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("EMAIL_NOT_VERIFIED");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("protects platform administrator accounts from portal mutations", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "admin-b",
      email: "admin@example.com",
      emailVerified: new Date(),
      isPlatformAdmin: true,
      approvalStatus: "APPROVED",
      suspendedAt: null,
      memberships: [{ workspaceId: "workspace-b" }],
    });
    const { PATCH } = await import("@/app/api/admin/users/route");

    const response = await PATCH(
      request({
        userId: "admin-b",
        action: "SUSPEND",
        note: "No longer needed",
      }),
    );
    const payload = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("ADMIN_ACCOUNT_PROTECTED");
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
