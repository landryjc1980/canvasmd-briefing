import { NextRequest, NextResponse } from "next/server";
import { prepublishCurrentReadoutEdition } from "@/lib/readoutEditionArchive";
import { readoutTriggerKind, startReadoutPipelineJob } from "@/lib/readoutPipelineJob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Service-only preparation for Oncology Mornings. It deliberately does not warm
// or write the public finished-window cache: the reader remains on yesterday's
// edition until the existing 06:00 ET archive route rolls over.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  let job;
  try {
    job = await startReadoutPipelineJob("readout-prearchive", readoutTriggerKind(req));
    const prepublication = await job.stage("prepublish-canonical", async (signal) => { if (signal.aborted) throw new Error("Prepublication aborted before canonical work."); const result = await prepublishCurrentReadoutEdition(new Date(), signal); if (signal.aborted) throw new Error("Prepublication aborted after canonical work."); return result; });
    await job.succeed({ prepublication });
    return NextResponse.json({ ok: true, prepublication });
  } catch (error: any) {
    try { await job?.fail(error); } catch (loggingError) { console.error("Readout prearchive failure could not be logged.", loggingError); }
    return NextResponse.json({ ok: false, error: error?.message ?? "Readout prepublication failed." }, { status: 500 });
  }
}
