import { apiRoute, apiSuccess } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { deleteSearch, getSearch } from "@/server/search-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const { id } = await params;
    return apiSuccess(await getSearch(context, id));
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const { id } = await params;
    await deleteSearch(context, id);
    return apiSuccess({ ok: true });
  });
}
