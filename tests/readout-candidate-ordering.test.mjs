import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { readoutAttentionAnchor } from "../lib/readoutAttention.ts";

const code = ts.transpileModule(
  fs.readFileSync(new URL("../lib/readoutEditionArchive.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

const AREAS = ["All", "GU", "Breast", "Lung", "GI", "Heme", "Skin", "Gyn"];
const sixAm = new Date("2026-09-11T10:00:00.000Z");
const fiveAm = new Date("2026-09-11T09:00:00.000Z");
process.env.SUPABASE_URL ??= "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

function savedEdition(date = "2026-09-11") {
  return {
    schemaVersion: 2, area: "All", editionDate: date, generatedAt: "2026-09-11T09:30:00.000Z",
    selectionVersion: `readout-v1-${"a".repeat(64)}`, developments: [], relevant: [], listen: [],
    regulatoryCards: [], designationCards: [],
  };
}

function harness({ existing = null, refreshError = null, changedAfterRead = false, attentionMismatch = false } = {}) {
  const calls = [];
  const writes = [];
  let refreshed = false;
  const freshPayload = { stale: false, cards: [], episodes: [], regulatoryCards: [], designationCards: [] };
  const fetch = async (url, init = {}) => {
    const method = init.method ?? "GET";
    calls.push(["db", method, String(url)]);
    if (String(url).includes("readout_posts?select=card&tok=")) return Response.json(existing ? [{ card: existing }] : []);
    if (String(url).includes("briefing_snapshots?select=area,data,generated_at")) {
      return Response.json(AREAS.filter((area) => area !== "All").map((area) => ({
        area, data: { build: { sourceRunId: "scheduled-test" } }, generated_at: "2026-09-11T09:30:00.000Z",
      })));
    }
    if (String(url).includes("readout_posts?select=card")) return Response.json([]);
    if (method === "POST") {
      writes.push(JSON.parse(init.body));
      return new Response(null, { status: 201 });
    }
    return Response.json([]);
  };
  const candidateBuild = { runId: "candidate-run", requestId: 7, generatedAt: "2026-09-11T09:59:00.000Z" };
  const mocks = {
    "server-only": {},
    "@/lib/readoutAttention": { readoutAttentionAnchor },
    "@/app/briefing-preview/edition": { EDITION_AREAS: AREAS, archivedEditorialArticle: (card) => ({ id: card.id }) },
    "@/app/briefing-preview/editionSnapshot": {
      isReadoutEditionSnapshot: (value) => !!value && value.schemaVersion === 2,
      buildReadoutEditionSnapshot: (area, _payload, now, _previous, editionDate) => ({
        ...savedEdition(editionDate), area, generatedAt: now.toISOString(), selectionVersion: undefined,
      }),
      mergeReadoutEditionSnapshot: (snapshot) => snapshot,
      preparedMorningReadoutPayload: (payload) => payload,
      appearedInMorningEdition: () => false,
    },
    "@/app/briefing-preview/readoutRequest": {
      activeReadoutEditionDate: () => "2026-09-11",
      etEditionDate: () => "2026-09-11",
      etEditionHour: (now) => now.getTime() === fiveAm.getTime() ? 5 : 6,
      prepublicationEditionDate: () => "2026-09-11",
      hasFrozenPrepublishedEdition: (value, date) => value?.schemaVersion === 2 && value?.area === "All" && value?.editionDate === date && typeof value?.selectionVersion === "string",
      hasScheduledReadoutSourceRun: () => true,
      scheduledReadoutSourceRunId: () => "scheduled-test",
    },
    "@/app/briefing-preview/editionHistory": {
      canonicalReadoutEditionSnapshot: (snapshots) => snapshots.find((snapshot) => snapshot.area === "All") ?? null,
      readoutEditionForArea: (snapshot) => snapshot,
    },
    "@/lib/readoutWindowServer": {
      fetchFreshReadoutWindowForPrepublication: async (area, editionDate, attentionAnchor, options) => {
        calls.push(["fresh", area]);
        assert.equal(refreshed, true, "fresh source reads must wait for candidate refresh");
        assert.deepEqual(attentionAnchor, readoutAttentionAnchor(editionDate));
        assert.deepEqual(options.candidateBuild, candidateBuild, "publisher preparation must use the just-completed candidate build");
        return { ...freshPayload, selectionAudit: area === "All" ? { scope: "source-admitted-candidates", papers: [] } : undefined, attentionWindow: attentionMismatch ? null : {
          startAt: attentionAnchor.startAt, editionDate, timeZone: attentionAnchor.timeZone, kind: "edition",
        } };
      },
      getCachedReadoutWindow: async (area) => {
        calls.push(["cached", area]);
        throw new Error("constructor must not use cached source reads");
      },
      supabaseApiKeyHeaders: () => ({ authorization: "Bearer test" }),
      withReadoutSelectionVersion: async (snapshot) => ({ ...snapshot, selectionVersion: "readout-v1-test" }),
    },
    "@/lib/readoutCandidateRefresh": {
      refreshReadoutCandidatesForEdition: async () => {
        calls.push(["candidate-refresh"]);
        if (refreshError) throw refreshError;
        await Promise.resolve();
        refreshed = true;
        return candidateBuild;
      },
      assertReadoutCandidateBuildUnchanged: async (_environment, build) => {
        calls.push(["candidate-assert", build.runId]);
        if (changedAfterRead) throw new Error("Readout candidates changed during selection; the daily edition was not saved.");
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", code)((name) => {
    assert.ok(name in mocks, `Unexpected archive dependency: ${name}`);
    return mocks[name];
  }, module, module.exports, fetch);
  return { calls, writes, candidateBuild, ...module.exports };
}

test("new 6am canonical editions await candidates before every fresh source read and never use cached reads", async () => {
  const h = harness();
  const result = await h.archiveCurrentReadoutEdition(sixAm);
  assert.deepEqual(result, { editionDate: "2026-09-11", archived: ["All"], skipped: null, selectionVersion: "readout-v1-test" });
  const refresh = h.calls.findIndex(([kind]) => kind === "candidate-refresh");
  const firstFresh = h.calls.findIndex(([kind]) => kind === "fresh");
  assert.ok(refresh >= 0 && firstFresh > refresh);
  assert.equal(h.calls.filter(([kind]) => kind === "fresh").length, 1);
  assert.equal(h.calls.some(([kind]) => kind === "cached"), false);
  assert.equal(h.calls.filter(([kind, method]) => kind === "db" && method === "POST").length, 2);
});

test("candidate refresh failure fails closed before any source read or edition write", async () => {
  const h = harness({ refreshError: new Error("candidate receipt unavailable") });
  await assert.rejects(() => h.archiveCurrentReadoutEdition(sixAm), /candidate receipt unavailable/);
  assert.deepEqual(h.calls.filter(([kind]) => kind === "fresh"), []);
  assert.deepEqual(h.calls.filter(([kind]) => kind === "cached"), []);
  assert.deepEqual(h.calls.filter(([kind, method]) => kind === "db" && method === "POST"), []);
});

test("a candidate replacement during parallel fresh reads prevents the canonical edition from being saved", async () => {
  const h = harness({ changedAfterRead: true });
  await assert.rejects(() => h.archiveCurrentReadoutEdition(sixAm), /changed during selection/);
  assert.equal(h.calls.filter(([kind]) => kind === "fresh").length, 1);
  assert.deepEqual(h.calls.filter(([kind, method]) => kind === "db" && method === "POST"), []);
});

test("valid prepublished retries return before any candidate or source dependency", async () => {
  const h = harness({ existing: savedEdition() });
  const result = await h.prepublishCurrentReadoutEdition(fiveAm);
  assert.equal(result.skipped, "already-prepublished");
  assert.deepEqual(h.calls.filter(([kind]) => kind === "candidate-refresh" || kind === "fresh" || kind === "cached"), []);
});

test("a new 5am prepublication validates all scheduled sources, then persists the verified candidate build", async () => {
  const h = harness();
  const result = await h.prepublishCurrentReadoutEdition(fiveAm);
  assert.deepEqual(result, {
    editionDate: "2026-09-11", prepublished: ["All"], selectionVersion: "readout-v1-test", skipped: null,
  });
  const scheduledSource = h.calls.findIndex(([kind, _method, url]) =>
    kind === "db" && url.includes("briefing_snapshots?select=area,data,generated_at"));
  const refresh = h.calls.findIndex(([kind]) => kind === "candidate-refresh");
  const firstFresh = h.calls.findIndex(([kind]) => kind === "fresh");
  const candidateAssert = h.calls.findIndex(([kind]) => kind === "candidate-assert");
  const write = h.calls.findIndex(([kind, method]) => kind === "db" && method === "POST");
  assert.ok(scheduledSource >= 0 && refresh > scheduledSource);
  assert.ok(firstFresh > refresh, "fresh reads must observe the awaited candidate build");
  assert.equal(h.calls.filter(([kind]) => kind === "fresh").length, 1);
  assert.ok(candidateAssert > firstFresh && write > candidateAssert);
  assert.equal(h.writes.length, 2);
  assert.deepEqual(h.writes[1][0].card.candidateBuild, h.candidateBuild);
});

test("a valid prepublished edition is also preserved by the 6am archive path", async () => {
  const h = harness({ existing: savedEdition() });
  const result = await h.archiveCurrentReadoutEdition(sixAm);
  assert.deepEqual(result, { editionDate: "2026-09-11", archived: ["All"], skipped: "prepublished", selectionVersion: `readout-v1-${"a".repeat(64)}` });
  assert.deepEqual(h.calls.filter(([kind]) => kind === "candidate-refresh" || kind === "fresh" || kind === "cached"), []);
});

test("the new edition stores the exact fixed start used by every specialty selection", async () => {
  const h = harness();
  await h.prepublishCurrentReadoutEdition(fiveAm);
  assert.deepEqual(h.writes[1][0].card.attentionAnchor, readoutAttentionAnchor("2026-09-11"));
});

test("a new canonical fails closed if the backend did not select against the requested anchor", async () => {
  const h = harness({ attentionMismatch: true });
  await assert.rejects(h.prepublishCurrentReadoutEdition(fiveAm), /attention window is missing or mismatched/);
  assert.equal(h.writes.length, 0);
});

test("the no-edition fallback used outside the scheduled archive path still requires a candidate build", async () => {
  const h = harness();
  const result = await h.mergeCurrentReadoutEditionInsertions(sixAm);
  assert.equal(result.changed, true);
  assert.ok(h.calls.some(([kind]) => kind === "candidate-refresh"));
  assert.equal(h.calls.filter(([kind]) => kind === "fresh").length, 1);
});
