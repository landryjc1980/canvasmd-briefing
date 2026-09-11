import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const code = ts.transpileModule(fs.readFileSync(new URL("../lib/readoutEditionArchive.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const audit = { scope: "source-admitted-candidates", papers: [{ id: "archive-a", title: "A", url: "https://a", eligible: true, reason: "current_action_gate", clinicianSharers: 5, floor: 3 }] };
function harness({ auditValue = audit, auditStatus = 201, abortAfterAudit = false } = {}) {
  const writes = []; const controller = new AbortController();
  const snapshot = { schemaVersion: 2, area: "All", editionDate: "2026-09-11", generatedAt: "2026-09-11T09:00:00Z", developments: [{ development: { id: "archive-a" } }], relevant: [], listen: [], regulatoryCards: [], designationCards: [], selectionVersion: "readout-v1-a" };
  const mocks = {
    "server-only": {},
    "@/app/briefing-preview/edition": { EDITION_AREAS: ["All"], archivedEditorialArticle: (x) => ({ id: x.id }) },
    "@/app/briefing-preview/editionSnapshot": { buildReadoutEditionSnapshot: () => snapshot, appearedInMorningEdition: () => false, isReadoutEditionSnapshot: (x) => !!x?.schemaVersion, mergeReadoutEditionSnapshot: () => snapshot },
    "@/app/briefing-preview/readoutRequest": { activeReadoutEditionDate: () => "2026-09-11", etEditionDate: () => "2026-09-11", etEditionHour: () => 5, hasFrozenPrepublishedEdition: () => false, hasScheduledReadoutSourceRun: () => true, prepublicationEditionDate: () => "2026-09-11", scheduledReadoutSourceRunId: () => "run" },
    "@/app/briefing-preview/editionHistory": { canonicalReadoutEditionSnapshot: () => snapshot, readoutEditionForArea: () => snapshot },
    "@/lib/readoutWindowServer": { fetchFreshReadoutWindowForPrepublication: async (_a, _d, _anchor, o) => ({ stale: false, attentionWindow: { startAt: "x", editionDate: "2026-09-11", kind: "edition" }, selectionAudit: o.includeSelectionAudit ? auditValue : undefined, cards: [{ id: "archive-a" }], moreCards: [] }), fetchFreshReadoutWindowForInsertions: async () => ({}), supabaseApiKeyHeaders: () => ({ apikey: "k" }), withReadoutSelectionVersion: async (x) => x },
    "@/lib/readoutCandidateRefresh": { refreshReadoutCandidatesForEdition: async () => ({ runId: "run", generatedAt: "2026-09-11T09:00:00Z" }), assertReadoutCandidateBuildUnchanged: async () => {} },
    "@/lib/readoutAttention": { readoutAttentionAnchor: () => ({ startAt: "x", editionDate: "2026-09-11", kind: "edition" }) },
  };
  const mod = { exports: {} }; new Function("require", "module", "exports", code)((name) => { assert.ok(name in mocks, name); return mocks[name]; }, mod, mod.exports);
  globalThis.fetch = async (url, init = {}) => { const path = String(url); if (init.method === "POST") { writes.push(path); if (path.includes("selection_audits")) { if (abortAfterAudit) controller.abort(); return new Response("", { status: auditStatus }); } return new Response("", { status: 201 }); } return new Response(JSON.stringify([]), { status: 200 }); };
  return { prepublish: mod.exports.prepublishCurrentReadoutEdition, writes, controller };
}
async function run(h, signal) { const oldU = process.env.SUPABASE_URL, oldK = process.env.SUPABASE_SERVICE_ROLE_KEY; process.env.SUPABASE_URL = "https://db"; process.env.SUPABASE_SERVICE_ROLE_KEY = "k"; try { return await h.prepublish(new Date("2026-09-11T09:00:00Z"), signal); } finally { if (oldU === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldU; if (oldK === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldK; } }
test("selection audit receipt is written before canonical publication", async () => { const h = harness(); await run(h); assert.deepEqual(h.writes.map((x) => x.includes("selection_audits") ? "audit" : "canonical"), ["audit", "canonical"]); });
test("audit HTTP failure prevents canonical publication", async () => { const h = harness({ auditStatus: 503 }); await assert.rejects(run(h)); assert.deepEqual(h.writes.map((x) => x.includes("selection_audits") ? "audit" : "canonical"), ["audit"]); });
test("missing audit receipt prevents canonical publication", async () => { const h = harness({ auditValue: null }); await assert.rejects(run(h), /missing|malformed/i); assert.deepEqual(h.writes, []); });
test("abort after audit response prevents canonical publication", async () => { const h = harness({ abortAfterAudit: true }); await assert.rejects(run(h, h.controller.signal), /aborted/i); assert.deepEqual(h.writes.map((x) => x.includes("selection_audits") ? "audit" : "canonical"), ["audit"]); });
