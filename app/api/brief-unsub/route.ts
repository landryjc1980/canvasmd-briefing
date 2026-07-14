// Unsubscribe. GET ?c=<unsub token> shows a confirmation; the one-click List-Unsubscribe POST
// (and the button) flips the contact to status=unsubscribed so send routes skip them.

import { NextRequest, NextResponse } from "next/server";
import { readUnsubToken } from "@/lib/gate";
import { upsertContact, getContact, logEvent } from "@/lib/db";

export const dynamic = "force-dynamic";

async function doUnsub(token: string | null): Promise<boolean> {
  const contactId = await readUnsubToken(token);
  if (!contactId) return false;
  const c = await getContact(contactId).catch(() => null);
  if (!c) return false;
  await upsertContact({ email: c.email, status: "unsubscribed" });
  await logEvent({ contactId: c.id, kind: "unsubscribe" }).catch(() => {});
  return true;
}

// one-click List-Unsubscribe-Post
export async function POST(req: NextRequest) {
  const ok = await doUnsub(req.nextUrl.searchParams.get("c"));
  return NextResponse.json({ ok });
}

export async function GET(req: NextRequest) {
  const ok = await doUnsub(req.nextUrl.searchParams.get("c"));
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;background:#0e1524;color:#e9edf6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px">
  <div><div style="line-height:1.05"><div style="font-family:Georgia,serif;font-weight:bold;font-size:22px;color:#fff">The Readout</div><div style="font-size:9px;font-weight:bold;letter-spacing:.16em;text-transform:uppercase;color:#9aa6c0;margin-top:4px">by CanvasMD</div></div>
  <p style="color:#cfd6e6;font-size:15px;margin-top:18px">${ok ? "You've been unsubscribed from the Weekly Brief. You won't receive further emails." : "This unsubscribe link is invalid or has expired."}</p></div></body>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
