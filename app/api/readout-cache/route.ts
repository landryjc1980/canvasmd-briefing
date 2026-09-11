import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { mergeCurrentReadoutEditionInsertions } from "@/lib/readoutEditionArchive";
import { READOUT_WINDOW_CACHE_TAG, warmReadoutWindowCache } from "@/lib/readoutWindowServer";
import { readoutTriggerKind, startReadoutPipelineJob } from "@/lib/readoutPipelineJob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function assertCompleteWarm(warmed: Awaited<ReturnType<typeof warmReadoutWindowCache>>) {
  if (warmed.length !== 16 || warmed.some((row) => row.error || row.stale)) {
    throw new Error("Readout cache warm was incomplete or stale.");
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const refreshOnly = req.nextUrl.searchParams.get("refreshOnly") === "1";
  let job;
  try {
    job = await startReadoutPipelineJob("readout-cache", readoutTriggerKind(req, refreshOnly), { details: { refreshOnly } });
    const warmed = await job.stage("warm-finished-windows", async (signal) => {
      if (signal.aborted) throw new Error("Readout cache warm aborted before invalidation.");
      revalidateTag(READOUT_WINDOW_CACHE_TAG);
      const result = await warmReadoutWindowCache(refreshOnly ? { freshSource: true, signal } : { signal });
      assertCompleteWarm(result);
      return result;
    }, { details: { refreshOnly, expectedWindows: 16 } });
    const edition = refreshOnly
      ? { changed: false, skipped: "cache-refresh-only" }
      : await job.stage("merge-insertions", (signal) => mergeCurrentReadoutEditionInsertions(new Date(), signal));
    let finalWarmed = warmed;
    if (edition.changed) {
      finalWarmed = await job.stage("rewarm-after-insertions", async (signal) => {
        if (signal.aborted) throw new Error("Readout cache rewarm aborted before invalidation.");
        revalidateTag(READOUT_WINDOW_CACHE_TAG);
        const result = await warmReadoutWindowCache({ signal });
        assertCompleteWarm(result);
        return result;
      }, { details: { expectedWindows: 16 } });
    }
    await job.succeed({ refreshedAt: new Date().toISOString(), warmed: finalWarmed.length, edition });
    return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString(), warmed: finalWarmed, edition });
  } catch (error: any) {
    try { await job?.fail(error, { refreshOnly }); } catch (loggingError) { console.error("Readout cache failure could not be logged.", loggingError); }
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout cache refresh failed." }, { status: 500 });
  }
}
