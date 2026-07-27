import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { outreachSchema } from "@/server/schemas";
import {
  canAccessConsumerOutreach,
  createOutreachDraft,
} from "@/server/outreach-service";
import { db } from "@/lib/server/db";
import { demoState } from "@/server/demo-store";

export async function handleOutreachPost(
  request: Request,
  forcedType?: string,
) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    await enforceRateLimit(
      `outreach:${context.workspaceId}:${context.userId}`,
      20,
      60,
    );
    const raw = await readJson(request);
    const input = outreachSchema.parse({
      ...(typeof raw === "object" && raw ? raw : {}),
      ...(forcedType ? { type: forcedType } : {}),
    });
    const draft = await createOutreachDraft(context, input);
    return apiSuccess(
      {
        ...draft,
        delivery: "draft_only",
        notice:
          "Athreix does not send this message. Verify evidence, permission, relevance, and channel rules before manual use.",
      },
      { status: 201 },
    );
  });
}

export async function POST(request: Request) {
  return handleOutreachPost(request);
}

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const canAccessConsumers = canAccessConsumerOutreach(context.role);
    if (context.demo) {
      return apiSuccess(
        demoState.outreach.filter((draft) => {
          const result = demoState.results.find(
            (item) => item.id === draft.resultId,
          );
          if (!result || (result.mode === "B2C" && !canAccessConsumers)) {
            return false;
          }
          const search = result
            ? demoState.searches.find((item) => item.id === result.searchId)
            : undefined;
          return Boolean(
            search && new Date(search.retentionUntil) > new Date(),
          );
        }),
      );
    }
    const data = await db.outreach.findMany({
      where: {
        result: {
          retentionUntil: { gt: new Date() },
          ...(!canAccessConsumers ? { consumerId: null } : {}),
          search: {
            workspaceId: context.workspaceId,
            ...(!canAccessConsumers ? { mode: "B2B" as const } : {}),
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return apiSuccess(data);
  });
}
