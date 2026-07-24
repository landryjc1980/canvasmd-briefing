// GET  /api/brief-prefs           (authed) -> { defaultArea }  — the reader's saved primary
// POST /api/brief-prefs { area }   (authed) -> { ok }           — set/change it
//
// The primary specialty lives on the CONTACT record (server-side), so it follows the user across
// every device they sign into — not just the browser it was set in. The client's localStorage is
// only an instant-paint cache; this route is the source of truth.

import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";
import { getContact, setDefaultArea, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

const AREAS = new Set(["All", "GU", "Breast", "Lung", "GI", "Heme", "Gyn"]);

export async function GET(req: NextRequest) {
  const contactId = await currentContactId(req);
  if (!contactId) return NextResponse.json({ defaultArea: null });
  const c = await getContact(contactId).catch(() => null);
  const area = c?.default_area && AREAS.has(c.default_area) ? c.default_area : null;
  return NextResponse.json({ defaultArea: area });
}

export async function POST(req: NextRequest) {
  const contactId = await currentContactId(req);
  if (!contactId) return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const area = typeof body?.area === "string" ? body.area : "";
  if (!AREAS.has(area)) return NextResponse.json({ ok: false, error: "invalid area" }, { status: 400 });
  await setDefaultArea(contactId, area);
  await logEvent({ contactId, kind: "set_default_area", area }).catch(() => {}); // best-effort signal
  return NextResponse.json({ ok: true });
}
