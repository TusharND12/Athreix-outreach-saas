import { apiRoute } from "@/lib/server/api";
import { requireContext } from "@/server/auth-context";
import { getSearch } from "@/server/search-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const encoder = new TextEncoder();

function event(name: string, value: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(value)}\n\n`);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return apiRoute(async () => {
    const context = await requireContext("VIEWER");
    const { id } = await params;
    const initial = await getSearch(context, id);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          controller.close();
        };
        request.signal.addEventListener("abort", close, { once: true });
        void (async () => {
          let snapshot = initial;
          for (let index = 0; index < 240 && !closed; index += 1) {
            controller.enqueue(event("progress", snapshot));
            const status = (
              snapshot.job?.status ??
              snapshot.search.status ??
              "RUNNING"
            ).toUpperCase();
            if (
              ["COMPLETE", "PARTIAL", "FAILED", "CANCELLED"].includes(status)
            ) {
              controller.enqueue(event("complete", { status }));
              close();
              return;
            }
            await new Promise((resolve) => setTimeout(resolve, 1_250));
            if (!closed) snapshot = await getSearch(context, id);
          }
          close();
        })().catch((error) => {
          if (closed) return;
          controller.enqueue(
            event("failure", {
              message:
                error instanceof Error
                  ? error.message
                  : "Research progress stream failed.",
            }),
          );
          close();
        });
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  });
}
