import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readoutTriggerKind, startReadoutPipelineJob } from "@/lib/readoutPipelineJob";
import { runSpecialtyShadow, specialtyClock } from "@/lib/readoutSpecialtyShadow.mjs";
import engineInfo from "@/lib/generated/specialtyBriefingBuilder.manifest.json";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (process.env.VERCEL_ENV !== "production") return NextResponse.json({ ok: false, error: "Specialty shadow is production-only." }, { status: 409 });
  // Activation follows full-run approval and the measured canary; deploying the
  // endpoint alone cannot start provider work through a scheduled invocation.
  if (process.env.READOUT_SPECIALTY_SHADOW_ENABLED !== "1") return NextResponse.json({ ok: true, skipped: "shadow-not-activated", webSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null, engineSha: engineInfo.backendSha, nodeVersion: process.version });
  const now = new Date(), clock = specialtyClock(now), manual = req.nextUrl.searchParams.get("manual") === "1";
  if (!manual && clock.hour !== 4) return NextResponse.json({ ok: true, skipped: "outside-4am-et" });
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Missing service environment." }, { status: 500 });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000), cache: "no-store" }) } });
  const owner = crypto.randomUUID(), leaseName = "readout-specialty-batch";
  let job, owned = false;
  try {
    const lease = await db.rpc("acquire_ops_job_lease", { p_job_name: leaseName, p_lease_owner: owner, p_ttl_seconds: 330 });
    if (lease.error) throw lease.error;
    if (lease.data !== true) return NextResponse.json({ ok: true, skipped: "batch-already-running" });
    owned = true;
    const expired = await db.from("readout_specialty_source_runs").update({ status: "failed", finished_at: now.toISOString(), summary: { error: "Previous Node job exceeded its deadline." } }).eq("status", "running").lt("deadline_at", now.toISOString());
    if (expired.error) throw expired.error;
    const sourceRunId = manual ? `manual-${clock.sourceRunId}-${owner}` : clock.sourceRunId;
    const existing = await db.from("readout_specialty_source_runs").select("id,status").eq("mode", "shadow").eq("source_run_id", sourceRunId).in("status", ["running", "succeeded"]).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return NextResponse.json({ ok: true, skipped: "cycle-already-built", runId: existing.data.id });
    job = await startReadoutPipelineJob("readout-specialty-shadow", readoutTriggerKind(req, manual), { details: { sourceRunId, engineSha: engineInfo.backendSha }, deadlineMs: 275_000 });
    const summary = await runSpecialtyShadow({ url, key, engineInfo, job, sourceRunId, now });
    await job.succeed(summary);
    return NextResponse.json({ ok: true, runId: job.id, ...summary });
  } catch (error: any) {
    try { await job?.fail(error); } catch (loggingError) { console.error("Specialty shadow failure logging failed", loggingError); }
    return NextResponse.json({ ok: false, error: String(error?.message ?? error).slice(0, 1500), runId: job?.id ?? null }, { status: 500 });
  } finally {
    if (owned) { const released = await db.rpc("release_ops_job_lease", { p_job_name: leaseName, p_lease_owner: owner }); if (released.error) console.error("Specialty batch lease release failed", released.error.message); }
  }
}
