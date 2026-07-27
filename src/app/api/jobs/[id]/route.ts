import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { AppError } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const { id } = await params;
    if (context.demo) {
      const job = demoState.jobs.find(
        (item) => item.id === id || item.searchId === id,
      );
      if (!job) throw new AppError("NOT_FOUND", "Job not found.", 404);
      return apiSuccess(job);
    }
    const job = await db.searchJob.findFirst({
      where: {
        OR: [{ id }, { searchId: id }],
        search: { workspaceId: context.workspaceId },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!job) throw new AppError("NOT_FOUND", "Job not found.", 404);
    return apiSuccess(job);
  });
}
