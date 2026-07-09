import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Thin proxy to the `briefing` Supabase edge function — the SINGLE source of the
// Weekly Briefing. The edge function computes the digest server-side and caches it
// in briefing_snapshots; the native app and this web app both just read it, so the
// intelligence is authored exactly once and can never drift between platforms.
//
// We proxy (rather than calling the edge fn from the browser) so the Supabase URL
// and publishable key stay server-side and the page keeps its existing
// fetch("/api/briefing?area=…") contract unchanged.

const AREAS = new Set(["GU", "Breast", "Lung", "GI", "Heme", "Gyn"]);

export async function GET(req: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json(
      { error: "Missing SUPABASE_URL / SUPABASE_ANON_KEY env vars." },
      { status: 500 }
    );
  }

  const raw = req.nextUrl.searchParams.get("area") ?? "GU";
  const area = AREAS.has(raw) ? raw : "GU";

  try {
    const res = await fetch(`${url}/functions/v1/briefing`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        apikey: key,
      },
      body: JSON.stringify({ area }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Briefing service returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}` },
        { status: 502 }
      );
    }

    // The edge function returns the BriefingData object directly; the page expects
    // it under `briefing`.
    const briefing = await res.json();
    return NextResponse.json({ briefing });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Failed to reach the briefing service." },
      { status: 502 }
    );
  }
}
