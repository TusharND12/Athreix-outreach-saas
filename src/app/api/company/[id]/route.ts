import { apiRoute, apiSuccess } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { getCompanyIntelligence } from "@/server/company-intelligence-read";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const { id } = await params;
    return apiSuccess(await getCompanyIntelligence(context, id));
  });
}
