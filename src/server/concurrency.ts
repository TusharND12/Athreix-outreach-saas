export class AsyncSemaphore {
  private active = 0;
  private readonly waiters: Array<(release: () => void) => void> = [];

  constructor(readonly capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("Semaphore capacity must be a positive integer");
    }
  }

  private acquire(): Promise<() => void> {
    if (this.active < this.capacity) {
      this.active += 1;
      return Promise.resolve(() => this.release());
    }
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  private release() {
    const next = this.waiters.shift();
    if (next) {
      next(() => this.release());
      return;
    }
    this.active -= 1;
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

/**
 * Runs asynchronous work with bounded concurrency while preserving the source
 * order in the returned array. This is intentionally for side-effect-free or
 * read-only work; canonical database writes remain sequential in the pipeline.
 */
export async function mapConcurrentOrdered<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const workerCount = Math.max(
    1,
    Math.min(items.length, Math.trunc(concurrency) || 1),
  );
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index]!, index);
    }
  });
  const settled = await Promise.allSettled(workers);
  const failure = settled.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) throw failure.reason;
  return results;
}

export function orderedWindows<T>(items: readonly T[], windowSize: number) {
  const size = Math.max(1, Math.trunc(windowSize) || 1);
  const windows: Array<{ start: number; items: T[] }> = [];
  for (let start = 0; start < items.length; start += size) {
    windows.push({ start, items: items.slice(start, start + size) });
  }
  return windows;
}

export class ResultBudget {
  private readonly resultIds: Set<string>;

  constructor(
    readonly target: number,
    existingIds: Iterable<string> = [],
  ) {
    this.resultIds = new Set(existingIds);
    if (!Number.isInteger(target) || target < 0) {
      throw new Error("Result target must be a non-negative integer");
    }
    if (this.resultIds.size > target) {
      throw new Error("Delivered result count exceeds the target limit");
    }
  }

  get count() {
    return this.resultIds.size;
  }

  get full() {
    return this.count >= this.target;
  }

  add(resultId: string) {
    if (this.resultIds.has(resultId)) return true;
    if (this.full) return false;
    this.resultIds.add(resultId);
    return true;
  }
}

export function analysisStageProgress(input: {
  processed: number;
  eligible: number;
  delivered: number;
  target: number;
}) {
  const progressRatio = Math.max(
    input.processed / Math.max(1, input.eligible),
    input.delivered / Math.max(1, input.target),
  );
  return 55 + Math.round(Math.min(1, Math.max(0, progressRatio)) * 35);
}
