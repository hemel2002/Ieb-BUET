import { NextResponse, type NextRequest } from "next/server";

// Convenience redirect only: it checks that a session cookie exists. The real
// authorization check (valid, unexpired session + role) runs on the server in every
// admin page and Server Action via requireAdmin().
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();
  if (!request.cookies.has("ieb_admin_session")) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
