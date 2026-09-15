#!/usr/bin/env node
// Re-run the CURRENT Node adapter over retained database/provider responses.
// No network fallback, database writes, or provider calls are possible.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { runSpecialtyBatch } from "../lib/readoutSpecialtyShadow.mjs";
import { SPECIALTY_AREAS, assertCompleteSpecialtyBatch, comparableSpecialty, contentHash, stableJson } from "../lib/readoutSpecialtyComparison.mjs";

const [inputDirectory, outputDirectory] = process.argv.slice(2);
if (!path.isAbsolute(inputDirectory ?? "") || !path.isAbsolute(outputDirectory ?? "") || path.resolve(inputDirectory) === path.resolve(outputDirectory)) {
  throw new Error("Usage: replay-specialty-node.mjs /private/captured-inputs /private/new-report-directory");
}
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const metadata = JSON.parse(await readFile(path.join(inputDirectory, "metadata.json"), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../lib/generated/specialtyBriefingBuilder.manifest.json", import.meta.url), "utf8"));
if (metadata.engineInfo.engineSha256 !== manifest.engineSha256 || metadata.engineInfo.backendSha !== manifest.backendSha) throw new Error("Captured fixture engine does not match the current pinned engine.");
const inputBytes = await readFile(path.join(inputDirectory, "inputs.jsonl"));
const inputSha256 = createHash("sha256").update(inputBytes).digest("hex");
const fixtures = new Map(inputBytes.toString("utf8").trim().split("\n").map(line => { const row = JSON.parse(line); return [row.key, row.response]; }));
const originalDate = Date, frozen = Date.parse(metadata.now);
if (!Number.isFinite(frozen)) throw new Error("Invalid captured clock.");
globalThis.Date = class extends originalDate {
  constructor(...args) { super(...(args.length ? args : [frozen])); }
  static now() { return frozen; }
};
globalThis.fetch = async () => { throw new Error("Network is forbidden in frozen-input replay."); };
const missing = [], used = new Set(), reports = [];
const expected = { sourceRunId: metadata.sourceRunId, engineSha: manifest.backendSha, builtAt: metadata.now };
const captured = new Map(await Promise.all(SPECIALTY_AREAS.map(async area => [area, JSON.parse(await readFile(path.join(inputDirectory, `node-${area}.json`), "utf8"))])));
// Exercise both adapters with fixtures. This synthetic control is local only:
// no approval or publication receipt is ever written to a real database.
const fixtureControl = { enabled: true, approved_engine_sha: manifest.backendSha, approved_engine_input_sha256: manifest.engineSha256,
  review_evidence: [{ kind: "offline-test-fixture", artifact: inputDirectory, sha256: inputSha256, acceptedAt: metadata.now, acceptedBy: "offline fixture, not production approval" }] };
try {
  for (const mode of ["shadow", "publish"]) {
    if (mode === "publish" && metadata.proseMode !== "live") continue;
    const outputs = [], writes = [];
    const fixtureFetch = async (input, init = {}) => {
      const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
      const method = String(init.method ?? "GET").toUpperCase(), headers = new Headers(init.headers), body = typeof init.body === "string" ? init.body : "";
      const key = JSON.stringify([method, url.pathname + url.search, body, headers.get("range"), headers.get("prefer"), headers.get("accept")]);
      if (method === "POST" && ["/rest/v1/readout_specialty_source_runs", "/rest/v1/readout_specialty_source_outputs"].includes(url.pathname)
        || method === "PATCH" && url.pathname === "/rest/v1/readout_specialty_source_runs") {
        writes.push({ method, path: url.pathname });
        return new Response(null, { status: 201 });
      }
      if (method === "POST" && url.pathname === `/rest/v1/rpc/finish_readout_specialty_${mode}`) {
        assertCompleteSpecialtyBatch(outputs, expected);
        const summary = mode === "publish" ? JSON.parse(body).p_summary : {};
        return new Response(JSON.stringify({ ...summary, areas: 7, sourceRunId: expected.sourceRunId, engineSha: manifest.backendSha, published: mode === "publish", durationMs: 0 }));
      }
      const fixture = fixtures.get(key);
      if (!fixture) { missing.push({ mode, method, path: url.pathname }); throw new Error(`Frozen input missing: ${method} ${url.pathname}`); }
      used.add(key);
      return new Response(fixture.status === 204 ? null : fixture.body, fixture);
    };
    await runSpecialtyBatch({ url: "https://replay.invalid", key: "replay-only", engineInfo: manifest, sourceRunId: metadata.sourceRunId, now: new Date(metadata.now), mode,
      publicationControl: fixtureControl, allowCapturedRecap: metadata.proseMode === "capture_only", fetchImpl: fixtureFetch,
      job: { id: metadata.runId, stage: async (_name, work) => work(AbortSignal.timeout(260_000)) },
      onOutput: row => { outputs.push(row); },
    });
    const areas = outputs.map(row => {
      const before = captured.get(row.area), nodeHash = contentHash(comparableSpecialty(row.data));
      return { area: row.area, equal: nodeHash === contentHash(comparableSpecialty(before.data)), effectsEqual: stableJson(row.effects) === stableJson(before.effects), nodeHash };
    });
    const report = { mode, areas, privateReceiptWritesIntercepted: writes.length };
    reports.push(report);
    console.log(JSON.stringify(report));
  }
} finally { globalThis.Date = originalDate; }
const report = { checkedAt: new originalDate().toISOString(), inputDirectory, inputSha256, capturedAt: metadata.now, proseMode: metadata.proseMode, engineSha: manifest.backendSha, engineInputSha256: manifest.engineSha256,
  networkAllowed: false, actualDatabaseWrites: 0, providerCalls: 0, historicalReviewStatusChanged: false,
  fixtureCount: fixtures.size, usedFixtures: used.size, missing, reports,
  ok: missing.length === 0 && reports.length > 0 && reports.every(report => report.areas.length === 7 && report.areas.every(area => area.equal && area.effectsEqual)),
};
await writeFile(path.join(outputDirectory, "node-replay-report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
if (!report.ok) process.exitCode = 1;
