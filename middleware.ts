// Brief Gate — the wall. An unauthenticated request for the brief is rewritten to the
// email-capture welcome page; a valid session cookie passes through. Everything the gate
// itself needs (auth consume, capture, invite redeem, admin, static, API) is allowlisted.
//
// Edge runtime: it verifies the session with the same Web-Crypto code the Node routes use.

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, readSession } from "./lib/gate";

const PUBLIC_PREFIXES = ["/api", "/welcome", "/i/", "/admin", "/_next", "/favicon"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

  const contactId = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (contactId) return NextResponse.next();

  // No identity → show the capture wall, preserving the requested area as a hint.
  const url = req.nextUrl.clone();
  url.pathname = "/welcome";
  const area = req.nextUrl.searchParams.get("area");
  url.search = area ? `?area=${encodeURIComponent(area)}` : "";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
