// Brief Gate — the wall. An unauthenticated request for the brief is rewritten to the
// email-capture welcome page; a valid session cookie passes through. Everything the gate
// itself needs (auth consume, capture, invite redeem, admin, static, API) is allowlisted.
//
// Edge runtime: it verifies the session with the same Web-Crypto code the Node routes use.

import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE, SESSION_MAX_AGE, RETURNING_COOKIE, returningCookieOpts,
  SESSION_RENEW_AFTER_SECS, readSessionExpiry, mintSession,
} from "./lib/gate";
import { activeContactId } from "./lib/gateServer";

// "/r/" = the public per-post "article" pages (+ their opengraph-image). Trailing slash so it
// only ever matches /r/<slug>, never some future /readout-style path. These pages render a
// public teaser + email capture themselves and gate their own full content — see app/r/.
const PUBLIC_PREFIXES = ["/api", "/welcome", "/i/", "/admin", "/_next", "/favicon", "/r/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isSharePage = pathname === "/r" || pathname.startsWith("/r/");
  if (process.env.NODE_ENV !== "production" && pathname.startsWith("/design-lab")) {
    return NextResponse.next();
  }
  if (!isSharePage && PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

  const sess = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await readSessionExpiry(sess);
  const contactId = session ? await activeContactId(session.contactId) : null;
  // Share pages stay public, but a signed cookie only unlocks member evidence while its contact
  // is still active. Clear a revoked token here; the page repeats the status check before render.
  if (isSharePage && !(session && contactId)) {
    const res = NextResponse.next();
    if (session && !contactId) {
      res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    }
    return res;
  }
  if (session && contactId) {
    const res = NextResponse.next();
    // SLIDING WINDOW: a session was minted once and never renewed, so a reader who opened the
    // brief every week was still hard-logged-out on day 90. Past the halfway mark, re-issue on
    // the way through — reading keeps you signed in; 90 days away still lapses you.
    const remaining = session.exp - Math.floor(Date.now() / 1000);
    if (remaining < SESSION_RENEW_AFTER_SECS) {
      res.cookies.set(SESSION_COOKIE, await mintSession(contactId), {
        httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
      });
    }
    // Outlives the session, so a lapse is still recognisable as a RETURN (see below). Set
    // unconditionally rather than only-when-missing: a "set it once" guard would strand any
    // browser holding a copy with stale attributes, and it re-slides the 2-year window for
    // readers who never lapse.
    res.cookies.set(RETURNING_COOKIE, "1", returningCookieOpts);
    return res;
  }

  // No valid identity → show the capture wall, preserving the requested area as a hint.
  // A returning member whose session lapsed is NOT a cold visitor. The session cookie itself
  // can't prove that — it expires at the same instant its token does, so on an ordinary lapse
  // nothing is sent and every loyal reader was greeted as a stranger. The long-lived returning
  // marker is what makes the friendly "your sign-in expired, here's a fresh link" copy reachable.
  const url = req.nextUrl.clone();
  url.pathname = "/welcome";
  const area = req.nextUrl.searchParams.get("area");
  const params = new URLSearchParams();
  if (area) params.set("area", area);
  if (sess || req.cookies.get(RETURNING_COOKIE)) params.set("expired", "1");
  url.search = params.toString() ? `?${params.toString()}` : "";
  const res = NextResponse.rewrite(url);
  // A valid signature belonging to a now-inactive contact is revoked immediately. Clearing the
  // cookie avoids repeating the status lookup and prevents an old token from being renewed later.
  if (session && !contactId) {
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
