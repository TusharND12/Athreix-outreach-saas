import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { getExportDownload } from "@/server/export-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    const { id } = await params;
    return NextResponse.redirect(await getExportDownload(context, id), 307);
  });
}
