import { apiRoute, apiSuccess } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { deleteExport } from "@/server/export-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const { id } = await params;
    await deleteExport(context, id);
    return apiSuccess({ ok: true });
  });
}
