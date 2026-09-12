import { createClient } from "@supabase/supabase-js";
import { createSpecialtyBriefingBuilder, createSpecialtyRecap } from "./generated/specialtyBriefingBuilder.mjs";
import { assertCompleteSpecialtyBatch, compareSpecialtyOutput, specialtyComparisonStatus, SPECIALTY_AREAS } from "./readoutSpecialtyComparison.mjs";
import { createSpecialtyTransport } from "./readoutSpecialtyTransport.mjs";

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

export async function runSpecialtyShadow({ url, key, engineInfo, job, sourceRunId, now = new Date(), signal = undefined, fetchImpl = fetch, record = undefined, onOutput = undefined, allowCapturedRecap = false }) {
  if (engineInfo.dirty || !/^[a-f0-9]{40}$/.test(engineInfo.backendSha)) throw new Error("Specialty source engine must be a committed, clean build.");
  const builtAt = now.toISOString(), deadlineAt = new Date(now.getTime() + 270_000).toISOString();
  const controller = new AbortController();
  const combined = AbortSignal.any([controller.signal, AbortSignal.timeout(260_000), ...(signal ? [signal] : [])]);
  const transport = createSpecialtyTransport({ baseUrl: url, signal: combined, fetchImpl, record, allowCapturedRecap });
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: transport.fetch } });
  // Persistence uses a separate client: the builder transport rejects writes.
  const receipts = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init = {}) => fetchImpl(input, { ...init, signal: AbortSignal.any([AbortSignal.timeout(8_000), ...(init.signal ? [init.signal] : [])]) }) } });
  const outputs = [], traces = [];
  let registered = false;
  try {
    const input = await job.stage("load-specialty-inputs", async () => {
      const [legacy, states] = await Promise.all([
        db.from("briefing_snapshots").select("area,data,generated_at").in("area", SPECIALTY_AREAS),
        db.from("briefing_build_state").select("area,window_days").in("area", SPECIALTY_AREAS),
      ]);
      return { legacy: requireResult(legacy, "Load prior specialty snapshots"), states: requireResult(states, "Load specialty windows") };
    });
    const priors = new Map(input.legacy.map(row => [row.area, row]));
    const windows = Object.fromEntries(SPECIALTY_AREAS.map(area => {
      const days = input.states.find(row => row.area === area)?.window_days;
      if (!Number.isInteger(days) || days < 1 || days > 14) throw new Error(`Missing or invalid existing specialty window: ${area}.`);
      return [area, days];
    }));
    requireResult(await receipts.from("readout_specialty_source_runs").insert({ id: job.id, source_run_id: sourceRunId, mode: "shadow", built_at: builtAt, deadline_at: deadlineAt, engine_sha: engineInfo.backendSha, windows }), "Register specialty shadow");
    registered = true;
    const traceStarted = performance.now();
    const builder = createSpecialtyBriefingBuilder({
      db, buildInfo: { sha: engineInfo.backendSha, dirty: false, stampedAt: builtAt }, now: () => now.getTime(), effectsMode: "collect",
      loadPriorSnapshot: async area => { const row = priors.get(area); return row ? { data: row.data, at: Date.parse(row.generated_at) } : null; },
      recap: createSpecialtyRecap({ url, key, fetch: transport.fetch }),
      memoryUsage: () => process.memoryUsage(),
      trace: event => { traces.push({ ...event, observedElapsedMs: Math.round(performance.now() - traceStarted) }); },
    });
    for (const area of SPECIALTY_AREAS) {
      combined.throwIfAborted();
      await job.stage(`build-${area.toLowerCase()}`, async stageSignal => {
        stageSignal.addEventListener("abort", () => controller.abort(stageSignal.reason), { once: true });
        const started = performance.now();
        const { data, effects } = await builder.buildSpecialtyArea(area, { recentDays: windows[area], sourceRunId });
        combined.throwIfAborted(); stageSignal.throwIfAborted();
        transport.assertHealthy();
        const prior = priors.get(area);
        const row = { run_id: job.id, area, data, effects, legacy_data: prior?.data ?? null, legacy_generated_at: prior?.generated_at ?? null, duration_ms: Math.round(performance.now() - started), comparison: compareSpecialtyOutput(data, prior, sourceRunId) };
        await onOutput?.(row);
        requireResult(await receipts.from("readout_specialty_source_outputs").insert(row), `Record ${area} shadow output`);
        outputs.push(row);
      }, { details: { area, windowDays: windows[area] } });
    }
    assertCompleteSpecialtyBatch(outputs, { sourceRunId, engineSha: engineInfo.backendSha, builtAt });
    combined.throwIfAborted();
    const completed = requireResult(await receipts.rpc("finish_readout_specialty_shadow", { p_run_id: job.id }), "Complete specialty shadow");
    const summary = { ...completed, comparisonStatus: specialtyComparisonStatus(outputs), qualifiedForCutover: false, proseMode: allowCapturedRecap ? "capture_only" : "live", engineSha256: engineInfo.engineSha256, transport: transport.stats(), areas: outputs.map(row => ({ area: row.area, durationMs: row.duration_ms, comparison: row.comparison })), trace: traces };
    requireResult(await receipts.from("readout_specialty_source_runs").update({ summary }).eq("id", job.id), "Record specialty shadow summary");
    return summary;
  } catch (error) {
    controller.abort(error);
    if (registered) {
      const result = await receipts.from("readout_specialty_source_runs").update({ status: "failed", finished_at: new Date().toISOString(), summary: { error: String(error).slice(0, 1500), completedAreas: outputs.map(row => row.area), transport: transport.stats() } }).eq("id", job.id).eq("status", "running");
      if (result.error) console.error("Specialty shadow failure receipt could not be saved", result.error.message);
    }
    throw error;
  } finally { controller.abort(); }
}
