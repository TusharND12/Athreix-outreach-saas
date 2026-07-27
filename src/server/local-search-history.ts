import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const storedSearchSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().max(120),
    query: z.string().max(2_000),
    mode: z.enum(["B2B", "B2C"]),
    purpose: z.string().max(1_000),
    lawfulBasis: z.string().max(100).optional(),
    filters: z.record(z.string(), z.unknown()),
    targetCount: z.number().int().min(0).max(1_000_000),
    resultCount: z.number().int().min(0).max(1_000_000),
    status: z.enum(["QUEUED", "RUNNING", "COMPLETE", "FAILED"]),
    chargedCredits: z.number().int().min(0).max(1_000_000),
    retentionUntil: z.string().datetime(),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

const storedJobSchema = z
  .object({
    id: z.string().min(1).max(200),
    searchId: z.string().min(1).max(200),
    status: z.enum(["QUEUED", "RUNNING", "COMPLETE", "FAILED"]),
    stage: z.string().min(1).max(100),
    progress: z.number().int().min(0).max(100),
    provider: z.string().min(1).max(100),
    createdAt: z.string().datetime(),
    completedAt: z.string().datetime().optional(),
  })
  .strict();

const localHistorySchema = z
  .object({
    version: z.literal(1),
    updatedAt: z.string().datetime(),
    searches: z.array(storedSearchSchema).max(100_000),
    jobs: z.array(storedJobSchema).max(100_000),
  })
  .strict();

export type StoredSearch = z.infer<typeof storedSearchSchema>;
export type StoredJob = z.infer<typeof storedJobSchema>;
export type LocalSearchHistory = z.infer<typeof localHistorySchema>;

function defaultHistoryPath() {
  return path.join(process.cwd(), ".athreix", "search-history.json");
}

function expiredSearch(search: StoredSearch, now: Date): StoredSearch {
  if (new Date(search.retentionUntil) > now) return search;
  return {
    ...search,
    name: "Expired search",
    query: "",
    purpose: "Expired prospect research",
    filters: {},
    resultCount: 0,
  };
}

export function prepareLocalHistoryForStartup(
  history: LocalSearchHistory,
  now = new Date(),
): LocalSearchHistory {
  const interruptedSearchIds = new Set(
    history.searches
      .filter((search) => ["QUEUED", "RUNNING"].includes(search.status))
      .map((search) => search.id),
  );
  return {
    ...history,
    updatedAt: now.toISOString(),
    searches: history.searches.map((search) =>
      expiredSearch(
        interruptedSearchIds.has(search.id)
          ? {
              ...search,
              status: "FAILED",
              completedAt: now.toISOString(),
            }
          : search,
        now,
      ),
    ),
    jobs: history.jobs.map((job) =>
      interruptedSearchIds.has(job.searchId) ||
      ["QUEUED", "RUNNING"].includes(job.status)
        ? {
            ...job,
            status: "FAILED",
            stage: "INTERRUPTED",
            progress: 100,
            completedAt: now.toISOString(),
          }
        : job,
    ),
  };
}

export function readLocalSearchHistory(
  filePath = defaultHistoryPath(),
): LocalSearchHistory {
  try {
    const parsed = localHistorySchema.safeParse(
      JSON.parse(readFileSync(filePath, "utf8")),
    );
    if (parsed.success) return parsed.data;
  } catch {
    // A missing or unreadable local history starts as an empty history.
  }
  return {
    version: 1,
    updatedAt: new Date(0).toISOString(),
    searches: [],
    jobs: [],
  };
}

export function writeLocalSearchHistory(
  input: Pick<LocalSearchHistory, "searches" | "jobs">,
  filePath = defaultHistoryPath(),
) {
  const now = new Date();
  const history = localHistorySchema.parse({
    version: 1,
    updatedAt: now.toISOString(),
    searches: input.searches.map((search) => expiredSearch(search, now)),
    jobs: input.jobs,
  });
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(history, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  renameSync(temporaryPath, filePath);
}
