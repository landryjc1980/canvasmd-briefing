// POST /api/admin/send   (admin)   { orgId?, test? }
// Send the personalized magic-link brief to the active send list (optionally one org, or a
// single test address). Each recipient gets their own token + area. Logs email_sent per send.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin, siteUrl, areaLabel } from "@/lib/gateServer";
import { mintMagicToken, mintUnsubToken } from "@/lib/gate";
import { listContacts, findContactByEmail, logEvent, type Contact } from "@/lib/db";
import { sendMagicLink } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const base = siteUrl(req);

  let recipients: Contact[];
  if (body?.test) {
    const c = await findContactByEmail(String(body.test)).catch(() => null);
    if (!c) return NextResponse.json({ ok: false, error: "Test address not found in contacts. Upload it first." }, { status: 404 });
    recipients = [c];
  } else {
    recipients = await listContacts(body?.orgId || undefined);
  }
  recipients = recipients.filter((c) => c.status === "active");

  let sent = 0;
  const errors: string[] = [];
  for (const c of recipients) {
    const area = c.default_area || "";
    const token = await mintMagicToken(c.id);
    const link = `${base}/api/brief-auth?t=${token}${area ? `&area=${encodeURIComponent(area)}` : ""}`;
    const unsubUrl = `${base}/api/brief-unsub?c=${await mintUnsubToken(c.id)}`;
    const r = await sendMagicLink({ email: c.email, name: c.name, link, unsubUrl, areaLabel: areaLabel(area) }).catch((e) => ({ ok: false, error: String(e) }));
    if (r.ok) { sent++; await logEvent({ contactId: c.id, kind: "email_sent", area: area || null }).catch(() => {}); }
    else errors.push(`${c.email}: ${r.error}`);
  }
  return NextResponse.json({ ok: true, sent, total: recipients.length, errors: errors.slice(0, 10) });
}
