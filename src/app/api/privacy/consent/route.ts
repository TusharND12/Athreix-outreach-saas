import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { encryptSensitive, hashIdentifier } from "@/lib/server/crypto";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";

export async function POST() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    await enforceRateLimit(
      `privacy-consent-withdraw:${context.workspaceId}:${context.userId}`,
      3,
      24 * 60 * 60,
    );
    if (context.demo) {
      return apiSuccess({ withdrawn: true, requestId: "demo-withdrawal" });
    }

    const identityHash = hashIdentifier(context.userId);
    let request = await db.dataSubjectRequest.findFirst({
      where: {
        workspaceId: context.workspaceId,
        type: "RESTRICTION",
        identityHash,
        status: { in: ["RECEIVED", "VERIFYING", "IN_PROGRESS"] },
      },
      select: { id: true },
    });
    if (!request) {
      request = await db.dataSubjectRequest.create({
        data: {
          workspaceId: context.workspaceId,
          type: "RESTRICTION",
          identityHash,
          requestEncrypted: encryptSensitive(
            JSON.stringify({
              identity: context.userId,
              details:
                "DPDP data-processing consent withdrawn. Restrict non-mandatory processing, terminate account access, and complete deletion subject to legal retention duties.",
            }),
          ),
          dueAt: new Date(Date.now() + 30 * 86_400_000),
        },
        select: { id: true },
      });
    }
    await db.user.update({
      where: { id: context.userId },
      data: { sessionVersion: { increment: 1 } },
    });
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "account.privacy_consent.withdrawn",
      entityType: "user",
      entityId: context.userId,
      metadata: {
        effectiveAt: new Date().toISOString(),
        restrictionRequestId: request.id,
        sessionsRevoked: true,
      },
    });
    return apiSuccess({ withdrawn: true, requestId: request.id });
  });
}
