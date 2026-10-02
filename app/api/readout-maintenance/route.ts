// GET /api/readout-maintenance — bounded share-card retention, isolated from canonical rollover.
// The breadth copy of specialty-build cards into readout_posts ended with the specialty build;
// the Readout selects from the hourly paper list, so this job only expires old share cards.

import { NextRequest, NextResponse } from "next/server";
import { pruneArchive, RETENTION_DAYS } from "@/app/heroPost";
import { readoutTriggerKind, startReadoutPipelineJob } from "@/lib/readoutPipelineJob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let job;
  try {
    job = await startReadoutPipelineJob("readout-maintenance", readoutTriggerKind(req));
    const pruned = await job.stage("prune-expired-cards", async (signal) => { if (signal.aborted) throw new Error("Maintenance prune aborted before work."); const result = await pruneArchive(); if (signal.aborted) throw new Error("Maintenance prune aborted after work."); return result; }, { details: { retentionDays: RETENTION_DAYS } });
    await job.succeed({ pruned, retentionDays: RETENTION_DAYS });
    return NextResponse.json({ ok: true, pruned, retentionDays: RETENTION_DAYS });
  } catch (error: any) {
    try { await job?.fail(error); } catch (loggingError) { console.error("Readout maintenance failure could not be logged.", loggingError); }
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout maintenance failed." }, { status: 500 });
  }
}
