import { apiRoute, apiSuccess } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { requireContext } from "@/server/auth-context";
import { demoState } from "@/server/demo-store";

export async function GET() {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    if (context.demo) {
      const now = new Date();
      const activeSearches = demoState.searches.filter(
        (search) => new Date(search.retentionUntil) > now,
      );
      const retainedResults = demoState.results.filter((result) =>
        activeSearches.some((search) => search.id === result.searchId),
      );
      const topLeads = retainedResults
        .filter((result) => result.mode === "B2B")
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
      return apiSuccess({
        metrics: {
          prospectsGenerated: retainedResults.length,
          remainingCredits: demoState.creditBalance,
          reservedCredits: demoState.creditReserved,
          savedLists: demoState.lists.length,
          exports: demoState.exports.length,
        },
        recentSearches: demoState.searches.slice(0, 5).map((search) =>
          new Date(search.retentionUntil) > now
            ? search
            : {
                ...search,
                name: "Expired search",
                query: "",
                purpose: "Expired prospect research",
                filters: {},
                resultCount: 0,
              },
        ),
        recentExports: demoState.exports.slice(0, 5),
        suggestions: [
          "Find architecture firms in Pune with outdated websites.",
          "Find SaaS startups in India hiring AI engineers.",
          "Find manufacturers using WordPress with weak conversion paths.",
        ],
        topLeads: topLeads.map((result) => ({
          id: result.id,
          companyId: result.id,
          company: result.company,
          industry: result.industry,
          location: result.location,
          score: result.score,
          buyingIntent:
            result.buyingIntent === "HIGH"
              ? 90
              : result.buyingIntent === "MEDIUM"
                ? 68
                : 40,
          confidence: result.decisionMakerConfidence,
          reason: result.summary,
        })),
        buyingSignals: topLeads
          .flatMap((result) =>
            result.reasons.slice(0, 1).map((reason, index) => ({
              id: `${result.id}-signal-${index + 1}`,
              type: "OTHER",
              title: reason,
              detail: result.summary,
              strength:
                result.buyingIntent === "HIGH"
                  ? "strong"
                  : result.buyingIntent === "MEDIUM"
                    ? "moderate"
                    : "weak",
              observedAt: result.evidence[0]?.observedAt ?? result.createdAt,
              confidence: result.decisionMakerConfidence,
              evidenceRefs: result.evidence.map(
                (evidence) => evidence.sourceUrl ?? evidence.provider,
              ),
              companyId: result.id,
              company: result.company,
            })),
          )
          .slice(0, 5),
        researchQueue: activeSearches
          .filter((search) => ["QUEUED", "RUNNING"].includes(search.status))
          .slice(0, 4)
          .map((search) => ({
            id: search.id,
            name: search.name,
            stage:
              search.status === "RUNNING" ? "Analyzing companies" : "Queued",
            progress: search.status === "RUNNING" ? 64 : 0,
            status: search.status,
          })),
        tasks: [],
      });
    }
    const exportWhere = {
      workspaceId: context.workspaceId,
      ...(["OWNER", "ADMIN"].includes(context.role)
        ? {}
        : { createdById: context.userId }),
    };
    const [
      workspace,
      prospectsGenerated,
      savedLists,
      exportsCount,
      recentSearches,
      recentExports,
      topLeads,
      buyingSignals,
      researchQueue,
      tasks,
    ] = await Promise.all([
      db.workspace.findUniqueOrThrow({
        where: { id: context.workspaceId },
        select: { creditBalance: true, creditReserved: true },
      }),
      db.searchResult.count({
        where: {
          retentionUntil: { gt: new Date() },
          search: { workspaceId: context.workspaceId },
        },
      }),
      db.savedList.count({ where: { workspaceId: context.workspaceId } }),
      db.export.count({ where: exportWhere }),
      db.search.findMany({
        where: { workspaceId: context.workspaceId },
        select: {
          id: true,
          name: true,
          query: true,
          mode: true,
          status: true,
          retentionUntil: true,
          createdAt: true,
          completedAt: true,
          _count: {
            select: {
              results: { where: { retentionUntil: { gt: new Date() } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.export.findMany({
        where: exportWhere,
        select: {
          id: true,
          searchId: true,
          format: true,
          status: true,
          recordCount: true,
          expiresAt: true,
          errorCode: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.searchResult.findMany({
        where: {
          retentionUntil: { gt: new Date() },
          companyId: { not: null },
          search: { workspaceId: context.workspaceId },
        },
        include: { company: true },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 6,
      }),
      db.buyingSignal.findMany({
        where: { workspaceId: context.workspaceId },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ observedAt: "desc" }, { confidence: "desc" }],
        take: 6,
      }),
      db.searchJob.findMany({
        where: {
          status: { in: ["QUEUED", "RUNNING", "RETRYING"] },
          search: { workspaceId: context.workspaceId },
        },
        include: { search: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      db.salesTask.findMany({
        where: {
          workspaceId: context.workspaceId,
          status: { not: "COMPLETE" },
        },
        include: { company: { select: { id: true, name: true } } },
        orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
        take: 5,
      }),
    ]);
    return apiSuccess({
      metrics: {
        prospectsGenerated,
        remainingCredits: workspace.creditBalance,
        reservedCredits: workspace.creditReserved,
        savedLists,
        exports: exportsCount,
      },
      recentSearches: recentSearches.map((search) =>
        search.retentionUntil > new Date()
          ? search
          : { ...search, name: "Expired search", query: "" },
      ),
      recentExports,
      suggestions: [
        "Find companies with active hiring and weak digital conversion.",
        "Review high-intent accounts with fresh evidence.",
        "Rerun saved searches whose evidence is older than 30 days.",
      ],
      topLeads: topLeads.map((result) => ({
        id: result.id,
        companyId: result.companyId,
        company: result.company?.name ?? "Unclassified company",
        industry: result.company?.industry,
        location: result.company?.location,
        score: result.score,
        buyingIntent:
          result.buyingIntent === "HIGH"
            ? 90
            : result.buyingIntent === "MEDIUM"
              ? 68
              : 40,
        confidence: result.confidence ?? 0,
        reason: result.summary,
      })),
      buyingSignals: buyingSignals.map((signal) => ({
        id: signal.id,
        companyId: signal.company.id,
        company: signal.company.name,
        title: signal.title,
        detail: signal.detail,
        strength: signal.strength,
        confidence: signal.confidence,
        observedAt: signal.observedAt.toISOString(),
      })),
      researchQueue: researchQueue.map((job) => ({
        id: job.search.id,
        name: job.search.name,
        stage: job.stage.replaceAll("_", " ").toLowerCase(),
        progress: job.progress,
        status: job.status,
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        companyId: task.company?.id,
        company: task.company?.name,
        title: task.title,
        priority: task.priority,
        dueAt: task.dueAt?.toISOString(),
      })),
    });
  });
}
