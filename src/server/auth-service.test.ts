import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}));

vi.mock("@/lib/server/db", () => ({
  db: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/server/firebase-auth", () => ({
  createFirebasePasswordUser: vi.fn(),
  deleteFirebaseUser: vi.fn(),
  markFirebaseEmailVerified: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authentication credit activation", () => {
  it("grants the starter balance and ledger row together", async () => {
    const ledgerCreate = vi.fn().mockResolvedValue({});
    const tx = {
      workspaceMember: {
        findFirst: vi.fn().mockResolvedValue({ workspaceId: "workspace-a" }),
      },
      creditLedger: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: ledgerCreate,
      },
      workspace: {
        update: vi.fn().mockResolvedValue({ creditBalance: 250 }),
      },
    } as unknown as Prisma.TransactionClient;
    const { grantStarterCreditsAfterVerification } =
      await import("@/server/auth-service");

    await expect(
      grantStarterCreditsAfterVerification(tx, "user-a"),
    ).resolves.toEqual({ granted: true, amount: 250 });
    expect(tx.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { creditBalance: { increment: 250 } },
      }),
    );
    expect(ledgerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 250,
          balanceAfter: 250,
          idempotencyKey: "verification:user-a:starter-grant",
        }),
      }),
    );
  });

  it("does not grant starter credits when the idempotency row exists", async () => {
    const tx = {
      workspaceMember: {
        findFirst: vi.fn().mockResolvedValue({ workspaceId: "workspace-a" }),
      },
      creditLedger: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing" }),
        create: vi.fn(),
      },
      workspace: { update: vi.fn() },
    } as unknown as Prisma.TransactionClient;
    const { grantStarterCreditsAfterVerification } =
      await import("@/server/auth-service");

    await expect(
      grantStarterCreditsAfterVerification(tx, "user-a"),
    ).resolves.toEqual({ granted: false, amount: 0 });
    expect(tx.workspace.update).not.toHaveBeenCalled();
    expect(tx.creditLedger.create).not.toHaveBeenCalled();
  });

  it("replaces verification tokens inside one transaction", async () => {
    const order: string[] = [];
    const tx = {
      verificationToken: {
        deleteMany: vi.fn(async () => {
          order.push("delete");
        }),
        create: vi.fn(async () => {
          order.push("create");
        }),
      },
    };
    mocks.transaction.mockImplementationOnce(
      async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );
    const { issueEmailVerification } = await import("@/server/auth-service");

    const token = await issueEmailVerification("user-a", "User@Example.com");
    expect(token.length).toBeGreaterThan(32);
    expect(order).toEqual(["delete", "create"]);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
