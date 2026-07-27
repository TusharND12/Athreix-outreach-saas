export default function ProductLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading workspace">
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded-lg bg-zinc-200 motion-reduce:animate-none dark:bg-zinc-800" />
        <div className="h-4 w-[32rem] max-w-full animate-pulse rounded-full bg-zinc-100 motion-reduce:animate-none dark:bg-zinc-900" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-200 shadow-[0_16px_50px_oklch(0.17_0.03_272/0.07)] sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse bg-white p-5 motion-reduce:animate-none dark:bg-zinc-950"
          >
            <div className="h-3 w-24 rounded-full bg-zinc-100 dark:bg-zinc-900" />
            <div className="mt-4 h-7 w-16 rounded-md bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50 shadow-[0_16px_50px_oklch(0.17_0.03_272/0.07)] motion-reduce:animate-none dark:border-zinc-800 dark:bg-zinc-900" />
      <span className="sr-only">Loading Athreix workspace</span>
    </div>
  );
}
