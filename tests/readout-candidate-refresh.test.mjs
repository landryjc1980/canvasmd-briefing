import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(readFileSync(new URL("../lib/readoutCandidateRefresh.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", code)((name) => {
  assert.equal(name, "server-only");
  return {};
}, loaded, loaded.exports);
const { refreshReadoutCandidatesForEdition, assertReadoutCandidateBuildUnchanged } = loaded.exports;
const runId = "550e8400-e29b-41d4-a716-446655440000";
const start = Date.parse("2026-09-12T09:00:00Z");
const environment = { url: "https://example.test", headers: { apikey: "test-service-key" } };
const receipt = (overrides = {}) => ({ build_run_id: runId, generated_at: new Date(start + 1_000).toISOString(), window_days: 7, ...overrides });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

function harness(rows, { postResponse = () => response(123), timeoutMs = 6_000 } = {}) {
  let tick = start;
  let reads = 0;
  const calls = [];
  return {
    calls,
    dependencies: {
      now: () => tick,
      runId: () => runId,
      timeoutMs,
      sleep: async (ms) => { tick += ms; },
      fetch: async (url, init) => {
        calls.push({ url, init });
        if (init.method === "POST") return postResponse();
        tick += 1_000;
        return response(rows[Math.min(reads++, rows.length - 1)]);
      },
    },
  };
}

test("dispatch is not completion: poll past yesterday's row and wait for this exact persisted run", async () => {
  const h = harness([[receipt({ build_run_id: "yesterday", generated_at: "2026-09-11T21:45:00Z" })], [receipt()]]);
  const result = await refreshReadoutCandidatesForEdition(environment, h.dependencies);
  assert.deepEqual(result, { runId, requestId: 123, generatedAt: receipt().generated_at });
  assert.equal(h.calls.filter(({ init }) => init.method === "POST").length, 1);
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[0].url, "https://example.test/rest/v1/rpc/request_readout_candidate_refresh");
  assert.deepEqual(JSON.parse(h.calls[0].init.body), { p_run_id: runId });
  assert.ok(h.calls.every(({ init }) => init.cache === "no-store" && init.headers.apikey === "test-service-key"));
});

test("a different run is never accepted even if it is recent", async () => {
  const h = harness([[receipt({ build_run_id: "different-run" })]]);
  await assert.rejects(refreshReadoutCandidatesForEdition(environment, h.dependencies), /not ready/);
  assert.equal(h.calls.filter(({ init }) => init.method === "POST").length, 1);
});

test("empty candidate storage does not become an empty successful edition", async () => {
  const h = harness([[]]);
  await assert.rejects(refreshReadoutCandidatesForEdition(environment, h.dependencies), /not ready/);
});

for (const [name, override] of [
  ["stale", { generated_at: "2026-09-11T21:45:00Z" }],
  ["invalid timestamp", { generated_at: "not-a-date" }],
  ["future timestamp", { generated_at: "2026-10-01T00:00:00Z" }],
  ["wrong window", { window_days: 45 }],
]) {
  test(`reject ${name} metadata even with the requested run ID`, async () => {
    const h = harness([[receipt(override)]]);
    await assert.rejects(refreshReadoutCandidatesForEdition(environment, h.dependencies), /stale or invalid/);
  });
}

test("failed dispatch never falls back to yesterday or submits again", async () => {
  const h = harness([[receipt()]], { postResponse: () => response({ error: "unavailable" }, 503) });
  await assert.rejects(refreshReadoutCandidatesForEdition(environment, h.dependencies), /HTTP 503/);
  assert.equal(h.calls.length, 1);
});

test("lost dispatch acknowledgement is not retried", async () => {
  const h = harness([[receipt()]], { postResponse: () => { throw new Error("acknowledgement lost"); } });
  await assert.rejects(refreshReadoutCandidatesForEdition(environment, h.dependencies), /acknowledgement lost/);
  assert.equal(h.calls.length, 1);
});

test("malformed dispatch receipt never starts source reads", async () => {
  const h = harness([[receipt()]], { postResponse: () => response({ queued: true }) });
  await assert.rejects(refreshReadoutCandidatesForEdition(environment, h.dependencies), /request receipt/);
  assert.equal(h.calls.length, 1);
});

test("a hung transport is bounded even when it ignores AbortSignal", async () => {
  await assert.rejects(refreshReadoutCandidatesForEdition(environment, {
    timeoutMs: 10, fetch: async () => new Promise(() => {}),
  }), /timed out/);
});

test("post-selection verification accepts the same build and rejects concurrent replacement", async () => {
  const expected = { runId, requestId: 123, generatedAt: receipt().generated_at };
  await assertReadoutCandidateBuildUnchanged(environment, expected, async () => response([receipt()]));
  await assert.rejects(assertReadoutCandidateBuildUnchanged(environment, expected,
    async () => response([receipt({ build_run_id: "hourly-replacement" })])), /changed during selection/);
});
