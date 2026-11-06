import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./lib/token";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (pathname.startsWith("/_next") || pathname === "/favicon.ico") return true;
  return false;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Same-origin check for writes: a browser POST/PATCH/DELETE to the API must come from this site.
  // Requests with no Origin header (not a browser) fall through to the normal session checks.
  if (pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      let sameOrigin = false;
      try {
        sameOrigin = new URL(origin).host === (req.headers.get("host") ?? req.nextUrl.host);
      } catch {
        sameOrigin = false;
      }
      if (!sameOrigin) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }
  }

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const coachOnly = pathname.startsWith("/coach") || pathname.startsWith("/api/coach");
  if (coachOnly && session.role !== "COACH") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Coach access only." }, { status: 403 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
