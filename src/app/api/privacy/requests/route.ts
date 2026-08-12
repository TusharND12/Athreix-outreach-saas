import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { encryptSensitive, hashIdentifier } from "@/lib/server/crypto";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";

const schema = z.object({
  type: z.enum([
    "ACCESS",
    "CORRECTION",
    "DELETION",
    "RESTRICTION",
    "OBJECTION",
    "PORTABILITY",
  ]),
  identity: z.string().trim().min(3).max(254),
  details: z.string().trim().min(10).max(2_000),
});

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("ADMIN");
    if (context.demo) return apiSuccess([]);
    return apiSuccess(
      await db.dataSubjectRequest.findMany({
        where: { workspaceId: context.workspaceId },
        select: {
          id: true,
          type: true,
          status: true,
          dueAt: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });
}

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    await enforceRateLimit(
      `privacy-request:${context.workspaceId}:${context.userId}`,
      10,
      24 * 60 * 60,
    );
    const input = schema.parse(await readJson(request));
    if (context.demo)
      return apiSuccess(
        {
          id: `privacy-${crypto.randomUUID()}`,
          type: input.type,
          status: "RECEIVED",
        },
        { status: 201 },
      );
    const identityHash = hashIdentifier(input.identity);
    const existing = await db.dataSubjectRequest.findFirst({
      where: {
        workspaceId: context.workspaceId,
        type: input.type,
        identityHash,
        status: { in: ["RECEIVED", "VERIFYING", "IN_PROGRESS"] },
      },
      select: {
        id: true,
        type: true,
        status: true,
        dueAt: true,
        createdAt: true,
      },
    });
    if (existing) return apiSuccess(existing);
    const saved = await db.dataSubjectRequest.create({
      data: {
        workspaceId: context.workspaceId,
        type: input.type,
        identityHash,
        requestEncrypted: encryptSensitive(
          JSON.stringify({ identity: input.identity, details: input.details }),
        ),
        dueAt: new Date(Date.now() + 30 * 86_400_000),
      },
      select: {
        id: true,
        type: true,
        status: true,
        dueAt: true,
        createdAt: true,
      },
    });
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "privacy.request.create",
      entityType: "data_subject_request",
      entityId: saved.id,
      metadata: { type: input.type },
    });
    return apiSuccess(saved, { status: 201 });
  });
}
