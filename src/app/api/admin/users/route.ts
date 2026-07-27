import { NextResponse } from "next/server";
import { apiRoute, searchParams } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requirePlatformAdmin } from "@/server/auth-context";
import { paginationSchema } from "@/server/schemas";

export async function GET(request: Request) {
  return apiRoute(async () => {
    const context = await requirePlatformAdmin();
    const pagination = paginationSchema.parse(searchParams(request));
    if (context.demo)
      return NextResponse.json({
        data: [
          {
            id: "demo-user",
            name: "Athreix Demo",
            email: "demo@athreix.ai",
            workspaceCount: 1,
          },
        ],
        meta: { pagination: { ...pagination, total: 1, pages: 1 }, demo: true },
      });
    const [data, total] = await db.$transaction([
      db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          isPlatformAdmin: true,
          createdAt: true,
          _count: { select: { memberships: true, searches: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }),
      db.user.count(),
    ]);
    return NextResponse.json({
      data,
      meta: {
        pagination: {
          ...pagination,
          total,
          pages: Math.ceil(total / pagination.pageSize),
        },
      },
    });
  });
}
