import { NextResponse } from "next/server";
import { apiRoute, searchParams } from "@/lib/server/api";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { assertSearchCompliant } from "@/server/compliance";
import { createSearchSchema, paginationSchema } from "@/server/schemas";
import { createSearch, listSearches } from "@/server/search-service";
import { interpretSearchBrief } from "@/server/ai";

function mergeInterpretedFilters(
  explicit: Record<string, unknown>,
  interpreted: Awaited<ReturnType<typeof interpretSearchBrief>>,
) {
  const ai = interpreted.filters;
  const preferArray = (key: keyof typeof ai) => {
    const current = explicit[key];
    return Array.isArray(current) && current.length ? current : ai[key];
  };
  return {
    ...explicit,
    industries: preferArray("industries"),
    locations: preferArray("locations"),
    jobTitles: preferArray("jobTitles"),
    technologies: preferArray("technologies"),
    keywords: preferArray("keywords"),
    websiteKeywords:
      Array.isArray(explicit.websiteKeywords) && explicit.websiteKeywords.length
        ? explicit.websiteKeywords
        : ai.websiteSignals,
    employeeMin: explicit.employeeMin ?? ai.employeeMin ?? undefined,
    employeeMax: explicit.employeeMax ?? ai.employeeMax ?? undefined,
    isHiring: explicit.isHiring ?? ai.isHiring ?? undefined,
  };
}

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    await enforceRateLimit(
      `search:create:${context.workspaceId}:${context.userId}`,
      10,
      60,
    );
    const input = createSearchSchema.parse(await readJson(request));
    if (input.mode === "B2C" && !["OWNER", "ADMIN"].includes(context.role)) {
      throw new AppError(
        "FORBIDDEN",
        "Administrator access is required to run consumer-data searches.",
        403,
      );
    }
    const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
    if (
      idempotencyKey &&
      (idempotencyKey.length < 8 || idempotencyKey.length > 200)
    ) {
      throw new AppError(
        "INVALID_IDEMPOTENCY_KEY",
        "Idempotency-Key must be between 8 and 200 characters.",
        422,
      );
    }
    const interpretation = await interpretSearchBrief({
      query: input.query,
      mode: input.mode,
      workspaceId: context.workspaceId,
      userId: context.userId,
    });
    const effectiveInput =
      input.mode === "B2B"
        ? {
            ...input,
            filters: mergeInterpretedFilters(
              input.filters as Record<string, unknown>,
              interpretation,
            ),
          }
        : input;
    const validatedInput = createSearchSchema.parse(effectiveInput);
    const compliance = assertSearchCompliant(validatedInput);
    const created = await createSearch(
      context,
      validatedInput,
      compliance.retentionDays,
      idempotencyKey,
      interpretation,
    );
    return NextResponse.json(
      {
        data: { id: created.search.id, ...created },
        meta: {
          demo: context.mockData,
          complianceNotice: compliance.notice,
          interpretation,
        },
      },
      { status: 201 },
    );
  });
}

export async function GET(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const pagination = paginationSchema.parse(searchParams(request));
    const result = await listSearches(
      context,
      pagination.page,
      pagination.pageSize,
    );
    return NextResponse.json({
      data: result.data,
      meta: {
        demo: context.mockData,
        pagination: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: result.total,
          pages: Math.ceil(result.total / pagination.pageSize),
        },
      },
    });
  });
}
