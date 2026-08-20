// GET /api/readout-archive — Vercel cron. Keeps shared /r/<slug> links alive for 30 days.
//
// briefing_snapshots holds ONE row per area, so a hero card (and every link shared to it) dies the
// moment a rebuild rotates it out. This sweep archives every card that is currently live, then
// prunes anything not seen for RETENTION_DAYS. /r pages also archive-on-resolve, which covers cards
// people actually share between sweeps; this gives breadth so a link works even if nobody visited
// it while it was live.
//
// Auth: the CRON_SECRET bearer Vercel attaches (same contract as /api/daily-send).

import { NextRequest, NextResponse } from "next/server";
import { archiveAllLive, pruneArchive, RETENTION_DAYS } from "@/app/heroPost";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const archived = await archiveAllLive();
  const pruned = await pruneArchive();
  return NextResponse.json({ ok: true, archived, pruned, retentionDays: RETENTION_DAYS });
}
