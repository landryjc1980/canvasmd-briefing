import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/api/readout-cache/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ changed = false, warmFailure = false, loggingFailure = false } = {}) {
  const calls = [];
  const mocks = {
    "next/server": { NextResponse: { json: (body, init) => new Response(JSON.stringify(body), init) } },
    "next/cache": { revalidateTag: (tag) => calls.push(["invalidate", tag]) },
    "@/lib/readoutWindowServer": {
      READOUT_WINDOW_CACHE_TAG: "test-readout-cache",
      warmReadoutWindowCache: async (options) => {
        calls.push(["warm", options]);
        return Array.from({ length: 16 }, (_, index) => warmFailure && index === 3
          ? { stale: true, error: "source timeout" }
          : { stale: false });
      },
    },
    "@/lib/readoutEditionArchive": {
      mergeCurrentReadoutEditionInsertions: async () => { calls.push(["merge"]); return { changed }; },
    },
    "@/lib/readoutPipelineJob": {
      readoutTriggerKind: () => "manual",
      startReadoutPipelineJob: async () => {
        calls.push(["job-start"]);
        if (loggingFailure) throw new Error("job receipt unavailable");
        return {
          stage: async (stage, work) => { calls.push(["stage", stage]); return work(new AbortController().signal); },
          succeed: async () => { calls.push(["job-succeed"]); },
          fail: async () => { calls.push(["job-fail"]); },
        };
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    assert.ok(name in mocks, `Unexpected route dependency: ${name}`);
    return mocks[name];
  }, module, module.exports);
  return { calls, GET: module.exports.GET };
}

async function request(h, query, authorized = true) {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-only-cache-refresh-secret";
  try {
    return await h.GET({
      headers: new Headers(authorized ? { authorization: "Bearer test-only-cache-refresh-secret" } : {}),
      nextUrl: new URL(`https://example.test/api/readout-cache${query}`),
    });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

test("source-only cache refresh still requires the existing cron authorization", async () => {
  const h = harness();
  const response = await request(h, "?refreshOnly=1", false);
  assert.equal(response.status, 401);
  assert.deepEqual(h.calls, []);
});

test("source-only refresh bypasses stale source cache and never changes the saved edition", async () => {
  const h = harness({ changed: true });
  const response = await request(h, "?refreshOnly=1");
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls.filter((call) => !["job-start", "job-succeed", "stage"].includes(call[0])).map(([kind, value]) => kind === "warm" ? [kind, { freshSource: value?.freshSource }] : value === undefined ? [kind] : [kind, value]),
    [["invalidate", "test-readout-cache"], ["warm", { freshSource: true }]]);
  assert.deepEqual((await response.json()).edition, { changed: false, skipped: "cache-refresh-only" });
});

test("the scheduled refresh keeps its existing insertion workflow", async () => {
  const h = harness({ changed: true });
  const response = await request(h, "");
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls.filter((call) => !["job-start", "job-succeed", "stage"].includes(call[0])).map(([kind, value]) => kind === "warm" ? [kind, { freshSource: value?.freshSource }] : value === undefined ? [kind] : [kind, value]), [
    ["invalidate", "test-readout-cache"], ["warm", { freshSource: undefined }], ["merge"],
    ["invalidate", "test-readout-cache"], ["warm", { freshSource: undefined }],
  ]);
});


test("a partial 16-window warm is terminally failed after the independent attempts complete", async () => {
  const h = harness({ warmFailure: true });
  const response = await request(h, "");
  assert.equal(response.status, 500);
  assert.ok(h.calls.some((call) => call[0] === "warm"));
  assert.ok(h.calls.some((call) => call[0] === "job-fail"));
  assert.ok(!h.calls.some((call) => call[0] === "merge"));
});

test("a missing start receipt fails closed before cache invalidation or source work", async () => {
  const h = harness({ loggingFailure: true });
  const response = await request(h, "");
  assert.equal(response.status, 500);
  assert.deepEqual(h.calls, [["job-start"]]);
});
