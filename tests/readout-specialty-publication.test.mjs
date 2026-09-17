import test from "node:test";
import assert from "node:assert/strict";
import { assertSpecialtyPublicationControl, finishSpecialtyPublication, specialtyPublicationCycle } from "../lib/readoutSpecialtyPublication.mjs";
import { runSpecialtyBatch } from "../lib/readoutSpecialtyShadow.mjs";

const engine = { dirty: false, backendSha: "a".repeat(40), engineSha256: "b".repeat(64) };
const control = () => ({ enabled: true, approved_engine_sha: engine.backendSha, approved_engine_input_sha256: engine.engineSha256, review_evidence: [{ kind: "fixture", artifact: "/private/test.json", sha256: "c".repeat(64), acceptedAt: "2026-09-15T12:00:00Z", acceptedBy: "test fixture only" }] });

test("publication requires explicit matching engine and accepted evidence before reading data", async () => {
  assert.doesNotThrow(() => assertSpecialtyPublicationControl(control(), engine));
  for (const patch of [{ enabled: false }, { approved_engine_sha: "d".repeat(40) }, { approved_engine_input_sha256: "e".repeat(64) }, { review_evidence: [] }, { review_evidence: [{}] }]) {
    const invalid = { ...control(), ...patch };
    assert.throws(() => assertSpecialtyPublicationControl(invalid, engine));
    await assert.rejects(runSpecialtyBatch({ engineInfo: engine, mode: "publish", publicationControl: invalid, fetchImpl: () => assert.fail("unapproved publication must not perform I/O") }));
  }
  await assert.rejects(runSpecialtyBatch({ engineInfo: engine, mode: "publish", publicationControl: control(), allowCapturedRecap: true }), /cannot publish/);
});

test("publication preserves New York morning/evening cycles across DST and rejects off-hours", () => {
  for (const [instant, sourceRunId] of [
    ["2026-09-16T08:00:00Z", "scheduled-2026091606"],
    ["2026-09-16T00:00:00Z", "scheduled-2026091520"],
    ["2026-12-16T09:05:00Z", "scheduled-2026121606"],
    ["2026-12-16T01:00:00Z", "scheduled-2026121520"],
  ]) assert.equal(specialtyPublicationCycle(new Date(instant)).sourceRunId, sourceRunId);
  for (const instant of ["2026-09-16T09:00:00Z", "2026-12-16T08:00:00Z", "2026-09-16T08:06:00Z", "2026-09-15T13:30:00Z"]) assert.equal(specialtyPublicationCycle(new Date(instant)), null);
});

function receiptClient(rpcResult, stored) {
  let calls = 0;
  const client = { rpc: async () => { calls++; return rpcResult; }, from: name => {
    assert.equal(name, "readout_specialty_source_runs");
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: stored }) };
    return query;
  } };
  return { client, calls: () => calls };
}

test("a lost commit response reconciles exact durable success without rerunning provider work", async () => {
  const { client, calls } = receiptClient({ error: { message: "response lost" } }, { status: "succeeded", summary: { published: true, sourceRunId: "scheduled-2026091606" } });
  assert.equal((await finishSpecialtyPublication(client, "run", {})).publicationReceiptRecovered, true);
  assert.equal(calls(), 1);
});

test("a slow final commit that returns success does not perform a reconciliation RPC", async () => {
  let calls = 0, reads = 0;
  const client = {
    rpc: async () => { calls++; await new Promise(resolve => setTimeout(resolve, 15)); return { data: { published: true, sourceRunId: "scheduled-2026091606" } }; },
    from: () => { reads++; assert.fail("a confirmed RPC must not read back or retry"); },
  };
  const result = await finishSpecialtyPublication(client, "run", {}, { readbackDeadlineAt: Date.now() + 50 });
  assert.equal(result.published, true);
  assert.equal(calls, 1);
  assert.equal(reads, 0);
});

test("uncertain final commits poll only the exact run until its bounded readback succeeds", async () => {
  let calls = 0, reads = 0;
  const client = {
    rpc: async () => { calls++; return { error: { message: "response lost" } }; },
    from: name => {
      assert.equal(name, "readout_specialty_source_runs");
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: ++reads < 2 ? { status: "running", summary: {} } : { status: "succeeded", summary: { published: true } } }) };
      return query;
    },
  };
  const result = await finishSpecialtyPublication(client, "exact-run", {}, { readbackDeadlineAt: Date.now() + 100, readbackIntervalMs: 1 });
  assert.equal(result.publicationReceiptRecovered, true);
  assert.equal(calls, 1);
  assert.equal(reads, 2);
});

test("a slow failed commit still receives its reserved post-response readback window", async () => {
  let reads = 0;
  const startedAt = Date.now();
  const client = {
    rpc: async () => { await new Promise(resolve => setTimeout(resolve, 20)); return { error: { message: "response lost" } }; },
    from: () => {
      const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: ++reads < 2 ? { status: "running", summary: {} } : { status: "succeeded", summary: { published: true } } }) };
      return query;
    },
  };
  const result = await finishSpecialtyPublication(client, "exact-run", {}, {
    readbackDeadlineAt: startedAt + 30,
    readbackBudgetMs: 5,
    readbackIntervalMs: 1,
  });
  assert.equal(result.publicationReceiptRecovered, true);
  assert.equal(reads, 2);
});

test("an unconfirmed or failed commit stays a failure, not a partial publication", async () => {
  for (const stored of [null, { status: "failed", summary: { published: false } }, { status: "succeeded", summary: { published: false } }]) {
    const { client } = receiptClient({ error: { message: "transaction rejected" } }, stored);
    await assert.rejects(finishSpecialtyPublication(client, "run", {}), /no.*confirmed commit|did not return a confirmed commit/);
  }
});
