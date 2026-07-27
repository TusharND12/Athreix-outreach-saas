import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/server/errors";
import { env } from "@/lib/server/env";

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> },
) {
  return NextResponse.json(
    {
      data,
      meta: {
        demo: env.mockDataEnabled,
        ...(init?.meta ?? {}),
      },
    },
    { status: init?.status ?? 200 },
  );
}

export async function apiRoute(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    return errorResponse(error);
  }
}

export function searchParams(request: Request) {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}
