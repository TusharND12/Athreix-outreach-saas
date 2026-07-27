import { NextResponse } from "next/server";
import { apiRoute, searchParams } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { paginationSchema } from "@/server/schemas";
import { listExports } from "@/server/export-service";

export async function GET(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const pagination = paginationSchema.parse(searchParams(request));
    const result = await listExports(
      context,
      pagination.page,
      pagination.pageSize,
    );
    return NextResponse.json({
      data: result.data,
      meta: {
        demo: context.mockData,
        pagination: {
          ...pagination,
          total: result.total,
          pages: Math.ceil(result.total / pagination.pageSize),
        },
      },
    });
  });
}
