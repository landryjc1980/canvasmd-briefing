// Brief Gate — server helpers for cookies, current-contact access, admin auth, URLs, and labels.
// The active-contact lookup is fetch-only and is also used by edge middleware before renewal.

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, RETURNING_COOKIE, returningCookieOpts, mintSession, readSession } from "./gate";
import { getContact } from "./db";

export const ADMIN_COOKIE = "brief_admin";

// Who can reach /admin. Passwordless for now — being signed into the brief with one of these
// emails IS admin auth (add a real password/2FA later). Override/extend via BRIEF_ADMIN_EMAILS
// (comma-separated). landryjc@gmail.com is the default owner.
const ADMIN_EMAILS = new Set(
  (process.env.BRIEF_ADMIN_EMAILS ?? "landryjc@gmail.com").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
);

export const AREA_LABEL: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Heme", Gyn: "Gynecologic", Skin: "Skin cancer",
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

/** Revalidate a signed identity against the current contact row. Missing, pending, blocked, and
 * unsubscribed contacts all fail closed; a 90-day signature is never sufficient by itself. */
export async function activeContactId(contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const contact = await getContact(contactId).catch(() => null);
  return contact?.status === "active" ? contact.id : null;
}

/** The currently active signed-in contactId for this request, or null. */
export async function currentContactId(req: NextRequest): Promise<string | null> {
  const contactId = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  return activeContactId(contactId);
}

/** Set the signed session cookie on a response (called after a magic-link / invite redemption). */
export async function attachSession(res: NextResponse, contactId: string): Promise<NextResponse> {
  res.cookies.set(SESSION_COOKIE, await mintSession(contactId), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE,
  });
  // Long-lived, identity-free "been here before" marker, set at the canonical sign-in moment.
  // The session cookie expires exactly when its token does, so without this a lapsed member is
  // indistinguishable from a stranger and gets the cold invite-only wall. See middleware.ts.
  res.cookies.set(RETURNING_COOKIE, "1", returningCookieOpts);
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
    if (c?.status === "active" && ADMIN_EMAILS.has((c.email || "").toLowerCase())) return true;
  }
  const want = process.env.BRIEF_ADMIN_TOKEN;
  const given = req.headers.get("x-admin-token") || req.cookies.get(ADMIN_COOKIE)?.value || req.nextUrl.searchParams.get("key");
  return !!(want && given && given === want);
}
