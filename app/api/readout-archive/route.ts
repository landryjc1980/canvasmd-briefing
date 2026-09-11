// GET /api/readout-archive — the 06:00 ET canonical rollover only.
// Share-card breadth/archive retention runs independently in readout-maintenance.

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { archiveCurrentReadoutEdition, rebuildCurrentReadoutEdition } from "@/lib/readoutEditionArchive";
import { READOUT_WINDOW_CACHE_TAG, warmReadoutWindow } from "@/lib/readoutWindowServer";
import { etEditionHour } from "@/app/briefing-preview/readoutRequest";
import { readoutTriggerKind, startReadoutPipelineJob } from "@/lib/readoutPipelineJob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const repair = req.nextUrl.searchParams.get("repair") === "1";
  const shouldRollover = repair || etEditionHour(new Date()) === 6;
  let job;
  try {
    job = await startReadoutPipelineJob("readout-archive", readoutTriggerKind(req, repair), { details: { repair } });
    const edition = await job.stage("canonical-edition", async (signal) => {
      if (signal.aborted) throw new Error("Canonical rollover aborted before edition work.");
      const result = repair ? await rebuildCurrentReadoutEdition(new Date(), signal) : await archiveCurrentReadoutEdition(new Date(), signal);
      if (signal.aborted) throw new Error("Canonical rollover aborted after edition work.");
      return result;
    }, { details: { repair }, deadlineMs: 200_000 });
    let verified = null;
    if (shouldRollover) {
      verified = await job.stage("verify-all-today-reader", async (signal) => {
        if (signal.aborted) throw new Error("Readout rollover verification aborted before cache invalidation.");
        revalidateTag(READOUT_WINDOW_CACHE_TAG);
        const result = await warmReadoutWindow("All", "today", { freshSource: true, canonicalOnly: true, signal });
        // Evidence refresh is the independent cache job. This bounded check
        // proves the published date/version even when live evidence is stale.
        if (result.editionDate !== edition.editionDate ||
          !edition.selectionVersion || result.selectionVersion !== edition.selectionVersion) {
          throw new Error("All/today reader verification did not match the canonical rollover edition.");
        }
        return result;
      }, { deadlineMs: 45_000 });
    }
    if (!shouldRollover) await job.skip({ edition, reason: "outside-6am-et" });
    else await job.succeed({ edition, verified });
    return NextResponse.json({ ok: true, edition, verified, skipped: shouldRollover ? null : "outside-6am-et" });
  } catch (error: any) {
    try { await job?.fail(error, { repair }); } catch (loggingError) { console.error("Readout archive failure could not be logged.", loggingError); }
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout archive failed." }, { status: 500 });
  }
}
