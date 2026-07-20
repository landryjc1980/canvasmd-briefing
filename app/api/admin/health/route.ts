// GET /api/admin/health   (admin)  -> { freshness[], backlogs[], cronFailures[], lastRun }
//
// Data-health panel for the admin console. Reads the SAME two probes the daily
// pipeline-health email uses, so the page and the alert can never disagree:
//   pipeline_health_snapshot()  — freshness: "did each stage produce output recently?"
//   pipeline_backlog_snapshot() — completeness: "is unprocessed work piling up?"
// The second exists because freshness alone is blind to a stage that still writes
// rows but writes them unfinished — how the 2026-07-20 embedding outage stayed
// green for days while 13% of the transcript corpus sat unembedded.

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/gateServer";
import { freshnessSnapshot, backlogSnapshot, lastHealthRun } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  // Settled, not all-or-nothing: a health dashboard that renders NOTHING because one
  // probe failed is worse than one that renders what it has and names what's missing.
  const [f, b, r] = await Promise.allSettled([freshnessSnapshot(), backlogSnapshot(), lastHealthRun()]);

  const errors: string[] = [];
  if (f.status === "rejected") errors.push(`freshness: ${String(f.reason).slice(0, 200)}`);
  if (b.status === "rejected") errors.push(`backlog: ${String(b.reason).slice(0, 200)}`);

  return NextResponse.json({
    ok: true,
    freshness: f.status === "fulfilled" ? f.value.checks : [],
    cronFailures: f.status === "fulfilled" ? f.value.cron_failures : [],
    backlogs: b.status === "fulfilled" ? b.value : [],
    lastRun: r.status === "fulfilled" ? r.value : null,
    errors,
  });
}
