import { db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import type { RequestContext } from "@/server/auth-context";
import { demoState, persistDemoLiveState } from "@/server/demo-store";
import type { z } from "zod";
import type { listCreateSchema } from "@/server/schemas";
import { writeAudit } from "@/server/audit";
import { serializeDatabaseResult } from "@/server/search-service";
import { maskEmail, maskPhone } from "@/lib/server/crypto";

type ListInput = z.infer<typeof listCreateSchema>;

export async function createList(context: RequestContext, input: ListInput) {
  if (context.demo) {
    const now = new Date().toISOString();
    const list = {
      id: `list-${crypto.randomUUID()}`,
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    demoState.lists.unshift(list);
    persistDemoLiveState();
    return list;
  }
  if (input.folderId) {
    const folder = await db.savedFolder.findFirst({
      where: { id: input.folderId, workspaceId: context.workspaceId },
    });
    if (!folder) throw new AppError("NOT_FOUND", "Folder not found.", 404);
  }
  const validResults = input.resultIds.length
    ? await db.searchResult.findMany({
        where: {
          id: { in: input.resultIds },
          retentionUntil: { gt: new Date() },
          search: { workspaceId: context.workspaceId },
        },
        select: { id: true },
      })
    : [];
  if (validResults.length !== new Set(input.resultIds).size) {
    throw new AppError(
      "INVALID_LIST_ITEMS",
      "One or more prospects are unavailable in this workspace.",
      422,
    );
  }
  const list = await db.savedList.create({
    data: {
      workspaceId: context.workspaceId,
      createdById: context.userId,
      folderId: input.folderId,
      name: input.name,
      description: input.description,
      items: {
        create: validResults.map((result) => ({ resultId: result.id })),
      },
    },
    include: { _count: { select: { items: true } } },
  });
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "list.create",
    entityType: "saved_list",
    entityId: list.id,
    metadata: { itemCount: validResults.length },
  });
  return list;
}

export async function listSavedLists(context: RequestContext) {
  if (context.demo) {
    const now = new Date();
    const availableResultIds = new Set(
      demoState.results
        .filter((result) => {
          const search = demoState.searches.find(
            (item) => item.id === result.searchId,
          );
          return Boolean(search && new Date(search.retentionUntil) > now);
        })
        .map((result) => result.id),
    );
    return demoState.lists.map((list) => ({
      ...list,
      resultIds: list.resultIds.filter((id) => availableResultIds.has(id)),
    }));
  }
  const now = new Date();
  return db.savedList.findMany({
    where: { workspaceId: context.workspaceId },
    include: {
      folder: true,
      _count: {
        select: {
          items: {
            where: { result: { retentionUntil: { gt: now } } },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getSavedList(context: RequestContext, id: string) {
  if (context.demo) {
    const list = demoState.lists.find((item) => item.id === id);
    if (!list) throw new AppError("NOT_FOUND", "List not found.", 404);
    const results = demoState.results
      .filter((result) => {
        const search = demoState.searches.find(
          (item) => item.id === result.searchId,
        );
        return (
          list.resultIds.includes(result.id) &&
          Boolean(search && new Date(search.retentionUntil) > new Date())
        );
      })
      .map((result) => ({
        id: result.id,
        searchId: result.searchId,
        mode: result.mode,
        subjectType:
          result.mode === "B2C" ? "consumer" : "professional_contact",
        name: result.name,
        title: result.title,
        company: result.company,
        location: result.location,
        email: result.email ? maskEmail(result.email) : undefined,
        phone: result.phone ? maskPhone(result.phone) : undefined,
        score: result.score,
        status: result.status,
      }));
    return { ...list, resultIds: list.resultIds, items: results };
  }
  const list = await db.savedList.findFirst({
    where: { id, workspaceId: context.workspaceId },
    include: {
      folder: true,
      items: {
        where: { result: { retentionUntil: { gt: new Date() } } },
        orderBy: { createdAt: "desc" },
        include: {
          result: {
            include: {
              search: true,
              company: true,
              contact: true,
              consumer: true,
              aiResponses: true,
            },
          },
        },
      },
    },
  });
  if (!list) throw new AppError("NOT_FOUND", "List not found.", 404);
  return {
    ...list,
    resultIds: list.items.flatMap((item) =>
      item.resultId ? [item.resultId] : [],
    ),
    items: list.items.map((item) => ({
      id: item.id,
      notes: item.notes,
      createdAt: item.createdAt,
      result: item.result ? serializeDatabaseResult(item.result, false) : null,
    })),
  };
}

export async function updateList(
  context: RequestContext,
  id: string,
  input: {
    name?: string;
    description?: string;
    folderId?: string | null;
    addResultIds?: string[];
    removeResultIds?: string[];
  },
) {
  if (context.demo) {
    const list = demoState.lists.find((item) => item.id === id);
    if (!list) throw new AppError("NOT_FOUND", "List not found.", 404);
    if (input.name) list.name = input.name;
    if (input.description !== undefined) list.description = input.description;
    if (input.folderId !== undefined)
      list.folderId = input.folderId ?? undefined;
    list.resultIds = [
      ...new Set([...list.resultIds, ...(input.addResultIds ?? [])]),
    ].filter((resultId) => !input.removeResultIds?.includes(resultId));
    list.updatedAt = new Date().toISOString();
    persistDemoLiveState();
    return list;
  }
  const list = await db.savedList.findFirst({
    where: { id, workspaceId: context.workspaceId },
  });
  if (!list) throw new AppError("NOT_FOUND", "List not found.", 404);
  if (input.folderId) {
    const folder = await db.savedFolder.findFirst({
      where: { id: input.folderId, workspaceId: context.workspaceId },
      select: { id: true },
    });
    if (!folder) throw new AppError("NOT_FOUND", "Folder not found.", 404);
  }
  const requestedAdds = [...new Set(input.addResultIds ?? [])];
  if (requestedAdds.length) {
    const validAdds = await db.searchResult.count({
      where: {
        id: { in: requestedAdds },
        retentionUntil: { gt: new Date() },
        search: { workspaceId: context.workspaceId },
      },
    });
    if (validAdds !== requestedAdds.length) {
      throw new AppError(
        "INVALID_LIST_ITEMS",
        "One or more prospects are unavailable in this workspace.",
        422,
      );
    }
  }
  const updated = await db.$transaction(async (tx) => {
    const updated = await tx.savedList.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        folderId: input.folderId,
      },
    });
    if (input.removeResultIds?.length)
      await tx.savedListItem.deleteMany({
        where: { listId: id, resultId: { in: input.removeResultIds } },
      });
    if (requestedAdds.length) {
      const existing = await tx.savedListItem.findMany({
        where: { listId: id, resultId: { in: requestedAdds } },
        select: { resultId: true },
      });
      const existingIds = new Set(existing.map((item) => item.resultId));
      await tx.savedListItem.createMany({
        data: requestedAdds
          .filter((resultId) => !existingIds.has(resultId))
          .map((resultId) => ({ listId: id, resultId })),
      });
    }
    return updated;
  });
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "list.update",
    entityType: "saved_list",
    entityId: id,
    metadata: {
      added: requestedAdds.length,
      removed: input.removeResultIds?.length ?? 0,
      movedFolder: input.folderId !== undefined,
    },
  });
  return updated;
}

export async function deleteList(context: RequestContext, id: string) {
  if (context.demo) {
    const index = demoState.lists.findIndex((item) => item.id === id);
    if (index < 0) throw new AppError("NOT_FOUND", "List not found.", 404);
    demoState.lists.splice(index, 1);
    persistDemoLiveState();
    return;
  }
  const deleted = await db.savedList.deleteMany({
    where: { id, workspaceId: context.workspaceId },
  });
  if (!deleted.count) throw new AppError("NOT_FOUND", "List not found.", 404);
  await writeAudit({
    workspaceId: context.workspaceId,
    actorId: context.userId,
    action: "list.delete",
    entityType: "saved_list",
    entityId: id,
  });
}
