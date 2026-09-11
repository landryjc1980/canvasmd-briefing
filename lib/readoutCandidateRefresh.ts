import "server-only";

export type ReadoutCandidateBuild = {
  runId: string;
  requestId: number;
  generatedAt: string;
};

type Environment = { url: string; headers: Record<string, string> };
type Dependencies = {
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  runId?: () => string;
  timeoutMs?: number;
};
type CandidateRow = { build_run_id?: unknown; generated_at?: unknown; window_days?: unknown };

const REFRESH_TIMEOUT_MS = 120_000;
const POLL_MS = 1_500;

// Bound the entire request, including body parsing, even if a transport ignores
// AbortSignal. A lost POST acknowledgement is never blindly submitted again.
async function jsonRequest(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(url, { ...init, signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Readout candidate dependency returned HTTP ${response.status}.`);
        return response.json();
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Readout candidate dependency request timed out."));
        }, Math.max(1, timeoutMs));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function candidateRow(environment: Environment, fetcher: typeof fetch, timeoutMs: number) {
  const value = await jsonRequest(fetcher,
    `${environment.url}/rest/v1/front_page_candidates?select=build_run_id,generated_at,window_days&lane=eq.cross_cutting&limit=1`,
    { headers: environment.headers }, timeoutMs);
  if (!Array.isArray(value) || value.length > 1) throw new Error("Invalid Readout candidate dependency receipt.");
  return value[0] as CandidateRow | undefined;
}

/** One awaited build per new canonical edition, including weekend/fallback builds.
 * An HTTP enqueue acknowledgement is not success: the exact requested run must
 * finish and become the persisted candidate universe before source reads begin. */
export async function refreshReadoutCandidatesForEdition(
  environment: Environment,
  dependencies: Dependencies = {},
): Promise<ReadoutCandidateBuild> {
  const fetcher = dependencies.fetch ?? fetch;
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const runId = (dependencies.runId ?? (() => crypto.randomUUID()))();
  const startedAt = now();
  const deadline = startedAt + Math.min(REFRESH_TIMEOUT_MS, Math.max(1, dependencies.timeoutMs ?? REFRESH_TIMEOUT_MS));
  const requestId = await jsonRequest(fetcher, `${environment.url}/rest/v1/rpc/request_readout_candidate_refresh`, {
    method: "POST",
    headers: { ...environment.headers, "content-type": "application/json" },
    body: JSON.stringify({ p_run_id: runId }),
  }, Math.min(10_000, deadline - now()));
  if (typeof requestId !== "number" || !Number.isSafeInteger(requestId) || requestId <= 0) {
    throw new Error("Readout candidate refresh did not return a request receipt.");
  }
  while (now() < deadline) {
    const row = await candidateRow(environment, fetcher, Math.min(10_000, deadline - now()));
    if (row?.build_run_id === runId) {
      const generatedAt = typeof row.generated_at === "string" ? row.generated_at : "";
      const generatedMs = Date.parse(generatedAt);
      if (!Number.isFinite(generatedMs) || generatedMs < startedAt || generatedMs > now() + 5_000 || row.window_days !== 7) {
        throw new Error("Readout candidate refresh returned stale or invalid build metadata.");
      }
      return { runId, requestId, generatedAt };
    }
    await sleep(Math.min(POLL_MS, Math.max(0, deadline - now())));
  }
  throw new Error("Fresh Readout candidates were not ready; the daily edition was not built.");
}

/** Reject a concurrent candidate replacement during the parallel specialty reads. */
export async function assertReadoutCandidateBuildUnchanged(
  environment: Environment,
  expected: ReadoutCandidateBuild,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const row = await candidateRow(environment, fetcher, 10_000);
  if (row?.build_run_id !== expected.runId || row.generated_at !== expected.generatedAt || row.window_days !== 7) {
    throw new Error("Readout candidates changed during selection; the daily edition was not saved.");
  }
}
