import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { answerCompanyQuestion } from "@/server/ai";
import { getCompanyIntelligence } from "@/server/company-intelligence-read";

const chatSchema = z
  .object({
    question: z.string().trim().min(3).max(1_000),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const { id } = await params;
    await enforceRateLimit(
      `ai:company-chat:${context.workspaceId}:${context.userId}`,
      40,
      60,
    );
    const input = chatSchema.parse(await readJson(request));
    const dossier = await getCompanyIntelligence(context, id);
    const answer = await answerCompanyQuestion({
      question: input.question,
      dossier,
      workspaceId: context.workspaceId,
      userId: context.userId,
    });
    return apiSuccess(answer);
  });
}
