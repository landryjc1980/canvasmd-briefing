// POST /api/brief-invite   { code, email, name? }
// Colleague redeems a share link: validate the invite, create/attach them as a contact with
// source=invite + invited_by=the sharer, drop a session cookie, and let them straight in.
// Capturing their email here is what turns a forward into a known, attributed reader.

import { NextRequest, NextResponse } from "next/server";
import { attachSession } from "@/lib/gateServer";
import { getInvite, bumpInviteUse, upsertContact, findContactByEmail, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const code = String(body?.code ?? "").trim();
  const email = String(body?.email ?? "").trim().toLowerCase();
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : null;
  if (!code) return NextResponse.json({ ok: false, error: "Missing invite code." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ ok: false, error: "Enter a valid work email." }, { status: 400 });

  const invite = await getInvite(code).catch(() => null);
  const expired = invite?.expires_at && Date.now() > new Date(invite.expires_at).getTime();
  if (!invite || expired || invite.uses >= invite.max_uses) {
    return NextResponse.json({ ok: false, error: "This invite has expired or been used up." }, { status: 410 });
  }

  // Existing contact keeps their identity/source; a brand-new one is attributed to the sharer.
  const existing = await findContactByEmail(email).catch(() => null);
  const contact = existing
    ? existing
    : await upsertContact({ email, name, orgId: invite.org_id, source: "invite", invitedBy: invite.inviter_id, status: "active" });

  await bumpInviteUse(invite.id, invite.uses).catch(() => {});
  await logEvent({ contactId: contact.id, kind: "invite_redeemed", meta: { code, inviter: invite.inviter_id, alreadyKnown: !!existing } }).catch(() => {});

  const res = NextResponse.json({ ok: true });
  await attachSession(res, contact.id);
  return res;
}
