import { db } from "@/lib/server/db";
import { env } from "@/lib/server/env";

export type AuditInput = {
  workspaceId?: string;
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipHash?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
};

const demoAudit: Array<AuditInput & { createdAt: string }> = [];

export async function writeAudit(input: AuditInput) {
  if (!env.databaseEnabled || input.workspaceId === "demo-workspace") {
    const createdAt = new Date();
    demoAudit.unshift({ ...input, createdAt: createdAt.toISOString() });
    if (demoAudit.length > 250) demoAudit.pop();
    return;
  }
  await db.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ipHash: input.ipHash,
      userAgent: input.userAgent,
      metadata: input.metadata as never,
    },
  });
}

export function readDemoAudit() {
  return demoAudit.slice();
}
