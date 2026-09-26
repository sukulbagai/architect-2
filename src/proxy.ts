import { NextResponse, type NextRequest } from "next/server";

const WORKSPACE_COOKIE = "architect_ws";

/**
 * Optimistic gate: app routes need a workspace cookie. The layouts do the real check against
 * the database (a stale cookie still ends up on /login), this just avoids rendering for nothing.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(WORKSPACE_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/home/:path*",
    "/projects/:path*",
    "/agents/:path*",
    "/explore/:path*",
    "/integrations/:path*",
    "/usage/:path*",
    "/settings/:path*",
    "/import/:path*",
    "/p/:path*",
    "/welcome/:path*",
  ],
};
