import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Some fields need attention.",
          fields: error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (process.env.NODE_ENV !== "test")
    console.error("Unhandled API error", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The request could not be completed.",
      },
    },
    { status: 500 },
  );
}

export async function readJson(
  request: Request,
  maxBytes = 1024 * 1024,
): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new AppError(
      "PAYLOAD_TOO_LARGE",
      "The request body is too large.",
      413,
    );
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "The request body is too large.",
        413,
      );
    }
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (contentLength > maxBytes) {
      throw new AppError(
        "PAYLOAD_TOO_LARGE",
        "The request body is too large.",
        413,
      );
    }
    throw new AppError(
      "INVALID_JSON",
      "The request body must be valid JSON.",
      400,
    );
  }
}
