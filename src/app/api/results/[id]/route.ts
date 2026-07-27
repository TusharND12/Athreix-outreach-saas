import { apiRoute, apiSuccess } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { getResult } from "@/server/search-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const reveal = new URL(request.url).searchParams.get("reveal") === "true";
    const context = await requireContext(reveal ? "MEMBER" : "VIEWER");
    const { id } = await params;
    return apiSuccess(await getResult(context, id, reveal), {
      meta: { contactDetails: reveal ? "revealed_and_audited" : "masked" },
    });
  });
}
