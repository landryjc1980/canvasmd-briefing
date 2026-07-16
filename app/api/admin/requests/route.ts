// GET  /api/admin/requests            (admin) -> { requests: [...] }  the access-request queue
// POST /api/admin/requests { id, action } (admin) -> approve | decline a request
//   approve → status=active + email the person their sign-in link (they can now get in)
//   decline → status=blocked (silent; they won't get a link and can't retry into the queue)

import { NextRequest, NextResponse } from "next/server";
import { isAdmin, siteUrl, areaLabel } from "@/lib/gateServer";
import { mintMagicToken, mintUnsubToken } from "@/lib/gate";
import { sendMagicLink } from "@/lib/mail";
import { listRequests, getContact, setContactStatus } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, requests: await listRequests() });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({} as any));
  const id = String(body?.id ?? "");
  const action = String(body?.action ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "Missing id." }, { status: 400 });

  if (action === "decline") {
    await setContactStatus(id, "blocked");
    return NextResponse.json({ ok: true });
  }
  if (action === "approve") {
    await setContactStatus(id, "active");
    const c = await getContact(id).catch(() => null);
    if (c) {
      const base = siteUrl(req);
      const link = `${base}/api/brief-auth?t=${await mintMagicToken(c.id)}`;
      const unsubUrl = `${base}/api/brief-unsub?c=${await mintUnsubToken(c.id)}`;
      await sendMagicLink({ email: c.email, name: c.name, link, unsubUrl, areaLabel: areaLabel(c.default_area) }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
