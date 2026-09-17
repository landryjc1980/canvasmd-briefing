import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { assertSpecialtyPublicationControl } from "../lib/readoutSpecialtyPublication.mjs";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/readout-specialty-publish/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const engine = { dirty: false, backendSha: "a".repeat(40), engineSha256: "b".repeat(64) };
const approved = { enabled: true, approved_engine_sha: engine.backendSha, approved_engine_input_sha256: engine.engineSha256, review_evidence: [{ kind: "test", artifact: "/fixture", sha256: "c".repeat(64), acceptedAt: "2026-09-15T12:00:00Z", acceptedBy: "fixture only" }] };
async function exercise(options = {}) {
  const names = ["CRON_SECRET", "VERCEL_ENV", "READOUT_SPECIALTY_PUBLISH_ENABLED", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  Object.assign(process.env, { CRON_SECRET: "test-only", VERCEL_ENV: "production", READOUT_SPECIALTY_PUBLISH_ENABLED: "1", SUPABASE_URL: "https://db.test", SUPABASE_SERVICE_ROLE_KEY: "test-only", ...options.env });
  const calls = [], query = {}; let activeTable = "", sourceReads = 0;
  for (const method of ["select", "eq", "order", "limit", "update"]) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.maybeSingle = async () => ({ data: activeTable === "readout_specialty_source_runs" && ++sourceReads > 1 ? options.durable ?? null : options.existing ?? null });
  query.then = resolve => resolve({ error: null });
  const db = {
    from: table => { activeTable = table; calls.push(["from", table]); return query; },
    rpc: async name => { calls.push(["rpc", name]); return { data: name === "readout_specialty_publication_preflight" ? options.preflight ?? { ready: true, control: approved } : name === "acquire_ops_job_lease" ? options.lease !== false : true }; },
  };
  const deps = {
    "next/server": { NextResponse: { json: (body, options = {}) => ({ body, status: options.status ?? 200 }) } },
    "@supabase/supabase-js": { createClient: () => { calls.push(["createClient"]); return db; } },
    "@/lib/readoutPipelineJob": { readoutTriggerKind: () => options.manual ? "manual" : "scheduled", startReadoutPipelineJob: async () => { calls.push(["startJob"]); return { id: "run" }; } },
    "@/lib/readoutSpecialtyShadow.mjs": { runSpecialtyBatch: async args => { calls.push(["build", args.mode]); if (options.buildError) throw new Error("simulated build error"); return { published: true }; } },
    "@/lib/readoutSpecialtyPublication.mjs": { assertSpecialtyPublicationControl, specialtyPublicationCycle: () => options.offHours ? null : { sourceRunId: "scheduled-2026091606" } },
    "@/lib/generated/specialtyBriefingBuilder.manifest.json": engine,
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => deps[name] ?? assert.fail(name), module, module.exports);
  try {
    const req = { headers: new Headers(options.unauthorized ? {} : { authorization: "Bearer test-only" }), nextUrl: new URL("https://test/api/readout-specialty-publish") };
    return { response: await module.exports.GET(req), calls };
  } finally {
    for (const name of names) { if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name]; }
  }
}

test("unauthorized, preview, disabled, manual and off-hours calls perform no database or provider work", async () => {
  for (const [options, status] of [[{ unauthorized: true }, 401], [{ env: { VERCEL_ENV: "preview" } }, 409], [{ env: { READOUT_SPECIALTY_PUBLISH_ENABLED: "0" } }, 200], [{ manual: true }, 409], [{ offHours: true }, 200]]) {
    const result = await exercise(options);
    assert.equal(result.response.status, status);
    assert.deepEqual(result.calls, []);
  }
});

test("database preflight and approved engine must pass before acquiring a lease or building", async () => {
  for (const preflight of [{ ready: false, reason: "edge_area_lease_active" }, { ready: true, control: { ...approved, approved_engine_sha: "d".repeat(40) } }]) {
    const result = await exercise({ preflight });
    assert.ok(!result.calls.some(call => ["startJob", "build"].includes(call[0])));
    assert.ok(!result.calls.some(call => call[1] === "acquire_ops_job_lease"));
  }
});

test("a busy batch or any previously attempted cycle cannot repeat provider work", async () => {
  for (const options of [{ lease: false }, { existing: { id: "old", status: "failed", summary: {} } }, { existing: { id: "old", status: "succeeded", summary: { published: true } } }]) {
    const result = await exercise(options);
    assert.equal(result.response.status, 200);
    assert.ok(!result.calls.some(call => call[0] === "build"));
  }
});

test("approved invocation builds once and relies on the atomic database success receipt", async () => {
  const result = await exercise();
  assert.equal(result.response.body.published, true);
  assert.deepEqual(result.calls.filter(call => call[0] === "build"), [["build", "publish"]]);
  assert.ok(result.calls.some(call => call[1] === "release_ops_job_lease"));
});

test("adapter errors only mark still-running jobs failed and release the lease", async () => {
  const result = await exercise({ buildError: true });
  assert.equal(result.response.status, 500);
  assert.ok(result.calls.some(call => call[0] === "eq" && call[1] === "status" && call[2] === "running"));
  assert.ok(result.calls.some(call => call[1] === "release_ops_job_lease"));
});

test("a durable publish receipt wins over a post-commit adapter error", async () => {
  const result = await exercise({ buildError: true, durable: { status: "succeeded", summary: { published: true, sourceRunId: "scheduled-2026091606" } } });
  assert.equal(result.response.status, 200);
  assert.equal(result.response.body.published, true);
  assert.equal(result.response.body.publicationReceiptRecovered, true);
  assert.ok(result.calls.some(call => call[0] === "update" && call[1]?.status === "succeeded"));
  assert.ok(!result.calls.some(call => call[0] === "update" && call[1]?.status === "failed"));
});
