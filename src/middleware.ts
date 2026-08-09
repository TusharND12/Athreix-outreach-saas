import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import { csrfViolation } from "@/lib/server/csrf";

const protectedPrefixes = [
  "/search",
  "/results",
  "/lists",
  "/exports",
  "/usage",
  "/settings",
  "/billing",
  "/profile",
  "/admin",
];

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const customAuthMutation = [
      "/api/auth/register",
      "/api/auth/forgot-password",
      "/api/auth/reset-password",
      "/api/auth/verify-email",
      "/api/auth/resend-verification",
    ].includes(request.nextUrl.pathname);
    const authJsManaged =
      request.nextUrl.pathname.startsWith("/api/auth/") && !customAuthMutation;
    const signedInternal =
      request.nextUrl.pathname.startsWith("/api/internal/");
    const signedWebhook = request.nextUrl.pathname === "/api/billing/webhook";
    if (!authJsManaged && !signedInternal && !signedWebhook) {
      const violation = csrfViolation({
        method: request.method,
        origin: request.headers.get("origin"),
        secFetchSite: request.headers.get("sec-fetch-site"),
        requestOrigin: request.nextUrl.origin,
        configuredOrigin: process.env.NEXT_PUBLIC_APP_URL,
      });
      if (violation) {
        return NextResponse.json(
          {
            error: {
              code: "CSRF_REJECTED",
              message: violation,
            },
          },
          { status: 403 },
        );
      }
    }
    return NextResponse.next();
  }
  if (
    !protectedPrefixes.some((prefix) =>
      request.nextUrl.pathname.startsWith(prefix),
    )
  ) {
    return NextResponse.next();
  }

  const secretConfigured = Boolean(process.env.AUTH_SECRET);
  const secret =
    process.env.AUTH_SECRET ??
    "athreix-local-demo-secret-change-before-production-2026";
  const token =
    process.env.NODE_ENV === "production" && !secretConfigured
      ? null
      : await getToken({
          req: request,
          secret,
          secureCookie: request.nextUrl.protocol === "https:",
        });
  const demoEnabled =
    process.env.DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && !process.env.FIREBASE_PROJECT_ID);
  if ((token?.sub && !token.authInvalid) || demoEnabled)
    return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  if (token?.authInvalidReason === "approval") {
    loginUrl.searchParams.set("pending", "1");
  }
  loginUrl.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
