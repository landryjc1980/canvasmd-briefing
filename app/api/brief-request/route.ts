// POST /api/brief-request   { email, area? }
// The capture wall submits here. Known contact → email them a fresh magic link. Unknown →
// create a `self` lead, flag it if the domain is new (a sales signal: someone at an account
// we're not selling yet found the brief), then email them in. Always respond generically so
// the endpoint can't be used to probe who is on the list.

import { NextRequest, NextResponse } from "next/server";
import { mintMagicToken, mintUnsubToken } from "@/lib/gate";
import { siteUrl, areaLabel } from "@/lib/gateServer";
import { findContactByEmail, upsertContact, logEvent } from "@/lib/db";
import { sendMagicLink } from "@/lib/mail";

export const dynamic = "force-dynamic";

const FREEMAIL = new Set(["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"]);
// Same reply whether we sent a link OR logged a request — so the form can't be used to probe
// who's already approved.
const generic = () => NextResponse.json({ ok: true, message: "Thanks — if your email is approved, your sign-in link is on its way. If not, we’ve received your request to join and will be in touch." });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const area = typeof body?.area === "string" ? body.area : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid work email." }, { status: 400 });
  }

  const domain = email.split("@")[1];
  const contact = await findContactByEmail(email).catch(() => null);

  // ACCESS MODEL — this public form is NOT self-serve. You're in ONLY if we ADDED you (admin/CSV,
  // status=active) or you came via a colleague's SHARE link (brief-invite, source=invite). Any
  // unknown/unapproved email becomes an access REQUEST: recorded for the admin queue, given NO
  // sign-in link, and shown the same generic reply as an approved user (no membership leak).
  if (!contact || contact.status !== "active") {
    if (!contact) {
      const pending = await upsertContact({ email, source: "request", status: "requested", defaultArea: area });
      await logEvent({ contactId: pending.id, kind: "access_request", area, meta: { domain, newDomain: !FREEMAIL.has(domain), source: "welcome" } }).catch(() => {});
    } else if (contact.status === "requested") {
      await logEvent({ contactId: contact.id, kind: "access_request", area, meta: { domain, repeat: true } }).catch(() => {});
    }
    return generic(); // requested / blocked / unsubscribed → no link
  }

  // APPROVED (active) contact → email a fresh sign-in link. Personalize only to the area they were
  // actively viewing (URL `area`), else the neutral "oncology" — never fall back to default_area
  // (seed/URL-derived, not a deliberate specialty choice).
  const base = siteUrl(req);
  const token = await mintMagicToken(contact.id);
  const link = `${base}/api/brief-auth?t=${token}${area ? `&area=${encodeURIComponent(area)}` : ""}`;
  const unsubUrl = `${base}/api/brief-unsub?c=${await mintUnsubToken(contact.id)}`;
  await sendMagicLink({ email, name: contact.name, link, unsubUrl, areaLabel: areaLabel(area) }).catch(() => {});

  return generic();
}
