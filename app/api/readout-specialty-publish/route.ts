import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readoutTriggerKind, startReadoutPipelineJob } from "@/lib/readoutPipelineJob";
import { runSpecialtyBatch } from "@/lib/readoutSpecialtyShadow.mjs";
import { assertSpecialtyPublicationControl, specialtyPublicationCycle } from "@/lib/readoutSpecialtyPublication.mjs";
import engineInfo from "@/lib/generated/specialtyBriefingBuilder.manifest.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ error: "Specialty publication is production-only." }, { status: 409 });
  if (process.env.READOUT_SPECIALTY_PUBLISH_ENABLED !== "1") return NextResponse.json({ ok: true, skipped: "publication-not-activated", webSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null, engineSha: engineInfo.backendSha });
  if (req.nextUrl.searchParams.has("manual") || readoutTriggerKind(req) !== "scheduled") return NextResponse.json({ error: "Only scheduled specialty publication is supported." }, { status: 409 });
  const now = new Date(), cycle = specialtyPublicationCycle(now);
  if (!cycle) return NextResponse.json({ ok: true, skipped: "outside-source-build-window" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Missing service environment." }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000), cache: "no-store" }) } });
  const owner = crypto.randomUUID(), leaseName = "readout-specialty-batch";
  let owned = false;
  let job: Awaited<ReturnType<typeof startReadoutPipelineJob>> | undefined;
  try {
    const preflight = await db.rpc("readout_specialty_publication_preflight");
    if (preflight.error) throw preflight.error;
    if (preflight.data?.ready !== true) return NextResponse.json({ ok: true, skipped: preflight.data?.reason ?? "publication-not-ready" });
    assertSpecialtyPublicationControl(preflight.data.control, engineInfo);
    const lease = await db.rpc("acquire_ops_job_lease", { p_job_name: leaseName, p_lease_owner: owner, p_ttl_seconds: 330 });
    if (lease.error) throw lease.error;
    if (lease.data !== true) return NextResponse.json({ ok: true, skipped: "batch-already-running" });
    owned = true;
    // Failed attempts require operator review. Cron re-delivery must not repeat
    // paid recaps, including after a partially captured or failed source batch.
    const existing = await db.from("readout_specialty_source_runs").select("id,status,summary")
      .eq("mode", "publish").eq("source_run_id", cycle.sourceRunId).order("built_at", { ascending: false }).limit(1).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ ok: true, skipped: "cycle-already-attempted", runId: existing.data.id, status: existing.data.status, published: existing.data.summary?.published === true });
    job = await startReadoutPipelineJob("readout-specialty-publish", "scheduled", { details: { sourceRunId: cycle.sourceRunId, engineSha: engineInfo.backendSha }, deadlineMs: 275_000 });
    const summary = await runSpecialtyBatch({ url, key, engineInfo, job, sourceRunId: cycle.sourceRunId, now, mode: "publish", publicationControl: preflight.data.control });
    // The finish RPC commits the success receipt with the seven-source write.
    return NextResponse.json({ ok: true, runId: job.id, ...summary });
  } catch (error: any) {
    if (job) {
      // A stage-log or adapter response can fail after the atomic transaction
      // committed. Re-read only this run before recording failure, so a
      // durable reader publication cannot be relabeled as a failed attempt.
      try {
        const durable = await db.from("readout_specialty_source_runs").select("status,summary")
          .eq("id", job.id).eq("mode", "publish").maybeSingle();
        if (!durable.error && durable.data?.status === "succeeded" && durable.data.summary?.published === true) {
          const summary = { ...durable.data.summary, publicationReceiptRecovered: true };
          const repaired = await db.from("pipeline_job_runs").update({ status: "succeeded", current_stage: "complete", finished_at: new Date().toISOString(), details: summary }).eq("id", job.id).eq("status", "running");
          if (repaired.error) console.error("Specialty publication recovery logging failed", repaired.error.message);
          return NextResponse.json({ ok: true, runId: job.id, ...summary });
        }
      } catch (reconciliationError) { console.error("Specialty publication recovery readback failed", reconciliationError); }
      const recorded = await db.from("pipeline_job_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: String(error?.message ?? error).slice(0, 2000) }).eq("id", job.id).eq("status", "running");
      if (recorded.error) console.error("Specialty publication failure receipt could not be saved", recorded.error.message);
    }
    return NextResponse.json({ ok: false, error: String(error?.message ?? error).slice(0, 1500), runId: job?.id ?? null }, { status: 500 });
  } finally {
    if (owned) {
      const released = await db.rpc("release_ops_job_lease", { p_job_name: leaseName, p_lease_owner: owner });
      if (released.error) console.error("Specialty publication lease release failed", released.error.message);
    }
  }
}
