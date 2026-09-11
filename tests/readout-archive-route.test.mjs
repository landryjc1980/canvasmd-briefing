import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/readout-archive/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
function harness({ hour = 6, canonicalError = null, mismatch = false, staleEvidence = false } = {}) {
  const calls = [];
  const job = {
    stage: async (stage, work) => { calls.push(["stage", stage]); return work(new AbortController().signal); },
    succeed: async () => calls.push(["succeed"]), skip: async () => calls.push(["skip"]), fail: async () => calls.push(["fail"]),
  };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
    "next/cache": { revalidateTag: () => calls.push(["invalidate"]) },
    "@/lib/readoutEditionArchive": {
      archiveCurrentReadoutEdition: async () => { if (canonicalError) throw canonicalError; return { editionDate: "2026-09-11", archived: ["All"], selectionVersion: "readout-v1-a" }; },
      rebuildCurrentReadoutEdition: async () => ({ editionDate: "2026-09-11", rebuilt: ["All"], selectionVersion: "readout-v1-a" }),
    },
    "@/lib/readoutWindowServer": { READOUT_WINDOW_CACHE_TAG: "tag", warmReadoutWindow: async () => ({ stale: staleEvidence, editionDate: mismatch ? "2026-09-10" : "2026-09-11", selectionVersion: "readout-v1-a" }) },
    "@/app/briefing-preview/readoutRequest": { etEditionHour: () => hour },
    "@/lib/readoutPipelineJob": { readoutTriggerKind: () => "scheduled", startReadoutPipelineJob: async () => { calls.push(["job"]); return job; } },
  };
  const module = { exports: {} }; new Function("require", "module", "exports", code)((name) => { assert.ok(name in mocks, `Unexpected ${name}`); return mocks[name]; }, module, module.exports);
  return { calls, GET: module.exports.GET };
}
async function request(h, authorized = true) { const old = process.env.CRON_SECRET; process.env.CRON_SECRET = "secret"; try { return await h.GET({ headers: new Headers(authorized ? { authorization: "Bearer secret" } : {}), nextUrl: new URL("https://x.test/api/readout-archive") }); } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; } }
test("unauthorized archive makes no job or publication write", async () => { const h = harness(); assert.equal((await request(h, false)).status, 401); assert.deepEqual(h.calls, []); });
test("existing canonical path only performs bounded All/today verification", async () => { const h = harness(); assert.equal((await request(h)).status, 200); assert.deepEqual(h.calls.map((x) => x[0]), ["job", "stage", "stage", "invalidate", "succeed"]); });
test("canonical stage failure is recorded terminally", async () => { const h = harness({ canonicalError: new Error("missing canonical") }); assert.equal((await request(h)).status, 500); assert.ok(h.calls.some((x) => x[0] === "fail")); });
test("date or selection mismatch fails the rollover", async () => { const h = harness({ mismatch: true }); assert.equal((await request(h)).status, 500); assert.ok(h.calls.some((x) => x[0] === "fail")); });
test("outside ET slot is skipped rather than healthy", async () => { const h = harness({ hour: 5 }); assert.equal((await request(h)).status, 200); assert.ok(h.calls.some((x) => x[0] === "skip")); assert.ok(!h.calls.some((x) => x[0] === "succeed")); });

test("stale evidence still verifies the matching durable canonical edition", async () => { const h = harness({ staleEvidence: true }); assert.equal((await request(h)).status, 200); assert.ok(h.calls.some((x) => x[0] === "succeed")); });
