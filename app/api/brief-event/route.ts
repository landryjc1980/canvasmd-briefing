// POST /api/brief-event   { kind, area?, storyId? }   (authed)
// Client-side signal capture from inside the brief: view, story_view, dwell. Silently no-ops
// when there's no session so it can be called unconditionally from the UI.

import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";
import { logEvent, touchLastSeen } from "@/lib/db";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["view", "story_view", "dwell"]);

export async function POST(req: NextRequest) {
  const contactId = await currentContactId(req);
  if (!contactId) return NextResponse.json({ ok: true }); // not signed in → nothing to log

  const body = await req.json().catch(() => ({} as any));
  const kind = String(body?.kind ?? "");
  if (!ALLOWED.has(kind)) return NextResponse.json({ ok: false }, { status: 400 });

  await logEvent({
    contactId,
    kind,
    area: typeof body?.area === "string" ? body.area : null,
    storyId: typeof body?.storyId === "string" ? body.storyId : null,
    meta: body?.meta ?? null,
  }).catch(() => {});
  if (kind === "view") touchLastSeen(contactId).catch(() => {});
  return NextResponse.json({ ok: true });
}
