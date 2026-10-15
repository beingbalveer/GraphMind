import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sanitizeRedirectPath } from "@/lib/urls";

/** Approved public paths accessible to unauthenticated guests without session tokens */
const PUBLIC_PREFIXES = [
  "/login",
  "/learn",
  "/studio-preview",
  "/dashboard-preview",
  "/font-comparison",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search, searchParams } = request.nextUrl;

  const accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const isAuthenticated = Boolean(accessToken || refreshToken);

  // If user is accessing /login while already authenticated, redirect to next (sanitized) or home
  if (pathname === "/login") {
    if (isAuthenticated) {
      const rawNext = searchParams.get("next");
      const target = sanitizeRedirectPath(rawNext, "/");
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // Allow unauthenticated guests on approved public routes
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Protect all private pages (workspaces, settings, collection, root dashboard)
  if (!isAuthenticated) {
    const rawNext = `${pathname}${search}`;
    const safeNext = sanitizeRedirectPath(rawNext, "");
    const loginUrl = new URL("/login", request.url);
    if (safeNext && safeNext !== "/") {
      loginUrl.searchParams.set("next", safeNext);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api/ (FastAPI proxy rewrites)
     * - _next/static (static assets)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public static files (svg, png, jpg, jpeg, gif, webp)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
