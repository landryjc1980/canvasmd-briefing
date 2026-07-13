// GET /api/brief-auth?t=<magic token>[&area=GU]
// The email link lands here: verify the token, drop a session cookie, and 302 to the brief
// with the token stripped from the URL. This is the "click from Outlook → you're in" step.

import { NextRequest, NextResponse } from "next/server";
import { readMagicToken } from "@/lib/gate";
import { attachSession, siteUrl } from "@/lib/gateServer";
import { getContact, touchLastSeen, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const contactId = await readMagicToken(token);
  const base = siteUrl(req);

  if (!contactId) {
    // bad / expired link → send them to the capture wall to request a fresh one
    return NextResponse.redirect(`${base}/welcome?expired=1`);
  }
  const contact = await getContact(contactId).catch(() => null);
  if (!contact || contact.status === "blocked" || contact.status === "unsubscribed") {
    return NextResponse.redirect(`${base}/welcome?expired=1`);
  }

  const area = req.nextUrl.searchParams.get("area") || contact.default_area || "";
  const dest = area ? `${base}/?area=${encodeURIComponent(area)}` : `${base}/`;
  const res = NextResponse.redirect(dest);
  await attachSession(res, contact.id);
  // fire-and-forget signal; never block the redirect on logging
  Promise.allSettled([touchLastSeen(contact.id), logEvent({ contactId: contact.id, kind: "link_click", area: area || null })]);
  return res;
}
