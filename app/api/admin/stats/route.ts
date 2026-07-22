// GET /api/admin/stats   (admin)  -> { stats, prev, prevDay }
//
// Database-stats dashboard feed. One SQL call (admin_db_stats, migration 0203)
// computes everything; dbStats() also upserts today's admin_stats_daily row and
// returns the previous day's snapshot so the UI can render day-over-day deltas.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/gateServer";
import { dbStats } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const d = await dbStats();
    return NextResponse.json({ ok: true, ...d });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) }, { status: 500 });
  }
}
