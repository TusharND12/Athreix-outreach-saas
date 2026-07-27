import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { interpretSearchBrief } from "@/server/ai";

const requestSchema = z
  .object({
    query: z.string().trim().min(3).max(2_000),
    mode: z.enum(["B2B", "B2C"]).default("B2B"),
  })
  .strict();

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    await enforceRateLimit(
      `ai:search-understanding:${context.workspaceId}:${context.userId}`,
      30,
      60,
    );
    const input = requestSchema.parse(await readJson(request));
    const interpretation = await interpretSearchBrief({
      ...input,
      workspaceId: context.workspaceId,
      userId: context.userId,
    });
    return apiSuccess(interpretation, { meta: { demo: context.mockData } });
  });
}
