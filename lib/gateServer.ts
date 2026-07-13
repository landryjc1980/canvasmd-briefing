// Brief Gate — Node-runtime server helpers (cookies, admin auth, URL, area labels).
// Kept separate from gate.ts (which must stay edge-safe for middleware).

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, mintSession, readSession } from "./gate";

export const ADMIN_COOKIE = "brief_admin";

export const AREA_LABEL: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Heme", Gyn: "Gynecologic",
};
export const areaLabel = (a: string | null | undefined) => (a && AREA_LABEL[a]) || "oncology";

/** Absolute origin for building links in emails / redirects. */
export function siteUrl(req: NextRequest): string {
  const env = process.env.BRIEF_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3211";
  return `${proto}://${host}`;
}

/** The signed-in contactId for this request, or null. */
export function currentContactId(req: NextRequest): Promise<string | null> {
  return readSession(req.cookies.get(SESSION_COOKIE)?.value);
}

/** Set the signed session cookie on a response (called after a magic-link / invite redemption). */
export async function attachSession(res: NextResponse, contactId: string): Promise<NextResponse> {
  res.cookies.set(SESSION_COOKIE, await mintSession(contactId), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
  });
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}

/** Admin gate for the CSV upload / send / signal routes. MVP: a shared token, no user accounts. */
export function isAdmin(req: NextRequest): boolean {
  const want = process.env.BRIEF_ADMIN_TOKEN;
  if (!want) return false;
  const given = req.headers.get("x-admin-token") || req.cookies.get(ADMIN_COOKIE)?.value || req.nextUrl.searchParams.get("key");
  return !!given && given === want;
}
