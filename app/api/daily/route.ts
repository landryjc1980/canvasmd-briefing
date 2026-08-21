import { NextRequest, NextResponse } from "next/server";
import { currentContactId } from "@/lib/gateServer";

export const dynamic = "force-dynamic";

// The Daily Readout — one global edition per day, generated server-side by the
// `daily-readout` edge function (10:05 UTC cron) into the daily_readout table.
// This route serves the latest edition whose deterministic worth-showing gate
// passed, looking back at most 2 days so a quiet Monday can still show Sunday's
// edition briefly but stale editions never linger.

const URL_ = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    // currentContactId verifies both the signature and the contact's current active status.
    if (!(await currentContactId(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!URL_ || !SERVICE_KEY) return NextResponse.json({ daily: null });
  try {
    const since = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
    const res = await fetch(
      `${URL_}/rest/v1/daily_readout?select=date,lead,payload,generated_at&show=eq.true&date=gte.${since}&order=date.desc&limit=1`,
      { headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ daily: null });
    const rows = await res.json();
    return NextResponse.json({ daily: rows?.[0] ?? null });
  } catch {
    return NextResponse.json({ daily: null });
  }
}
