// Brief Gate — Node-runtime server helpers (cookies, admin auth, URL, area labels).
// Kept separate from gate.ts (which must stay edge-safe for middleware).

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, mintSession, readSession } from "./gate";
import { getContact } from "./db";

export const ADMIN_COOKIE = "brief_admin";

// Who can reach /admin. Passwordless for now — being signed into the brief with one of these
// emails IS admin auth (add a real password/2FA later). Override/extend via BRIEF_ADMIN_EMAILS
// (comma-separated). landryjc@gmail.com is the default owner.
const ADMIN_EMAILS = new Set(
  (process.env.BRIEF_ADMIN_EMAILS ?? "landryjc@gmail.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);

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

/** Admin gate for the CSV upload / send / signal / requests routes. Admin = signed into the brief
 *  as an admin email (passwordless), OR the legacy shared token (headless/scripted fallback). */
export async function isAdmin(req: NextRequest): Promise<boolean> {
  const contactId = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (contactId) {
    const c = await getContact(contactId).catch(() => null);
    if (c && ADMIN_EMAILS.has((c.email || "").toLowerCase())) return true;
  }
  const want = process.env.BRIEF_ADMIN_TOKEN;
  const given = req.headers.get("x-admin-token") || req.cookies.get(ADMIN_COOKIE)?.value || req.nextUrl.searchParams.get("key");
  return !!(want && given && given === want);
}
