import { z } from "zod";
import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";
import { deleteList, getSavedList, updateList } from "@/server/list-service";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1_000).optional(),
  folderId: z.string().nullable().optional(),
  addResultIds: z.array(z.string()).max(1_000).optional(),
  removeResultIds: z.array(z.string()).max(1_000).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const { id } = await params;
    return apiSuccess(await getSavedList(context, id));
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const { id } = await params;
    return apiSuccess(
      await updateList(
        context,
        id,
        updateSchema.parse(await readJson(request)),
      ),
    );
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const { id } = await params;
    await deleteList(context, id);
    return apiSuccess({ ok: true });
  });
}
