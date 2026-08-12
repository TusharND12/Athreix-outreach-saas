import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { decryptSensitive, encryptSensitive } from "@/lib/server/crypto";
import { db } from "@/lib/server/db";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requirePlatformAdmin } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";

const updateSchema = z
  .object({
    id: z.string().min(1).max(200),
    status: z.enum(["VERIFYING", "IN_PROGRESS", "COMPLETE", "REJECTED"]),
    resolution: z.string().trim().min(10).max(2_000),
    evidenceReference: z.string().trim().min(8).max(300).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "COMPLETE" && !value.evidenceReference) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["evidenceReference"],
        message:
          "Completion requires a deletion or resolution evidence reference.",
      });
    }
  });

export async function GET(request: Request) {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    await enforceRateLimit(`admin-privacy:${context.userId}`, 120, 5 * 60);
    if (context.demo) return apiSuccess([]);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const item = await db.dataSubjectRequest.findUnique({
        where: { id },
        include: { workspace: { select: { name: true } } },
      });
      if (!item)
        throw new AppError("NOT_FOUND", "Privacy request not found.", 404);
      let requestPayload: unknown;
      let resolutionPayload: unknown;
      try {
        requestPayload = JSON.parse(decryptSensitive(item.requestEncrypted));
        resolutionPayload = item.resolution
          ? JSON.parse(decryptSensitive(item.resolution))
          : null;
      } catch {
        throw new AppError(
          "PRIVACY_PAYLOAD_UNAVAILABLE",
          "The encrypted privacy request could not be opened.",
          500,
        );
      }
      await writeAudit({
        workspaceId: item.workspaceId,
        actorId: context.userId,
        action: "privacy.request.reveal",
        entityType: "data_subject_request",
        entityId: item.id,
      });
      return apiSuccess({
        id: item.id,
        workspaceId: item.workspaceId,
        type: item.type,
        status: item.status,
        dueAt: item.dueAt,
        completedAt: item.completedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        workspace: item.workspace,
        requestPayload,
        resolutionPayload,
      });
    }
    return apiSuccess(
      await db.dataSubjectRequest.findMany({
        select: {
          id: true,
          workspaceId: true,
          type: true,
          status: true,
          dueAt: true,
          completedAt: true,
          createdAt: true,
          workspace: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 250,
      }),
    );
  });
}

export async function PATCH(request: Request) {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    await enforceRateLimit(`admin-privacy:${context.userId}`, 120, 5 * 60);
    const input = updateSchema.parse(await readJson(request, 16 * 1024));
    const current = await db.dataSubjectRequest.findUnique({
      where: { id: input.id },
      select: { id: true, workspaceId: true, type: true },
    });
    if (!current)
      throw new AppError("NOT_FOUND", "Privacy request not found.", 404);
    const saved = await db.dataSubjectRequest.update({
      where: { id: input.id },
      data: {
        status: input.status,
        resolution: encryptSensitive(
          JSON.stringify({
            summary: input.resolution,
            evidenceReference: input.evidenceReference,
            resolvedById: context.userId,
            recordedAt: new Date().toISOString(),
          }),
        ),
        completedAt: ["COMPLETE", "REJECTED"].includes(input.status)
          ? new Date()
          : null,
      },
      select: {
        id: true,
        type: true,
        status: true,
        dueAt: true,
        completedAt: true,
      },
    });
    await writeAudit({
      workspaceId: current.workspaceId,
      actorId: context.userId,
      action: "privacy.request.status_update",
      entityType: "data_subject_request",
      entityId: current.id,
      metadata: {
        type: current.type,
        status: input.status,
        evidenceReference: input.evidenceReference,
      },
    });
    return apiSuccess(saved);
  });
}
