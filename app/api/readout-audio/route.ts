import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";
import { supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";
import { readoutAudioDates } from "@/lib/readoutAudio";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production" && !(await currentContactId(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dates = readoutAudioDates((req.nextUrl.searchParams.get("dates") ?? "").split(","));
  if (!dates.length) return NextResponse.json({ editions: [] });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Audio unavailable" }, { status: 503 });
  // Use the existing ready-only reader policy, never a service-role bypass.
  const query = new URLSearchParams({
    select: "id,edition_date,selection_version,title,summary,audio_url,duration_seconds,source_generated_at,chapters",
    status: "eq.ready", edition_date: `in.(${dates.join(",")})`, order: "edition_date.desc", limit: "7",
  });
  try {
    const response = await fetch(`${url}/rest/v1/readout_audio_editions?${query}`, {
      headers: supabaseApiKeyHeaders(key), cache: "no-store",
    });
    if (!response.ok) throw new Error("Audio lookup failed");
    return NextResponse.json({ editions: await response.json() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Audio unavailable" }, { status: 502 });
  }
}
