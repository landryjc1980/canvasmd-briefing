import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/readout-prearchive/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ prepublication = { editionDate: "2026-09-11", prepublished: ["All"], skipped: null } } = {}) {
  const calls = [];
  const job = {
    stage: async (stage, work) => { calls.push(["stage", stage]); return work(new AbortController().signal); },
    succeed: async () => calls.push(["succeed"]),
    skip: async () => calls.push(["skip"]),
    fail: async () => calls.push(["fail"]),
  };
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
    "@/lib/readoutEditionArchive": { prepublishCurrentReadoutEdition: async () => prepublication },
    "@/lib/readoutPipelineJob": { readoutTriggerKind: () => "scheduled", startReadoutPipelineJob: async () => job },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => { assert.ok(name in mocks, `Unexpected ${name}`); return mocks[name]; }, module, module.exports);
  return { calls, GET: module.exports.GET };
}

async function request(h) {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "secret";
  try {
    return await h.GET({ headers: new Headers({ authorization: "Bearer secret" }) });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

test("out-of-hours prearchive is skipped rather than recorded as successful", async () => {
  const h = harness({ prepublication: { editionDate: "2026-09-11", prepublished: [], skipped: "outside-5am-et" } });
  assert.equal((await request(h)).status, 200);
  assert.ok(h.calls.some(([kind]) => kind === "skip"));
  assert.ok(!h.calls.some(([kind]) => kind === "succeed"));
});

test("a canonical prepublication remains a successful job", async () => {
  const h = harness();
  assert.equal((await request(h)).status, 200);
  assert.ok(h.calls.some(([kind]) => kind === "succeed"));
  assert.ok(!h.calls.some(([kind]) => kind === "skip"));
});
