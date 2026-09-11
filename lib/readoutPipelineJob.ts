import "server-only";
import { supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";

type Json = Record<string, unknown>;
type PipelineRun = { id: string };
type PipelineStage = { id: string };
type TriggerKind = "scheduled" | "manual";
const LOG_TIMEOUT_MS = 8_000;

function serviceEnvironment() { const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!url || !key) throw new Error("Missing Supabase service environment for Readout job logging."); return { url, key }; }
function cleanError(error: unknown) { return (error instanceof Error ? error.message : String(error || "Unknown pipeline error")).replace(/[\r\n\t]+/g, " ").slice(0, 2000); }
function environment() { return process.env.VERCEL_ENV === "production" ? "production" : process.env.VERCEL_ENV === "preview" ? "preview" : "development"; }
function withTimeout<T>(promise: Promise<T>, ms: number, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<T>((_, reject) => {
    timer = setTimeout(() => { controller?.abort(); reject(new Error(`Readout job deadline exceeded after ${ms}ms.`)); }, ms);
  });
  return Promise.race([promise, deadline]).finally(() => { if (timer) clearTimeout(timer); });
}
function throwIfAborted(signal: AbortSignal) { if (signal.aborted) throw new Error("Readout job stage was aborted before publication work."); }

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { url, key } = serviceEnvironment(); const controller = new AbortController();
  const response = await withTimeout(fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...supabaseApiKeyHeaders(key), "content-type": "application/json", ...(init.headers ?? {}) }, cache: "no-store", signal: controller.signal }), LOG_TIMEOUT_MS, controller);
  if (!response.ok) { const body = await withTimeout(response.text(), LOG_TIMEOUT_MS, controller); throw new Error(`Readout job logging returned ${response.status}: ${body.replace(/[\r\n\t]+/g, " ").slice(0, 1800)}`); }
  if (response.status === 204) return undefined as T;
  return withTimeout(response.json() as Promise<T>, LOG_TIMEOUT_MS, controller);
}
export function readoutTriggerKind(req: { headers: Headers }, manual = false): TriggerKind { if (manual) return "manual"; return req.headers.has("x-vercel-cron-schedule") || /vercel-cron/i.test(req.headers.get("user-agent") ?? "") ? "scheduled" : "manual"; }
export type ReadoutPipelineJob = { stage<T>(stage: string, work: (signal: AbortSignal) => Promise<T>, options?: { details?: Json; deadlineMs?: number }): Promise<T>; succeed(details?: Json): Promise<void>; skip(details?: Json): Promise<void>; fail(error: unknown, details?: Json): Promise<void>; };

export async function startReadoutPipelineJob(jobName: string, triggerKind: TriggerKind, options: { deadlineMs?: number; details?: Json } = {}): Promise<ReadoutPipelineJob> {
  const startedAt = new Date(), deadlineAt = new Date(startedAt.getTime() + (options.deadlineMs ?? 270_000));
  const [run] = await request<PipelineRun[]>("pipeline_job_runs", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify([{ job_name: jobName, trigger_kind: triggerKind, environment: environment(), status: "running", started_at: startedAt.toISOString(), deadline_at: deadlineAt.toISOString(), current_stage: "starting", details: options.details ?? {}, build_sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null }]) });
  if (!run?.id) throw new Error("Readout job logging did not return a run id.");
  const updateRun = async (values: Json): Promise<void> => { await request<void>(`pipeline_job_runs?id=eq.${encodeURIComponent(run.id)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(values) }); };
  return {
    async stage<T>(stage: string, work: (signal: AbortSignal) => Promise<T>, options: { details?: Json; deadlineMs?: number } = {}): Promise<T> {
      const now = Date.now(), remaining = deadlineAt.getTime() - now, stageMs = Math.min(options.deadlineMs ?? remaining, remaining);
      if (stageMs <= 0) throw new Error("Readout job deadline exceeded before stage start.");
      const stageDeadline = new Date(now + stageMs).toISOString(); await updateRun({ current_stage: stage });
      const [row] = await request<PipelineStage[]>("pipeline_job_stages", { method: "POST", headers: { prefer: "return=representation" }, body: JSON.stringify([{ run_id: run.id, stage, status: "running", started_at: new Date(now).toISOString(), deadline_at: stageDeadline, details: options.details ?? {} }]) });
      if (!row?.id) throw new Error(`Readout job logging did not return an id for ${stage}.`);
      const controller = new AbortController();
      try {
        const remainingAfterReceipts = new Date(stageDeadline).getTime() - Date.now();
        if (remainingAfterReceipts <= 0) throw new Error(`Readout stage ${stage} exceeded its deadline before work began.`);
        throwIfAborted(controller.signal);
        const result = await withTimeout(work(controller.signal), remainingAfterReceipts, controller);
        throwIfAborted(controller.signal);
        if (Date.now() > new Date(stageDeadline).getTime()) throw new Error(`Readout stage ${stage} exceeded its deadline.`);
        await request<void>(`pipeline_job_stages?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "succeeded", finished_at: new Date().toISOString() }) });
        return result;
      } catch (error) {
        try { await request<void>(`pipeline_job_stages?id=eq.${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "failed", finished_at: new Date().toISOString(), error: cleanError(error) }) }); }
        catch (loggingError) { console.error("Readout job stage failure could not be logged.", loggingError); }
        throw error;
      }
    },
    succeed: (details = {}) => updateRun({ status: "succeeded", current_stage: "complete", finished_at: new Date().toISOString(), details }),
    skip: (details = {}) => updateRun({ status: "skipped", current_stage: "skipped", finished_at: new Date().toISOString(), details }),
    fail: (error, details = {}) => updateRun({ status: "failed", finished_at: new Date().toISOString(), error: cleanError(error), details: { ...details, message: cleanError(error) } }),
  };
}
