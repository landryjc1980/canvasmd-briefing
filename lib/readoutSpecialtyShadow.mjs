import { createClient } from "@supabase/supabase-js";
import { createSpecialtyBriefingBuilder, createSpecialtyRecap } from "./generated/specialtyBriefingBuilder.mjs";
import { assertCompleteSpecialtyBatch, compareSpecialtyOutput, specialtyComparisonStatus, SPECIALTY_AREAS } from "./readoutSpecialtyComparison.mjs";
import { createSpecialtyTransport } from "./readoutSpecialtyTransport.mjs";
import { assertSpecialtyPublicationControl, finishSpecialtyPublication } from "./readoutSpecialtyPublication.mjs";

export const SPECIALTY_SOURCE_DEADLINE_MS = 270_000;
export const SPECIALTY_JOB_DEADLINE_MS = 275_000;
export const SPECIALTY_FINALIZATION_RESERVE_MS = 30_000;
export const SPECIALTY_BUILD_BUDGET_MS = SPECIALTY_SOURCE_DEADLINE_MS - SPECIALTY_FINALIZATION_RESERVE_MS;
export const SPECIALTY_MAX_CONCURRENT_BUILDS = 2;
export const SPECIALTY_RECEIPT_TIMEOUT_MS = 8_000;
export const SPECIALTY_COMMIT_TIMEOUT_MS = 25_000;
export const SPECIALTY_READBACK_RESERVE_MS = 5_000;
export const SPECIALTY_READBACK_TIMEOUT_MS = 3_000;

export function specialtyBatchDeadlinePlan(startedAt, currentTime = Date.now()) {
  const sourceDeadlineAt = startedAt + SPECIALTY_SOURCE_DEADLINE_MS;
  return {
    sourceDeadlineAt,
    jobDeadlineAt: startedAt + SPECIALTY_JOB_DEADLINE_MS,
    buildDeadlineAt: startedAt + SPECIALTY_BUILD_BUDGET_MS,
    buildRemainingMs: Math.max(0, startedAt + SPECIALTY_BUILD_BUDGET_MS - currentTime),
    finalizationRemainingMs: Math.max(0, sourceDeadlineAt - currentTime),
  };
}

export async function mapSpecialtyAreas(areas, limit, work, { onError = undefined } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error("Specialty build concurrency must be a positive integer.");
  const results = new Array(areas.length);
  let next = 0, failure;
  const worker = async () => {
    while (true) {
      if (failure) return;
      const index = next++;
      if (index >= areas.length) return;
      try { results[index] = await work(areas[index], index); }
      catch (error) {
        if (!failure) { failure = error; onError?.(error); }
        return;
      }
    }
  };
  await Promise.allSettled(Array.from({ length: Math.min(limit, areas.length) }, worker));
  if (failure) throw failure;
  return results;
}

export function specialtyReceiptBudget(remainingMs, maxRequestMs = SPECIALTY_RECEIPT_TIMEOUT_MS) {
  return Math.min(maxRequestMs, Math.floor(remainingMs));
}

export function boundedReceiptFetch(fetchImpl, signal, remainingMs, label, maxRequestMs = SPECIALTY_RECEIPT_TIMEOUT_MS) {
  return async (input, init = {}) => {
    const remaining = specialtyReceiptBudget(remainingMs(), maxRequestMs);
    if (remaining <= 0) throw new Error(`Specialty ${label} deadline elapsed before receipt request.`);
    const timeout = AbortSignal.timeout(remaining);
    const signals = [timeout, signal, init.signal].filter(Boolean);
    return fetchImpl(input, { ...init, cache: "no-store", signal: AbortSignal.any(signals) });
  };
}
function receiptClient(url, key, fetchImpl, signal, remainingMs, label, maxRequestMs = SPECIALTY_RECEIPT_TIMEOUT_MS) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: boundedReceiptFetch(fetchImpl, signal, remainingMs, label, maxRequestMs) },
  });
}

export function specialtyClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = key => parts.find(part => part.type === key)?.value;
  const date = `${get("year")}-${get("month")}-${get("day")}`, hour = Number(get("hour"));
  return { date, hour, sourceRunId: `scheduled-${date.replaceAll("-", "")}${hour < 12 ? "06" : "20"}` };
}
export function specialtyShadowInvocation({ now = new Date(), manual = false, owner, canaryId, canaryUntil, scheduledDates = [] }) {
  const clock = specialtyClock(now);
  if (manual) return { manual: true, canary: false, sourceRunId: `manual-${clock.sourceRunId}-${owner}` };
  // Observe Edge after its bounded 04:20–04:50 recovery window.
  if (clock.hour === 5 && scheduledDates.includes(clock.date)) return { manual: false, canary: false, sourceRunId: clock.sourceRunId };
  if (!canaryId) return null;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(canaryId)) throw new Error("Invalid specialty shadow canary id.");
  const expiresAt = Date.parse(canaryUntil ?? "");
  if (!Number.isFinite(expiresAt)) throw new Error("Specialty shadow canary requires an explicit expiry.");
  if (expiresAt <= now.getTime()) return null;
  if (expiresAt - now.getTime() > 30 * 60_000) throw new Error("Specialty shadow canary window exceeds 30 minutes.");
  // Vercel's native manual cron control cannot add a query string. An explicit
  // operator-configured id allows one off-hours attempt without exposing its
  // sensitive cron secret. The route rejects reuse after any recorded outcome.
  return { manual: true, canary: true, sourceRunId: `canary-${canaryId}` };
}
function requireResult(result, operation) { if (result.error) throw new Error(`${operation}: ${result.error.message}`); return result.data; }

export function runSpecialtyShadow(options) {
  return runSpecialtyBatch({ ...options, mode: "shadow" });
}

export async function runSpecialtyBatch({ url, key, engineInfo, job, sourceRunId, now = new Date(), signal = undefined, fetchImpl = fetch, record = undefined, onOutput = undefined, allowCapturedRecap = false, mode = "shadow", publicationControl, builderFactory = createSpecialtyBriefingBuilder, recapFactory = createSpecialtyRecap }) {
  if (engineInfo.dirty || !/^[a-f0-9]{40}$/.test(engineInfo.backendSha)) throw new Error("Specialty source engine must be a committed, clean build.");
  if (!["shadow", "publish"].includes(mode)) throw new Error("Invalid specialty batch mode.");
  if (mode === "publish") {
    if (allowCapturedRecap) throw new Error("Capture-only diagnostics cannot publish.");
    assertSpecialtyPublicationControl(publicationControl, engineInfo);
  }
  const startedAt = now.getTime(), deadlines = specialtyBatchDeadlinePlan(startedAt);
  const builtAt = now.toISOString(), deadlineAt = new Date(deadlines.sourceDeadlineAt).toISOString();
  const buildRemainingMs = () => Math.max(0, deadlines.buildDeadlineAt - Date.now());
  const sourceRemainingMs = () => Math.max(0, deadlines.sourceDeadlineAt - Date.now());
  const jobRemainingMs = () => Math.max(0, deadlines.jobDeadlineAt - Date.now());
  if (sourceRemainingMs() <= 0) throw new Error("Specialty source deadline elapsed before batch start.");
  const sourceSignal = AbortSignal.any([AbortSignal.timeout(sourceRemainingMs()), ...(signal ? [signal] : [])]);
  const buildController = new AbortController();
  const buildSignal = AbortSignal.any([buildController.signal, sourceSignal, AbortSignal.timeout(Math.max(1, buildRemainingMs()))]);
  const transport = createSpecialtyTransport({ baseUrl: url, signal: buildSignal, fetchImpl, record, allowCapturedRecap });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport.fetch } });
  // Builder I/O and its per-area receipts stop at the build budget. Final
  // atomic publication and the independent failure receipt use their own
  // clients so an aborted build cannot consume the finalization reserve.
  const buildReceipts = receiptClient(url, key, fetchImpl, buildSignal, buildRemainingMs, "build");
  const failureReceipts = receiptClient(url, key, fetchImpl, signal, jobRemainingMs, "failure receipt");
  let outputs = [];
  const completedByArea = new Map();
  let registered = false;
  try {
    const input = await job.stage("load-specialty-inputs", async () => {
      const [legacy, states] = await Promise.all([
        db.from("briefing_snapshots").select("area,data,generated_at").in("area", SPECIALTY_AREAS),
        db.from("briefing_build_state").select("area,window_days").in("area", SPECIALTY_AREAS),
      ]);
      return { legacy: requireResult(legacy, "Load prior specialty snapshots"), states: requireResult(states, "Load specialty windows") };
    }, { deadlineMs: buildRemainingMs() });
    const priors = new Map(input.legacy.map(row => [row.area, row]));
    const windows = Object.fromEntries(SPECIALTY_AREAS.map(area => {
      const days = input.states.find(row => row.area === area)?.window_days;
      if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error(`Missing or invalid existing specialty window: ${area}.`);
      return [area, days];
    }));
    requireResult(await buildReceipts.from("readout_specialty_source_runs").insert({ id: job.id, source_run_id: sourceRunId, mode, built_at: builtAt, deadline_at: deadlineAt, engine_sha: engineInfo.backendSha, windows }), "Register specialty batch");
    registered = true;
    const buildRows = await job.stage("build-specialty-areas", async stageSignal => {
      const abortBuild = () => buildController.abort(stageSignal.reason);
      stageSignal.addEventListener("abort", abortBuild, { once: true });
      try {
        return await mapSpecialtyAreas(SPECIALTY_AREAS, SPECIALTY_MAX_CONCURRENT_BUILDS, async area => {
          try {
            buildSignal.throwIfAborted();
            const areaTrace = [], traceStarted = performance.now();
            // Builders close over collection state, so each concurrent area gets
            // an isolated builder while sharing the same frozen transport/input
            // cache, priors, windows, and clock.
            const builder = builderFactory({
              db, buildInfo: { sha: engineInfo.backendSha, dirty: false, stampedAt: builtAt }, now: () => now.getTime(), effectsMode: "collect",
              loadPriorSnapshot: async priorArea => { const row = priors.get(priorArea); return row ? { data: row.data, at: Date.parse(row.generated_at) } : null; },
              recap: recapFactory({ url, key, fetch: transport.fetch }),
              memoryUsage: () => process.memoryUsage(),
              trace: event => { areaTrace.push({ area, sequence: areaTrace.length, ...event, observedElapsedMs: Math.round(performance.now() - traceStarted) }); },
            });
            const started = performance.now();
            const { data, effects } = await builder.buildSpecialtyArea(area, { recentDays: windows[area], sourceRunId });
            buildSignal.throwIfAborted(); stageSignal.throwIfAborted();
            transport.assertHealthy();
            const prior = priors.get(area);
            const row = { run_id: job.id, area, data, effects, legacy_data: prior?.data ?? null, legacy_generated_at: prior?.generated_at ?? null, duration_ms: Math.round(performance.now() - started), comparison: compareSpecialtyOutput(data, prior, sourceRunId) };
            await onOutput?.(row);
            buildSignal.throwIfAborted(); stageSignal.throwIfAborted();
            requireResult(await buildReceipts.from("readout_specialty_source_outputs").insert(row), `Record ${area} source output`);
            completedByArea.set(area, row);
            return { row, trace: areaTrace };
          } catch (error) {
            buildController.abort(error);
            throw error;
          }
        }, { onError: error => buildController.abort(error) });
      } finally { stageSignal.removeEventListener("abort", abortBuild); }
    }, { deadlineMs: buildRemainingMs(), details: { areas: SPECIALTY_AREAS, maxConcurrentBuilds: SPECIALTY_MAX_CONCURRENT_BUILDS, windows } });
    outputs = buildRows.map(result => result.row);
    assertCompleteSpecialtyBatch(outputs, { sourceRunId, engineSha: engineInfo.backendSha, builtAt });
    sourceSignal.throwIfAborted();
    const diagnostics = { comparisonStatus: specialtyComparisonStatus(outputs), qualifiedForCutover: false, proseMode: allowCapturedRecap ? "capture_only" : "live", engineSha256: engineInfo.engineSha256, transport: transport.stats(), areas: outputs.map(row => ({ area: row.area, durationMs: row.duration_ms, comparison: row.comparison })), trace: buildRows.flatMap(result => result.trace) };
    return await job.stage(mode === "publish" ? "finalize-publication" : "finalize-shadow", async stageSignal => {
      const finalSignal = AbortSignal.any([sourceSignal, stageSignal]);
      if (mode === "publish") {
        // One RPC commits every source and deferred effect, together with the
        // successful job receipt. There are no reader writes before this point.
        const commitRemainingMs = () => Math.max(0, sourceRemainingMs() - SPECIALTY_READBACK_RESERVE_MS);
        const commitReceipts = receiptClient(url, key, fetchImpl, finalSignal, commitRemainingMs, "publication commit", SPECIALTY_COMMIT_TIMEOUT_MS);
        const readbackReceipts = receiptClient(url, key, fetchImpl, finalSignal, sourceRemainingMs, "publication readback", SPECIALTY_READBACK_TIMEOUT_MS);
        return finishSpecialtyPublication(commitReceipts, job.id, diagnostics, { readbackReceipts, readbackDeadlineAt: deadlines.sourceDeadlineAt, readbackBudgetMs: SPECIALTY_READBACK_RESERVE_MS });
      }
      const finalReceipts = receiptClient(url, key, fetchImpl, finalSignal, sourceRemainingMs, "finalization");
      const completed = requireResult(await finalReceipts.rpc("finish_readout_specialty_shadow", { p_run_id: job.id }), "Complete specialty shadow");
      const summary = { ...completed, ...diagnostics };
      requireResult(await finalReceipts.from("readout_specialty_source_runs").update({ summary }).eq("id", job.id), "Record specialty shadow summary");
      return summary;
    }, { deadlineMs: sourceRemainingMs(), details: { sourceDeadlineAt: new Date(deadlines.sourceDeadlineAt).toISOString(), reservedFinalizationMs: SPECIALTY_FINALIZATION_RESERVE_MS, completedAreas: outputs.map(row => row.area) } });
  } catch (error) {
    buildController.abort(error);
    if (registered) {
      try {
        const result = await failureReceipts.from("readout_specialty_source_runs").update({ status: "failed", finished_at: new Date().toISOString(), summary: { error: String(error).slice(0, 1500), completedAreas: SPECIALTY_AREAS.filter(area => completedByArea.has(area)), transport: transport.stats() } }).eq("id", job.id).eq("mode", mode).eq("status", "running");
        if (result.error) console.error("Specialty shadow failure receipt could not be saved", result.error.message);
      } catch (receiptError) { console.error("Specialty shadow failure receipt could not be saved", receiptError); }
    }
    throw error;
  } finally { buildController.abort(); }
}
