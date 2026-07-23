// GET /api/admin/stats   (admin)  -> { stats, prev, prevDay }
//
// Database-stats dashboard feed. One SQL call (admin_db_stats, migration 0203)
// computes everything; dbStats() also upserts today's admin_stats_daily row and
// returns the previous day's snapshot so the UI can render day-over-day deltas.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/gateServer";
import { dbStats, trendingX, xActivity7d, statsHistory, amplifiedX } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  // Settled, not all-or-nothing: the snapshot stats are the core; the X lists are
  // additive panels that shouldn't blank the whole dashboard if one probe fails.
  const [d, t, a, rt, qt] = await Promise.allSettled([
    dbStats(), trendingX(15), xActivity7d(15), amplifiedX(30, 15, "rt"), amplifiedX(30, 15, "quote"),
  ]);
  if (d.status === "rejected") return NextResponse.json({ ok: false, error: String(d.reason).slice(0, 300) }, { status: 500 });
  // History AFTER dbStats: dbStats upserts today's snapshot, so reading history
  // sequentially guarantees the sparkline's last point is this very refresh.
  const h = await Promise.allSettled([statsHistory()]).then(([r]) => r);
  return NextResponse.json({
    ok: true,
    ...d.value,
    trending: t.status === "fulfilled" ? t.value : [],
    activity: a.status === "fulfilled" ? a.value : [],
    topRetweeted: rt.status === "fulfilled" ? rt.value : [],
    topQuoted: qt.status === "fulfilled" ? qt.value : [],
    history: h.status === "fulfilled" ? h.value : [],
  });
}
