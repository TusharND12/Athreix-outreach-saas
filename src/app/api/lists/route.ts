import { apiRoute, apiSuccess } from "@/lib/server/api";
import { readJson } from "@/lib/server/errors";
import { requireContext } from "@/server/auth-context";
import { listCreateSchema } from "@/server/schemas";
import { createList, listSavedLists } from "@/server/list-service";

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    return apiSuccess(await listSavedLists(context));
  });
}

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const input = listCreateSchema.parse(await readJson(request));
    return apiSuccess(await createList(context, input), { status: 201 });
  });
}
