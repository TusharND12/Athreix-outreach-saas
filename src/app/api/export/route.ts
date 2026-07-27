import { apiRoute } from "@/lib/server/api";
import { AppError, readJson } from "@/lib/server/errors";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { requireContext } from "@/server/auth-context";
import { exportSchema } from "@/server/schemas";
import { createExport } from "@/server/export-service";

export async function POST(request: Request) {
  return apiRoute(async () => {
    const context = await requireContext("MEMBER");
    await enforceRateLimit(
      `export:${context.workspaceId}:${context.userId}`,
      10,
      60,
    );
    const input = exportSchema.parse(await readJson(request));
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
    const result = await createExport(context, input, idempotencyKey);
    return new Response(new Uint8Array(result.file), {
      status: 200,
      headers: {
        "content-type": result.mimeType,
        "content-disposition": `attachment; filename="${result.filename}"`,
        "content-length": String(result.file.byteLength),
        "x-athreix-export-id": result.id,
        "x-athreix-record-count": String(result.rows),
        "x-athreix-export-retained": String(result.retained),
        "cache-control": "private, no-store",
      },
    });
  });
}
