import test from "node:test";
import assert from "node:assert/strict";
import { SPECIALTY_AREAS, assertCompleteSpecialtyBatch, compareSpecialtyOutput, specialtyComparisonStatus, stableJson } from "../lib/readoutSpecialtyComparison.mjs";
import { createSpecialtyTransport } from "../lib/readoutSpecialtyTransport.mjs";
import { specialtyClock } from "../lib/readoutSpecialtyShadow.mjs";

const expected = { sourceRunId: "scheduled-2026091306", engineSha: "abc", builtAt: "2026-09-13T08:20:00.000Z" };
const batch = () => SPECIALTY_AREAS.map(area => ({ area, data: { area, generatedAt: expected.builtAt, build: { sha: expected.engineSha, sourceRunId: expected.sourceRunId, dirty: false } } }));
test("seven-area receipt rejects partial, duplicate, wrong-source and dirty output", () => {
  assert.doesNotThrow(() => assertCompleteSpecialtyBatch(batch(), expected));
  for (const mutate of [rows => rows.pop(), rows => rows[6] = rows[0], rows => rows[0].data.build.sourceRunId = "yesterday", rows => rows[0].data.build.dirty = true, rows => rows[0].data.generatedAt = "2026-09-12T08:20:00.000Z"]) {
    const rows = batch(); mutate(rows); assert.throws(() => assertCompleteSpecialtyBatch(rows, expected));
  }
});
test("live diffs preserve prose/evidence and distinguish stale legacy sources from equality", () => {
  const data = { area: "GU", build: { sourceRunId: expected.sourceRunId }, generatedAt: "now", topStories: [{ id: "story", headline: "finding" }] };
  const legacy = { data: structuredClone(data), generated_at: "before" };
  assert.equal(compareSpecialtyOutput(data, legacy, expected.sourceRunId).status, "equal");
  legacy.data.topStories[0].headline = "different finding";
  assert.deepEqual(compareSpecialtyOutput(data, legacy, expected.sourceRunId).changedFields, ["topStories"]);
  legacy.data.build.sourceRunId = "yesterday";
  assert.equal(compareSpecialtyOutput(data, legacy, expected.sourceRunId).status, "legacy_stale");
  assert.equal(stableJson({ b: 1, a: { d: 2, c: 3 } }), stableJson({ a: { c: 3, d: 2 }, b: 1 }));
});
test("batch cycle uses New York dates and both DST slots map to the right morning", () => {
  assert.deepEqual(specialtyClock(new Date("2026-09-13T08:20:00Z")), { date: "2026-09-13", hour: 4, sourceRunId: "scheduled-2026091306" });
  assert.equal(specialtyClock(new Date("2026-12-13T09:20:00Z")).hour, 4);
  assert.equal(specialtyClock(new Date("2026-09-13T00:20:00Z")).sourceRunId, "scheduled-2026091220");
});
test("a successful build cannot label stale or differing legacy observations a passed comparison", () => {
  const rows = SPECIALTY_AREAS.map(area => ({ area, comparison: { sameCycle: true, status: "equal" } }));
  assert.equal(specialtyComparisonStatus(rows), "equal_observation");
  rows[0].comparison.status = "live_inputs_differ";
  assert.equal(specialtyComparisonStatus(rows), "review_required");
  rows[0].comparison.sameCycle = false;
  rows[0].comparison.status = "legacy_stale";
  assert.equal(specialtyComparisonStatus(rows), "incomplete_legacy");
});
test("shadow transport blocks mutations and caches only exact reads including ranges", async () => {
  let calls = 0;
  const transport = createSpecialtyTransport({ baseUrl: "https://db.test", fetchImpl: async () => { calls++; return new Response('[{"id":"a"}]'); } });
  const url = "https://db.test/rest/v1/x_posts?select=id";
  await transport.fetch(url, { headers: { range: "0-999" } });
  await transport.fetch(url, { headers: { range: "0-999" } });
  await transport.fetch(url, { headers: { range: "1000-1999" } });
  assert.equal(calls, 2);
  await assert.rejects(transport.fetch("https://db.test/rest/v1/briefing_snapshots", { method: "POST", body: "[]" }), /mutation blocked/);
  await assert.rejects(transport.fetch("https://db.test/rest/v1/rpc/delete_anything", { method: "POST" }), /mutation blocked/);
  await assert.rejects(transport.fetch("https://elsewhere.test/rest/v1/x_posts"), /outside/);
  assert.equal(calls, 2);
  assert.throws(() => transport.assertHealthy(), /database requests failed/);
});
test("recap requests are not cached and failed reads cannot poison the cache", async () => {
  let calls = 0;
  const transport = createSpecialtyTransport({ baseUrl: "https://db.test", fetchImpl: async () => { calls++; return new Response('{}', { status: calls === 1 ? 500 : 200 }); } });
  await transport.fetch("https://db.test/rest/v1/x_posts");
  assert.throws(() => transport.assertHealthy(), /database requests failed/);
  await transport.fetch("https://db.test/rest/v1/x_posts");
  await transport.fetch("https://db.test/rest/v1/x_posts");
  assert.equal(calls, 2);
  await transport.fetch("https://db.test/functions/v1/briefing-recap", { method: "POST", body: "{}" });
  await transport.fetch("https://db.test/functions/v1/briefing-recap", { method: "POST", body: "{}" });
  assert.equal(calls, 4);
  assert.doesNotThrow(() => transport.assertHealthy(), "a successful exact retry resolves its own failure");
});

test("HEAD count queries remain read-only and preserve Content-Range", async () => {
  let calls = 0;
  const transport = createSpecialtyTransport({ baseUrl: "https://db.test", fetchImpl: async (_url, init) => { calls++; assert.equal(init.method, "HEAD"); return new Response(null, { headers: { "content-range": "0-0/42" } }); } });
  const options = { method: "HEAD", headers: { prefer: "count=exact" } };
  const first = await transport.fetch("https://db.test/rest/v1/x_posts_product?select=id", options);
  const second = await transport.fetch("https://db.test/rest/v1/x_posts_product?select=id", options);
  assert.equal(first.headers.get("content-range"), "0-0/42");
  assert.equal(second.headers.get("content-range"), "0-0/42");
  assert.equal(calls, 1);
  assert.doesNotThrow(() => transport.assertHealthy());
});

test("recap gate rejects HTTP-200 provider failures and incomplete story prose until an exact retry succeeds", async () => {
  const payloads = [{ error: "provider timeout" }, { recap: "Recap", headline: "Headline", storyWhys: {} }, { recap: "Recap", headline: "Headline", storyWhys: { s1: "Grounded takeaway" } }];
  const transport = createSpecialtyTransport({ baseUrl: "https://db.test", fetchImpl: async () => new Response(JSON.stringify(payloads.shift())) });
  const options = { method: "POST", body: JSON.stringify({ area: "GU", movers: [{ drug: "Drug" }], stories: [{ id: "s1" }] }) };
  await transport.fetch("https://db.test/functions/v1/briefing-recap", options);
  assert.throws(() => transport.assertHealthy(), /provider_error/);
  await transport.fetch("https://db.test/functions/v1/briefing-recap", options);
  assert.throws(() => transport.assertHealthy(), /incomplete_prose/);
  await transport.fetch("https://db.test/functions/v1/briefing-recap", options);
  assert.doesNotThrow(() => transport.assertHealthy());
  assert.equal(transport.stats().recaps[0].status, "complete");
});

test("capture-only recap fixtures require explicit diagnostic mode", async () => {
  for (const allowCapturedRecap of [false, true]) {
    const transport = createSpecialtyTransport({ baseUrl: "https://db.test", allowCapturedRecap, fetchImpl: async () => new Response('{"captureOnly":true}') });
    await transport.fetch("https://db.test/functions/v1/briefing-recap", { method: "POST", body: '{"area":"GU"}' });
    if (allowCapturedRecap) assert.doesNotThrow(() => transport.assertHealthy());
    else assert.throws(() => transport.assertHealthy(), /capture_only/);
    assert.equal(transport.stats().recaps[0].complete, false);
  }
});
