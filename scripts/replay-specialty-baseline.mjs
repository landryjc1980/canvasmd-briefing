#!/usr/bin/env node
// Runs the pre-extraction engine against the canary's frozen DB/provider
// responses. Network is forbidden. This is a test harness, not a second engine.
import { build } from "esbuild";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { SPECIALTY_AREAS, comparableSpecialty, contentHash, stableJson } from "../lib/readoutSpecialtyComparison.mjs";

const [directory, backend, baselineSha] = process.argv.slice(2);
const diagnosisArea = process.argv.find(arg => arg.startsWith("--diagnose="))?.split("=")[1];
if (diagnosisArea && !SPECIALTY_AREAS.includes(diagnosisArea)) throw new Error("Invalid diagnosis area");
const networkFetch = globalThis.fetch;
if (!directory || !backend || !/^[a-f0-9]{40}$/.test(baselineSha ?? "")) throw new Error("Usage: replay-specialty-baseline.mjs /private/canary /path/to/backend BASELINE_SHA");
const metadata = JSON.parse(await readFile(path.join(directory, "metadata.json"), "utf8"));
const receipts = (await readFile(path.join(directory, "inputs.jsonl"), "utf8")).trim().split("\n").map(line => JSON.parse(line));
const fixtures = new Map(receipts.map(row => [row.key, row.response]));
const priors = receipts.find(row => row.request.path.startsWith("/rest/v1/briefing_snapshots?"));
const priorRows = JSON.parse(priors.response.body);
const states = receipts.find(row => row.request.path.startsWith("/rest/v1/briefing_build_state?"));
const windows = Object.fromEntries(JSON.parse(states.response.body).map(row => [row.area, row.window_days]));
const missing = [], writes = [], used = new Set();
const frozen = Date.parse(metadata.now), OriginalDate = Date;
globalThis.Date = class extends OriginalDate { constructor(...args) { super(...(args.length ? args : [frozen])); } static now() { return frozen; } };
globalThis.Deno = { env: { get: name => ({ SUPABASE_URL: "https://replay.invalid", SUPABASE_SERVICE_ROLE_KEY: "replay-only", BRIEF_TRACE: "0" })[name] }, memoryUsage: () => process.memoryUsage() };
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(String(input)), method = String(init.method ?? "GET").toUpperCase(), headers = new Headers(init.headers), body = typeof init.body === "string" ? init.body : "";
  const key = JSON.stringify([method, url.pathname + url.search, body, headers.get("range"), headers.get("prefer"), headers.get("accept")]);
  // Old engine writes are captured, never applied. Node collect mode records the
  // corresponding effects. Reads of the pre-existing hero history still replay.
  if (["POST", "DELETE", "PATCH"].includes(method) && ["/rest/v1/trial_story_ledger", "/rest/v1/briefing_hero_pool"].includes(url.pathname)) {
    writes.push({ method, path: url.pathname + url.search, body: body ? JSON.parse(body) : null });
    return new Response(null, { status: 201 });
  }
  // The new host injects one captured prior snapshot; old code queried it itself.
  if (method === "GET" && url.pathname === "/rest/v1/briefing_snapshots" && url.searchParams.has("area")) {
    const area = url.searchParams.get("area").replace(/^eq\./, "");
    const row = priorRows.find(row => row.area === area);
    return new Response(JSON.stringify(row ? [{ data: row.data, generated_at: row.generated_at }] : []), { headers: { "content-type": "application/json" } });
  }
  let response = fixtures.get(key);
  if (!response && method === "GET" && url.pathname === "/rest/v1/x_posts_product"
      && url.searchParams.get("select") === "id,x_post_id,content,rt_tweet_id,quoted_tweet_id,x_sources(id,name,x_handle,source_type)") {
    // The Node transport needs bounded ID queries because the original giant
    // response's Content-Location header exceeds Node's header limit. Reassemble
    // that exact requested union from captured batches for the old algorithm.
    const parseIds = value => value?.startsWith("in.(") ? value.slice(4, -1).split(",") : [];
    const wanted = new Set(parseIds(url.searchParams.get("id"))), covered = new Set(), values = new Map();
    for (const receipt of receipts) {
      const candidate = new URL(receipt.request.path, "https://replay.invalid");
      if (receipt.request.method !== "GET" || candidate.pathname !== url.pathname || candidate.searchParams.get("select") !== url.searchParams.get("select")) continue;
      const ids = parseIds(candidate.searchParams.get("id"));
      if (!ids.length || !ids.every(id => wanted.has(id))) continue;
      for (const id of ids) covered.add(id);
      for (const row of JSON.parse(receipt.response.body)) values.set(row.id, row);
    }
    if (wanted.size && covered.size === wanted.size && values.size <= 1000) response = { status: 200, body: JSON.stringify([...values.values()]), headers: { "content-type": "application/json" } };
  }
  if (!response && method === "GET" && url.pathname === "/rest/v1/briefing_hero_pool" && url.searchParams.get("offset") === "3") {
    // Old apply mode has already inserted the newest pool. The collect engine
    // reads the equivalent pre-insert slice, shifted by one position.
    const shifted = new URL(url); shifted.searchParams.set("offset", "2");
    response = fixtures.get(JSON.stringify([method, shifted.pathname + shifted.search, body, headers.get("range"), headers.get("prefer"), headers.get("accept")]));
  }
  if (!response) {
    missing.push({ method, path: url.pathname + url.search, body });
    if (diagnosisArea && ["GET", "HEAD"].includes(method) && url.pathname.startsWith("/rest/v1/") && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      // Diagnosis may inspect an uncaptured database read only. Provider and
      // mutation paths can never reach this network fallback.
      try {
        const real = await networkFetch(process.env.SUPABASE_URL + url.pathname + url.search, { ...init, headers: { ...Object.fromEntries(headers), apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }, signal: AbortSignal.timeout(15_000) });
        console.log(JSON.stringify({ diagnosis: diagnosisArea, path: url.pathname, urlLength: url.href.length, status: real.status }));
        return real;
      } catch (error) { console.log(JSON.stringify({ diagnosis: diagnosisArea, path: url.pathname, urlLength: url.href.length, error: error.message, cause: error.cause?.code ?? error.cause?.message })); throw error; }
    }
    throw new Error(`Frozen input missing: ${method} ${url.pathname}`);
  }
  used.add(key);
  return new Response(response.status === 204 ? null : response.body, response);
};
globalThis.__readoutReplayDb = createClient("https://replay.invalid", "replay-only", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: globalThis.fetch } });
globalThis.__readoutReplayBuildInfo = { sha: metadata.engineInfo.backendSha, dirty: false, stampedAt: metadata.now };
const original = execFileSync("git", ["show", `${baselineSha}:supabase/functions/briefing/index.ts`], { cwd: backend, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
const ast = ts.createSourceFile("index.ts", original, ts.ScriptTarget.Latest, true);
const edits = [];
for (const statement of ast.statements) {
  if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.includes("esm.sh/@supabase")) edits.push([statement.getFullStart(), statement.end, ""]);
  if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.endsWith("/buildInfo.ts")) edits.push([statement.getFullStart(), statement.end, "\nconst BUILD_INFO = globalThis.__readoutReplayBuildInfo;\n"]);
  if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "sb")) edits.push([statement.getFullStart(), statement.end, "\nconst sb = globalThis.__readoutReplayDb;\n"]);
  if (ts.isExpressionStatement(statement) && statement.expression.getText(ast).startsWith("Deno.serve(")) edits.push([statement.getFullStart(), statement.end, ""]);
}
let entry = original;
for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) entry = entry.slice(0, start) + replacement + entry.slice(end);
entry += "\nexport { buildArea };\n";
const bundlePath = path.join(directory, "baseline-engine.mjs");
await build({ stdin: { contents: entry, sourcefile: "baseline-entry.ts", resolveDir: path.join(backend, "supabase/functions/briefing"), loader: "ts" }, outfile: bundlePath, bundle: true, format: "esm", platform: "node", target: "node22", plugins: [{ name: "frozen-git-inputs", setup(plugin) {
  plugin.onLoad({ filter: /\.ts$/ }, args => ({ contents: execFileSync("git", ["show", `${baselineSha}:${path.relative(backend, args.path)}`], { cwd: backend, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }), loader: "ts" }));
} }] });
const { buildArea } = await import(pathToFileURL(bundlePath));
const results = [];
for (const area of diagnosisArea ? [diagnosisArea] : SPECIALTY_AREAS) {
  if (diagnosisArea) { await buildArea(area, { recentDays: windows[area], sourceRunId: metadata.sourceRunId }); break; }
  const output = JSON.parse(await readFile(path.join(directory, `node-${area}.json`), "utf8"));
  const writesStart = writes.length;
  const baseline = await buildArea(area, { recentDays: windows[area], sourceRunId: metadata.sourceRunId });
  const left = comparableSpecialty(output.data), right = comparableSpecialty(baseline);
  const changedFields = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(key => stableJson(left[key]) !== stableJson(right[key]));
  const areaWrites = writes.slice(writesStart);
  const ledger = areaWrites.filter(row => row.path === "/rest/v1/trial_story_ledger").flatMap(row => Array.isArray(row.body) ? row.body : [row.body]);
  const pools = areaWrites.filter(row => row.method === "POST" && row.path === "/rest/v1/briefing_hero_pool").flatMap(row => Array.isArray(row.body) ? row.body : [row.body]);
  const deletes = areaWrites.filter(row => row.method === "DELETE").map(row => { const url = new URL(row.path, "https://replay.invalid"); return { area: url.searchParams.get("area").replace(/^eq\./, ""), generatedAt: url.searchParams.get("generated_at").replace(/^eq\./, "") }; });
  const effectsEqual = stableJson(ledger) === stableJson(output.effects.trialLedgerInserts) && stableJson(pools) === stableJson(output.effects.heroPoolInserts) && stableJson(deletes) === stableJson(output.effects.heroPoolDeletes);
  const result = { area, equal: changedFields.length === 0, effectsEqual, changedFields, nodeHash: contentHash(left), baselineHash: contentHash(right) };
  results.push(result);
  await writeFile(path.join(directory, `baseline-${area}.json`), JSON.stringify(baseline), { mode: 0o600 });
  console.log(JSON.stringify(result));
}
const report = { baselineSha, nodeEngineSha: metadata.engineInfo.backendSha, builtAt: metadata.now, proseMode: metadata.proseMode ?? "live", ok: !diagnosisArea && missing.length === 0 && results.every(row => row.equal && row.effectsEqual), fixtureCount: fixtures.size, usedFixtures: used.size, missing, areas: results };
await writeFile(path.join(directory, "parity-report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
if (!report.ok) process.exitCode = 1;
