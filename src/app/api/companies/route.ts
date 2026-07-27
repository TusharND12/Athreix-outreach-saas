import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requireContext } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo) {
      const retainedSearchIds = new Set(
        demoState.searches
          .filter((search) => new Date(search.retentionUntil) > new Date())
          .map((search) => search.id),
      );
      const unique = new Map<string, (typeof demoState.results)[number]>();
      for (const result of demoState.results) {
        if (
          result.mode !== "B2B" ||
          result.normalized.mode !== "B2B" ||
          !retainedSearchIds.has(result.searchId)
        )
          continue;
        const key =
          result.normalized.company.domain ??
          result.normalized.company.normalizedName;
        const current = unique.get(key);
        if (!current || current.score < result.score) unique.set(key, result);
      }
      return apiSuccess(
        [...unique.values()].map((result) => ({
          id: result.id,
          name: result.company,
          industry: result.industry,
          location: result.location,
          employeeRange: result.companySize,
          score: result.score,
          buyingIntent:
            result.buyingIntent === "HIGH"
              ? 90
              : result.buyingIntent === "MEDIUM"
                ? 68
                : 40,
          confidence: result.decisionMakerConfidence,
          signal: result.reasons[0],
          website: result.website,
          updatedAt: result.createdAt,
        })),
      );
    }
    const companies = await db.company.findMany({
      where: {
        workspaceId: context.workspaceId,
        results: { some: { retentionUntil: { gt: new Date() } } },
      },
      include: {
        results: {
          where: { retentionUntil: { gt: new Date() } },
          orderBy: { score: "desc" },
          take: 1,
        },
        buyingSignals: { orderBy: { observedAt: "desc" }, take: 1 },
        research: { select: { confidence: true, researchedAt: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return apiSuccess(
      companies.map((company) => ({
        id: company.id,
        name: company.name,
        industry: company.industry,
        location: company.location,
        employeeRange: company.employeeRange,
        score: company.results[0]?.score ?? 0,
        buyingIntent:
          company.results[0]?.buyingIntent === "HIGH"
            ? 90
            : company.results[0]?.buyingIntent === "MEDIUM"
              ? 68
              : 40,
        confidence:
          company.research?.confidence ?? company.results[0]?.confidence ?? 0,
        signal: company.buyingSignals[0]?.title,
        website: company.website,
        updatedAt:
          company.research?.researchedAt.toISOString() ??
          company.updatedAt.toISOString(),
      })),
    );
  });
}
