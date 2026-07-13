// POST /api/brief-share   (authed reader)  ->  { url, code }
// Reader taps "share with a colleague": mint a stateful invite tied to them + their org, so
// the colleague who redeems it becomes a new contact with invited_by = this reader. That edge
// is the referral graph — logo penetration you can hand to sales.

import { NextRequest, NextResponse } from "next/server";
import { currentContactId, siteUrl } from "@/lib/gateServer";
import { getContact, createInvite, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

// short, unambiguous code (no 0/O/1/I)
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
function makeCode(len = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = "";
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

export async function POST(req: NextRequest) {
  const contactId = await currentContactId(req);
  if (!contactId) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const me = await getContact(contactId).catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });

  const code = makeCode();
  await createInvite(me.id, me.org_id, code);
  await logEvent({ contactId: me.id, kind: "share", meta: { code } }).catch(() => {});

  return NextResponse.json({ ok: true, code, url: `${siteUrl(req)}/i/${code}` });
}
