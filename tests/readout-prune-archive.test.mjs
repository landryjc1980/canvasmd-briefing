import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../app/heroPost.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function load() {
  const mocks = {
    "@/lib/postId": { heroTok: (id) => id },
    "@/app/heroEvidence": { sliceBriefForCard: () => ({}) },
    "@/lib/readoutWindowServer": { supabaseApiKeyHeaders: (key) => ({ apikey: key }) },
    "./archiveCard": { archiveCardForArticle: async () => {} },
  };
  const env = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = "https://db.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  try {
    const module = { exports: {} };
    new Function("require", "module", "exports", code)((name) => { assert.ok(name in mocks, `Unexpected ${name}`); return mocks[name]; }, module, module.exports);
    return module.exports;
  } finally {
    if (env.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = env.url;
    if (env.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = env.key;
  }
}

test("pruneArchive deletes old cards but never edition rows", async () => {
  const { pruneArchive } = load();
  const calls = [];
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), method: init?.method }); return new Response(JSON.stringify([{}, {}]), { status: 200 }); };
  try {
    assert.equal(await pruneArchive(), 2);
  } finally {
    globalThis.fetch = oldFetch;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "DELETE");
  const url = new URL(calls[0].url);
  assert.equal(url.pathname, "/rest/v1/readout_posts");
  assert.match(url.searchParams.get("last_seen") ?? "", /^lt\./);
  assert.equal(url.searchParams.get("or"), "(kind.is.null,kind.neq.edition)");
});
