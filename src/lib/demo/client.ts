export class ApiUnavailableError extends Error {
  constructor(message = "The live service is unavailable") {
    super(message);
    this.name = "ApiUnavailableError";
  }
}

export class ApiRequestError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type ApiEnvelope<T> = { data: T; meta?: Record<string, unknown> };

export function isLocalDemoFallbackAllowed() {
  return (
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
    process.env.NEXT_PUBLIC_LIVE_DATA_ONLY !== "true"
  );
}

export async function requestOrFallback<T>(
  url: string,
  fallback: T,
  init?: RequestInit,
): Promise<{ data: T; source: "live" | "demo" }> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (error) {
    if (isLocalDemoFallbackAllowed()) return { data: fallback, source: "demo" };
    throw new ApiUnavailableError(
      error instanceof Error
        ? error.message
        : "The live service is unavailable",
    );
  }
  if (!response.ok) {
    let payload: {
      error?: { message?: string; code?: string; details?: unknown };
      message?: string;
      code?: string;
      details?: unknown;
    } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      /* Preserve the HTTP status when the server has no JSON body. */
    }
    const error = payload.error ?? payload;
    throw new ApiRequestError(
      error.message ?? `Request failed with ${response.status}`,
      response.status,
      error.code,
      error.details,
    );
  }
  try {
    return { data: (await response.json()) as T, source: "live" };
  } catch {
    throw new ApiRequestError(
      "The server returned an unreadable response.",
      response.status,
      "INVALID_RESPONSE",
    );
  }
}

export function downloadDemoFile(
  filename: string,
  content: string,
  type = "text/plain",
) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
