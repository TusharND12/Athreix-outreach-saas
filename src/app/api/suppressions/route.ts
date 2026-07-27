import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { hashEmail, hashPhone } from "@/lib/server/crypto";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";
import { writeAudit } from "@/server/audit";

const schema = z
  .object({
    type: z.enum([
      "OPT_OUT",
      "DO_NOT_CONTACT",
      "DELETION_REQUEST",
      "LEGAL_RESTRICTION",
      "BOUNCED",
      "COMPLAINT",
    ]),
    email: z.string().email().optional(),
    phone: z.string().min(7).max(40).optional(),
    country: z.string().trim().min(2).max(100).optional(),
    reason: z.string().max(500).optional(),
    source: z.string().min(2).max(100).default("workspace_user"),
    expiresAt: z.coerce.date().optional(),
  })
  .refine((value) => value.email || value.phone, {
    message: "Provide an email or phone number.",
  });

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("ADMIN");
    if (context.demo) return apiSuccess([]);
    const data = await db.suppressionEntry.findMany({
      where: { workspaceId: context.workspaceId },
      select: {
        id: true,
        type: true,
        reason: true,
        source: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    });
    return apiSuccess(data);
  });
}

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("ADMIN");
    const input = schema.parse(await readJson(request));
    if (context.demo)
      return apiSuccess(
        { id: `suppression-${crypto.randomUUID()}`, type: input.type },
        { status: 201 },
      );
    const emailHash = input.email ? hashEmail(input.email) : undefined;
    const phoneHash = input.phone
      ? hashPhone(input.phone, input.country)
      : undefined;
    const identity = [
      ...(emailHash ? [{ emailHash }] : []),
      ...(phoneHash ? [{ phoneHash }] : []),
    ];
    const outcome = await db.$transaction(async (tx) => {
      const saved = await tx.suppressionEntry.create({
        data: {
          workspaceId: context.workspaceId,
          type: input.type,
          emailHash,
          phoneHash,
          reason: input.reason,
          source: input.source,
          expiresAt: input.expiresAt,
        },
        select: {
          id: true,
          type: true,
          reason: true,
          source: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      const [contacts, consumers] = await Promise.all([
        tx.contact.findMany({
          where: { workspaceId: context.workspaceId, OR: identity },
          select: { id: true },
        }),
        tx.consumerProspect.findMany({
          where: { workspaceId: context.workspaceId, OR: identity },
          select: { id: true },
        }),
      ]);
      const contactIds = contacts.map((item) => item.id);
      const consumerIds = consumers.map((item) => item.id);
      const resultWhere = {
        search: { workspaceId: context.workspaceId },
        OR: [
          ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
          ...(consumerIds.length ? [{ consumerId: { in: consumerIds } }] : []),
        ],
      };

      if (input.type === "DELETION_REQUEST") {
        const affectedRows = await tx.searchResult.findMany({
          where: resultWhere,
          select: { id: true, searchId: true },
        });
        const affectedSearchIds = [
          ...new Set(affectedRows.map((item) => item.searchId)),
        ];
        // Export files can include full-list rows without selectedIds. Expiring
        // every workspace export is conservative but guarantees the subject is
        // not downloadable while storage/provider erasure retries asynchronously.
        const exportsExpired = await tx.export.updateMany({
          where: { workspaceId: context.workspaceId },
          data: {
            status: "EXPIRED",
            expiresAt: new Date(),
            errorCode: "DATA_SUBJECT_DELETION",
            signedUrl: null,
          },
        });
        const sourcesScheduled = await tx.dataSourceRecord.updateMany({
          where: {
            workspaceId: context.workspaceId,
            searchId: { in: affectedSearchIds },
          },
          data: { retentionUntil: new Date() },
        });
        const results = await tx.searchResult.deleteMany({
          where: resultWhere,
        });
        await tx.savedListItem.deleteMany({
          where: {
            OR: [
              ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
              ...(consumerIds.length
                ? [{ consumerId: { in: consumerIds } }]
                : []),
            ],
          },
        });
        const deletedContacts = await tx.contact.deleteMany({
          where: { id: { in: contactIds }, workspaceId: context.workspaceId },
        });
        const deletedConsumers = await tx.consumerProspect.deleteMany({
          where: { id: { in: consumerIds }, workspaceId: context.workspaceId },
        });
        return {
          saved,
          affectedResults: results.count,
          erasedContacts: deletedContacts.count,
          erasedConsumers: deletedConsumers.count,
          exportsExpired: exportsExpired.count,
          sourcesScheduled: sourcesScheduled.count,
        };
      }

      const affected = await tx.searchResult.updateMany({
        where: resultWhere,
        data: { isSuppressed: true, score: 0 },
      });
      if (contactIds.length) {
        await tx.contact.updateMany({
          where: { id: { in: contactIds }, workspaceId: context.workspaceId },
          data: {
            ...(emailHash
              ? {
                  encryptedEmail: null,
                  emailMasked: null,
                  emailVerification: "UNVERIFIED" as const,
                }
              : {}),
            ...(phoneHash
              ? {
                  encryptedPhone: null,
                  phoneMasked: null,
                  phoneVerification: "UNVERIFIED" as const,
                }
              : {}),
          },
        });
      }
      if (consumerIds.length) {
        await tx.consumerProspect.updateMany({
          where: { id: { in: consumerIds }, workspaceId: context.workspaceId },
          data: {
            ...(emailHash
              ? {
                  encryptedEmail: null,
                  emailMasked: null,
                  emailVerification: "UNVERIFIED" as const,
                }
              : {}),
            ...(phoneHash
              ? {
                  encryptedPhone: null,
                  phoneMasked: null,
                  phoneVerification: "UNVERIFIED" as const,
                }
              : {}),
          },
        });
      }
      await tx.evidence.deleteMany({
        where: {
          OR: [
            ...(contactIds.length ? [{ contactId: { in: contactIds } }] : []),
            ...(consumerIds.length
              ? [{ consumerId: { in: consumerIds } }]
              : []),
          ],
          field: { in: ["email", "phone"] },
        },
      });
      return {
        saved,
        affectedResults: affected.count,
        erasedContacts: 0,
        erasedConsumers: 0,
      };
    });
    await writeAudit({
      workspaceId: context.workspaceId,
      actorId: context.userId,
      action: "suppression.create",
      entityType: "suppression",
      entityId: outcome.saved.id,
      metadata: {
        type: input.type,
        affectedResults: outcome.affectedResults,
        erasedContacts: outcome.erasedContacts,
        erasedConsumers: outcome.erasedConsumers,
        ...(input.type === "DELETION_REQUEST"
          ? {
              exportsExpired: outcome.exportsExpired,
              sourcesScheduled: outcome.sourcesScheduled,
            }
          : {}),
      },
    });
    return apiSuccess(outcome.saved, { status: 201 });
  });
}
