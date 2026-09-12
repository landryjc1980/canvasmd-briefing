#!/usr/bin/env node
// Authorized private canary. Database/provider inputs stay in the supplied local
// directory for offline parity replay; no reader snapshots or audio are written.
import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { runSpecialtyShadow, specialtyClock } from "../lib/readoutSpecialtyShadow.mjs";

const output = process.argv[2];
const liveRecap = process.argv.includes("--live-recap");
if (liveRecap && process.argv.includes("--capture-recap")) throw new Error("Choose either live recap or capture-only diagnostics.");
if (liveRecap && process.env.READOUT_SPECIALTY_LIVE_RECAP_APPROVED !== "1") throw new Error("Live recap requires explicit approval and READOUT_SPECIALTY_LIVE_RECAP_APPROVED=1.");
const captureRecap = !liveRecap;
if (!output || !path.isAbsolute(output)) throw new Error("Supply an absolute private output directory.");
await mkdir(output, { recursive: true, mode: 0o700 });
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Load the service environment before this command.");
const engineInfo = JSON.parse(await readFile(new URL("../lib/generated/specialtyBriefingBuilder.manifest.json", import.meta.url), "utf8"));
if (engineInfo.dirty) throw new Error("Commit and resync the engine before a live canary.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init = {}) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }) } });
const check = result => { if (result.error) throw new Error(result.error.message); return result.data; };
const now = new Date(), sourceRunId = `manual-${specialtyClock(now).sourceRunId}-${crypto.randomUUID()}`;
const leaseOwner = crypto.randomUUID();
if (check(await db.rpc("acquire_ops_job_lease", { p_job_name: "readout-specialty-batch", p_lease_owner: leaseOwner, p_ttl_seconds: 330 })) !== true) throw new Error("A specialty batch is already running.");
let run;
try {
  [run] = check(await db.from("pipeline_job_runs").insert({ job_name: "readout-specialty-shadow", trigger_kind: "manual", environment: "development", status: "running", started_at: now.toISOString(), deadline_at: new Date(now.getTime() + 275_000).toISOString(), current_stage: "starting", build_sha: engineInfo.backendSha, details: { sourceRunId, localCanary: true, proseMode: captureRecap ? "capture_only" : "live" } }).select("id"));
  const job = {
    id: run.id,
    async stage(name, work, options = {}) {
      const started = new Date();
      check(await db.from("pipeline_job_runs").update({ current_stage: name }).eq("id", run.id));
      const [stage] = check(await db.from("pipeline_job_stages").insert({ run_id: run.id, stage: name, status: "running", started_at: started.toISOString(), deadline_at: new Date(now.getTime() + 270_000).toISOString(), details: options.details ?? {} }).select("id"));
      console.log(JSON.stringify({ stage: name, status: "started" }));
      try {
        const result = await work(AbortSignal.timeout(Math.max(1, now.getTime() + 270_000 - Date.now())));
        check(await db.from("pipeline_job_stages").update({ status: "succeeded", finished_at: new Date().toISOString() }).eq("id", stage.id));
        console.log(JSON.stringify({ stage: name, status: "succeeded", durationMs: Date.now() - started.getTime() }));
        return result;
      } catch (error) {
        check(await db.from("pipeline_job_stages").update({ status: "failed", finished_at: new Date().toISOString(), error: String(error).slice(0, 2000) }).eq("id", stage.id));
        throw error;
      }
    },
  };
  await writeFile(path.join(output, "metadata.json"), JSON.stringify({ runId: run.id, sourceRunId, now: now.toISOString(), engineInfo, proseMode: captureRecap ? "capture_only" : "live" }, null, 2), { mode: 0o600 });
  let recordQueue = Promise.resolve();
  const capturedRecaps = new Set();
  const captureFetch = async (input, init = {}) => {
    const target = new URL(String(input));
    if (target.pathname === "/functions/v1/briefing-recap") {
      const body = JSON.parse(String(init.body));
      if (!capturedRecaps.has(body.area)) { await writeFile(path.join(output, `recap-input-${body.area}.json`), JSON.stringify(body, null, 2), { mode: 0o600 }); capturedRecaps.add(body.area); }
      // No fetch takes place on this branch. Existing no-prose behavior is
      // replayed; this diagnostic cannot qualify full production runtime.
      return new Response(JSON.stringify({ recap: null, whys: {}, headline: null, headlineStoryId: null, moverHeadlines: {}, storyWhys: {}, storyHeadlines: {}, captureOnly: true }), { headers: { "content-type": "application/json" } });
    }
    return fetch(input, init);
  };
  const summary = await runSpecialtyShadow({ url, key, engineInfo, job, sourceRunId, now,
    ...(captureRecap ? { fetchImpl: captureFetch, allowCapturedRecap: true } : {}),
    record: receipt => { recordQueue = recordQueue.then(() => appendFile(path.join(output, "inputs.jsonl"), JSON.stringify(receipt) + "\n", { mode: 0o600 })); return recordQueue; },
    onOutput: async row => writeFile(path.join(output, `node-${row.area}.json`), JSON.stringify(row), { mode: 0o600 }),
  });
  summary.proseMode = captureRecap ? "capture_only" : "live";
  summary.qualifiedForCutover = false; // A manual canary never substitutes for scheduled shadow mornings.
  check(await db.from("readout_specialty_source_runs").update({ summary }).eq("id", run.id));
  check(await db.from("pipeline_job_runs").update({ status: "succeeded", current_stage: "complete", finished_at: new Date().toISOString(), details: summary }).eq("id", run.id));
  await writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ runId: run.id, durationMs: summary.durationMs, areas: summary.areas.map(row => ({ area: row.area, durationMs: row.durationMs, comparison: row.comparison.status })), transport: summary.transport }));
} catch (error) {
  if (run) check(await db.from("pipeline_job_runs").update({ status: "failed", finished_at: new Date().toISOString(), error: String(error).slice(0, 2000) }).eq("id", run.id));
  throw error;
} finally { check(await db.rpc("release_ops_job_lease", { p_job_name: "readout-specialty-batch", p_lease_owner: leaseOwner })); }
