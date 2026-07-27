import type { NextRequest } from "next/server";
import { hashIdentifier } from "@/lib/server/crypto";

export function requestMetadata(request: Request | NextRequest) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const ip = forwarded ?? request.headers.get("x-real-ip") ?? "unknown";
  return {
    ipHash: hashIdentifier(ip),
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? undefined,
  };
}
