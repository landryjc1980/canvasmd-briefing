import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";
import { supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";

export const dynamic = "force-dynamic";

// Thin proxy to the `readout-discussion` Supabase edge function: the replies under
// posts about a paper (journal posts and clinician shares), counted for everyone and
// quoted only for clinicians we can identify. The edge function applies the reply
// retention policy and the Readout's identity gate; this route only keeps the project
// key server-side and verifies the reader session, like /api/briefing.
//
// In-process memo, deliberately not a shared or CDN cache header: the route verifies
// the reader session, and a shared cache could serve one reader's response past that gate.
const DISCUSSION_TTL_MS = 60_000;
const MAX_ARTICLES = 12;
const memo = new Map<string, { at: number; body: unknown }>();

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    if (!(await currentContactId(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars." }, { status: 500 });
  }
  const body = await req.json().catch(() => ({}));
  const articleIds = Array.isArray(body?.articleIds)
    ? [...new Set((body.articleIds as unknown[]).map((id) => String(id ?? "").trim()).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].sort().slice(0, MAX_ARTICLES)
    : [];
  if (!articleIds.length) return NextResponse.json({ error: "articleIds required." }, { status: 400 });

  const upstreamBody = { articleIds };
  const cacheKey = JSON.stringify(upstreamBody);
  const hit = memo.get(cacheKey);
  if (hit && Date.now() - hit.at < DISCUSSION_TTL_MS) return NextResponse.json(hit.body);

  try {
    const res = await fetch(`${url}/functions/v1/readout-discussion`, {
      method: "POST",
      headers: { "content-type": "application/json", ...supabaseApiKeyHeaders(key) },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`readout-discussion returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
    }
    const payload = await res.json();
    memo.set(cacheKey, { at: Date.now(), body: payload });
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Failed to reach the Readout discussion." }, { status: 502 });
  }
}
