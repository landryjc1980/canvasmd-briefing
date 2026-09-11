// GET /api/readout-maintenance — bounded share-card retention, isolated from canonical rollover.

import { NextRequest, NextResponse } from "next/server";
import { archiveAllLive, pruneArchive, RETENTION_DAYS } from "@/app/heroPost";
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
    const archived = await job.stage("archive-live-cards", async (signal) => { if (signal.aborted) throw new Error("Maintenance archive aborted before work."); const result = await archiveAllLive(); if (signal.aborted) throw new Error("Maintenance archive aborted after work."); return result; });
    const pruned = await job.stage("prune-expired-cards", async (signal) => { if (signal.aborted) throw new Error("Maintenance prune aborted before work."); const result = await pruneArchive(); if (signal.aborted) throw new Error("Maintenance prune aborted after work."); return result; }, { details: { retentionDays: RETENTION_DAYS } });
    await job.succeed({ archived, pruned, retentionDays: RETENTION_DAYS });
    return NextResponse.json({ ok: true, archived, pruned, retentionDays: RETENTION_DAYS });
  } catch (error: any) {
    try { await job?.fail(error); } catch (loggingError) { console.error("Readout maintenance failure could not be logged.", loggingError); }
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout maintenance failed." }, { status: 500 });
  }
}
