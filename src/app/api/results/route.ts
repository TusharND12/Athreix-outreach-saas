import { NextResponse } from "next/server";
import { apiRoute, searchParams } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { resultsQuerySchema } from "@/server/schemas";
import { listResults } from "@/server/search-service";

export async function GET(request: Request) {
  return apiRoute(async () => {
    const params = searchParams(request);
    const reveal = params.reveal === "true";
    const context = await requireContext(reveal ? "MEMBER" : "VIEWER");
    const query = resultsQuerySchema.parse(params);
    const result = await listResults(context, query, reveal);
    return NextResponse.json({
      data: result.data,
      stats: result.stats,
      meta: {
        demo: context.mockData,
        maskedContactDetails: !reveal,
        contactDetails: reveal ? "revealed_and_audited" : "masked",
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
          pages: Math.ceil(result.total / query.pageSize),
        },
      },
    });
  });
}
