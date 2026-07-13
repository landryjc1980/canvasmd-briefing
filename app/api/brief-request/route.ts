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
const generic = () => NextResponse.json({ ok: true, message: "If your address is eligible, the brief is on its way to your inbox." });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const area = typeof body?.area === "string" ? body.area : null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Enter a valid work email." }, { status: 400 });
  }

  const domain = email.split("@")[1];
  let contact = await findContactByEmail(email).catch(() => null);
  const isNew = !contact;

  if (!contact) {
    contact = await upsertContact({ email, source: "self", status: "active", defaultArea: area });
    // new-domain sales alert (only for real corporate domains, not freemail)
    await logEvent({
      contactId: contact.id,
      kind: "capture",
      area,
      meta: { domain, newDomain: !FREEMAIL.has(domain), source: "welcome" },
    }).catch(() => {});
  }
  if (contact.status === "blocked") return generic();

  const base = siteUrl(req);
  const token = await mintMagicToken(contact.id);
  const link = `${base}/api/brief-auth?t=${token}${area ? `&area=${encodeURIComponent(area)}` : ""}`;
  const unsubUrl = `${base}/api/brief-unsub?c=${await mintUnsubToken(contact.id)}`;
  await sendMagicLink({ email, name: contact.name, link, unsubUrl, areaLabel: areaLabel(area || contact.default_area) }).catch(() => {});

  return generic();
}
