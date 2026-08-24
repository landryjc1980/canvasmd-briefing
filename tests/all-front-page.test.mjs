import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rankAcrossSpecialties, computeBand, approvalsRail, artifactSig, clearsFloor, gainReason } from "../app/allFrontPage.ts";

// The All page's front door promotes stories ACROSS specialties. Every rule below is locked
// (John + Claude + Codex, 2026-08-24) and the live payload does not stress most of them — a
// quiet week hands us one card per area, so the diversity cap and the floor only ever show up
// under construction. These fixtures are that construction.

const card = (id, kind = "paper", extra = {}) => ({
  id, kind, anchorId: id, headline: `Headline ${id}`, why: "", sourceLabel: "", url: null, ...extra,
});
const entry = (id, clinicians, kind = "paper", extra = {}) => ({
  card: card(id, kind, extra), metrics: { clinicians, spanDays: null, podcasts: 0 },
});
const AREAS = ["GU", "Breast", "Lung", "GI", "Heme", "Gyn", "Skin"];

test("(a) the absolute floor runs FIRST — thin stories stay in their specialty rail", () => {
  const deck = rankAcrossSpecialties([
    { area: "GU", entries: [entry("thin", 2), entry("solid", 9)] },
  ], AREAS);
  assert.deepEqual(deck.map((d) => d.card.id), ["solid"]);
  // an event/readout anchor clears the floor on its own — it does not need a share count
  assert.equal(clearsFloor(card("e", "event"), { clinicians: 0, spanDays: null, podcasts: 0 }), true);
  assert.equal(clearsFloor(card("r", "readout"), { clinicians: 0, spanDays: null, podcasts: 0 }), true);
  assert.equal(clearsFloor(card("p", "paper"), { clinicians: 2, spanDays: null, podcasts: 0 }), false);
});

test("(b) rank percentile is the comparable score — raw counts never favour the big panels", () => {
  // Lung runs a 10-deep deck whose SECOND story still carries 39 sharers; Gyn's leader carries 5.
  // On raw counts the big panels would own the page — that is exactly the bug this rule prevents.
  const lung = Array.from({ length: 10 }, (_, i) => entry(`lung${i}`, 40 - i));
  const gyn = [entry("gyn0", 5), entry("gyn1", 4)];
  const deck = rankAcrossSpecialties([
    { area: "Lung", entries: lung },
    { area: "Gyn", entries: gyn },
  ], AREAS);
  const ids = deck.map((d) => d.card.id);
  const gynLead = deck.find((d) => d.card.id === "gyn0");
  const lungSecond = deck.find((d) => d.card.id === "lung1");
  assert.ok(gynLead && lungSecond, "both must reach the deck");
  assert.ok(gynLead.metrics.clinicians < lungSecond.metrics.clinicians, "fixture: Gyn's leader has FEWER sharers");
  assert.ok(ids.indexOf("gyn0") < ids.indexOf("lung1"), "Gyn's leader still outranks Lung's second");
  // and the deep panel's tail never reaches the deck at all
  assert.equal(ids.includes("lung3"), false);
});

test("(c) event class is a WEIGHT, not a trump card", () => {
  // equal percentile → the regulatory story wins
  const tie = rankAcrossSpecialties([
    { area: "GU", entries: [entry("gu-paper", 20), entry("x", 3)] },
    { area: "Heme", entries: [entry("heme-event", 20, "event"), entry("y", 3)] },
  ], AREAS);
  assert.equal(tie[0].card.id, "heme-event");

  // a clearly higher-percentile paper still beats it — the weight cannot override the ranking.
  // Both areas stay 2 deep so the diversity cap plays no part in the comparison.
  const beaten = rankAcrossSpecialties([
    { area: "GU", entries: [entry("gu-lead", 20), entry("a", 3)] },
    { area: "Heme", entries: [entry("h1", 9), entry("heme-event", 9, "event")] },
  ], AREAS);
  const ids = beaten.map((d) => d.card.id);
  assert.ok(ids.includes("heme-event"), "the event is in the deck — it simply ranks lower");
  assert.ok(ids.indexOf("gu-lead") < ids.indexOf("heme-event"), "a top-percentile paper outranks a mid-percentile event");
});

test("(d) at most 2 of one specialty in the first 6", () => {
  // GU would take the whole deck on score alone.
  const gu = Array.from({ length: 8 }, (_, i) => entry(`gu${i}`, 50 - i));
  const deck = rankAcrossSpecialties([
    { area: "GU", entries: gu },
    { area: "Breast", entries: [entry("br0", 6), entry("br1", 5)] },
    { area: "Lung", entries: [entry("lu0", 6), entry("lu1", 5)] },
    { area: "GI", entries: [entry("gi0", 6), entry("gi1", 5)] },
  ], AREAS);
  assert.equal(deck.length, 6);
  const perArea = {};
  for (const d of deck.slice(0, 6)) perArea[d.area] = (perArea[d.area] ?? 0) + 1;
  for (const [area, n] of Object.entries(perArea)) assert.ok(n <= 2, `${area} took ${n} slots`);
});

test("(e) no obligation to represent every specialty, and one story never appears twice", () => {
  const deck = rankAcrossSpecialties([
    { area: "GU", entries: [entry("shared", 10), entry("gu1", 8)] },
    { area: "Breast", entries: [entry("shared", 10)] }, // same development surfaced by two areas
    { area: "Gyn", entries: [entry("thin", 1)] },       // below the floor → simply absent
  ], AREAS);
  assert.equal(deck.filter((d) => d.card.id === "shared").length, 1);
  assert.equal(deck.some((d) => d.area === "Gyn"), false);
});

test("the deck is deterministic — same input, same order", () => {
  const build = () => rankAcrossSpecialties([
    { area: "GU", entries: [entry("a", 10), entry("b", 9)] },
    { area: "Lung", entries: [entry("c", 10), entry("d", 9)] },
  ], AREAS);
  assert.deepEqual(build().map((d) => d.card.id), build().map((d) => d.card.id));
});

// ---- Since your last read -------------------------------------------------------------------

const DAY = 86400_000;
const iso = (ms) => new Date(ms).toISOString();
const NOW = Date.UTC(2026, 7, 24, 12, 0, 0);
const YESTERDAY = iso(NOW - DAY);

const bandOf = (over) => computeBand({
  perArea: [{ area: "GU", entries: [entry("s1", 10)] }],
  areaOrder: AREAS, seen: {}, firstObserved: {}, lastVisit: YESTERDAY, now: new Date(NOW), ...over,
});

test("the band is suppressed on a first visit and after a long absence", () => {
  assert.deepEqual(bandOf({ lastVisit: null }), []);
  assert.deepEqual(bandOf({ lastVisit: iso(NOW - 8 * DAY) }), [], "away over a week — the front page IS the catch-up");
  assert.equal(bandOf({ lastVisit: iso(NOW - 6 * DAY) }).length, 1, "still inside the window");
});

test("NEW = unseen AND first observed after the last visit", () => {
  // stamped during THIS visit (or never stamped) → it arrived while they were away
  assert.equal(bandOf({ firstObserved: { s1: iso(NOW) } })[0].status, "new");
  assert.equal(bandOf({ firstObserved: {} })[0].status, "new");
  // it was already on the page last time they looked → not news
  assert.deepEqual(bandOf({ firstObserved: { s1: iso(NOW - 3 * DAY) } }), []);
});

test("UPDATED fires on a GAINED typed artifact, and carries the reason", () => {
  const withPaper = {
    area: "GU",
    entries: [{
      card: card("s1", "event", { support: { clinicianPosts: [], publisherPosts: [], links: [{ kind: "paper", id: "p1" }] } }),
      metrics: { clinicians: 10, spanDays: null, podcasts: 0 },
    }],
  };
  const rows = computeBand({
    perArea: [withPaper], areaOrder: AREAS,
    seen: { s1: { at: YESTERDAY, sig: ["event:s1"] } }, // seen BEFORE the paper attached
    firstObserved: { s1: iso(NOW - 3 * DAY) }, lastVisit: YESTERDAY, now: new Date(NOW),
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "updated");
  assert.equal(rows[0].reason, "Paper added");
  assert.equal(gainReason(["episode:first"]), "Podcast discussion added");

  // an unchanged signature is NOT news, however much the counts moved
  const same = computeBand({
    perArea: [withPaper], areaOrder: AREAS,
    seen: { s1: { at: YESTERDAY, sig: ["event:s1", "paper:p1"] } },
    firstObserved: { s1: iso(NOW - 3 * DAY) }, lastVisit: YESTERDAY, now: new Date(NOW),
  });
  assert.deepEqual(same, []);
});

test("routine coverage and additional podcast episodes do not trigger UPDATED", () => {
  const support = (links) => ({ clinicianPosts: [], publisherPosts: [], links });
  const first = card("s1", "event", { support: support([
    { kind: "episode", id: "e1" },
    { kind: "article", id: "coverage-1" },
  ]) });
  const later = card("s1", "event", { support: support([
    { kind: "episode", id: "e1" },
    { kind: "episode", id: "e2" },
    { kind: "article", id: "coverage-2" },
  ]) });
  assert.deepEqual(artifactSig(first), ["episode:first", "event:s1"]);
  assert.deepEqual(artifactSig(later), artifactSig(first));

  const rows = computeBand({
    perArea: [{ area: "GU", entries: [{ card: later, metrics: { clinicians: 10, spanDays: null, podcasts: 2 } }] }],
    areaOrder: AREAS,
    // Exact episode ids are the pre-rollout storage shape and must remain compatible.
    seen: { s1: { at: YESTERDAY, sig: ["event:s1", "episode:e1"] } },
    firstObserved: { s1: iso(NOW - 3 * DAY) }, lastVisit: YESTERDAY, now: new Date(NOW),
  });
  assert.deepEqual(rows, []);
});

test("+N shares NEVER trigger UPDATED — the signature holds typed artifacts only", () => {
  const post = { name: "A", handle: "a", avatar: null, tweetUrl: "t", text: "x", likes: 9, retweets: 9, quotes: 9, views: 9 };
  const quiet = card("s1", "event", { support: { clinicianPosts: [], publisherPosts: [], links: [{ kind: "paper", id: "p1" }] } });
  const loud = card("s1", "event", {
    support: { clinicianPosts: [post, post, post], publisherPosts: [post], otherPosts: [post], links: [{ kind: "paper", id: "p1" }] },
  });
  assert.deepEqual(artifactSig(quiet), artifactSig(loud));
});

test("the band caps its rows and orders them by the same evidence rank", () => {
  const entries = Array.from({ length: 20 }, (_, i) => entry(`n${i}`, 10));
  const rows = computeBand({
    perArea: [{ area: "GU", entries }], areaOrder: AREAS, seen: {}, firstObserved: {},
    lastVisit: YESTERDAY, now: new Date(NOW),
  });
  assert.equal(rows.length, 8);
  assert.deepEqual(rows.map((r) => r.card.id), entries.slice(0, 8).map((e) => e.card.id));
});

// ---- Approvals & readouts --------------------------------------------------------------------

test("the approvals rail takes only regulatory and readout cards, newest first", () => {
  const ev = (id, on) => ({ card: card(id, "event", { occurredOn: on }) });
  const rail = approvalsRail([
    { area: "GU", entries: [ev("old", "2026-08-19"), { card: card("paper1", "paper") }] },
    { area: "Heme", entries: [ev("new", "2026-08-22")] },
  ]);
  assert.deepEqual(rail.map((r) => r.card.id), ["new", "old"]);
  assert.equal(rail[0].date, "2026-08-22");
});

// REGRESSION (2026-08-24): the rail used to date a development from its support links. No support
// edge has ever carried relationshipType "primary_source", so that lookup always fell through to
// the newest link — coverage of the act, dated days after the act. The real iberdomide card below
// is the exact shape that printed "Aug 23" on the All page while the Heme card printed "11d ago".
test("the rail dates a development by the regulator's action, never by its coverage", () => {
  const iberdomide = card("event:fda:iberdomide", "event", {
    occurredOn: "2026-08-13", // the FDA acted on Aug 13 — the card body says so verbatim
    support: {
      clinicianPosts: [], publisherPosts: [],
      links: [
        // links arrive newest-first; this is a CancerNetwork pickup, not the FDA action
        { kind: "article", id: "l1", relationshipType: "covers_approval", occurredAt: "2026-08-23T18:04:01+00:00" },
        { kind: "article", id: "l2", relationshipType: "covers_approval", occurredAt: "2026-08-13T20:30:24+00:00" },
      ],
    },
  });
  const [row] = approvalsRail([{ area: "Heme", entries: [{ card: iberdomide }] }]);
  assert.equal(row.date, "2026-08-13", "the action date wins over every support timestamp");

  // and with no canonical date the rail shows NO date — it must never fall back to support
  const undated = card("event:fda:undated", "event", { support: iberdomide.support });
  assert.equal(approvalsRail([{ area: "Heme", entries: [{ card: undated }] }])[0].date, null);
});

// ---- copy + engine-boundary guards ----------------------------------------------------------

test("the locked labels are exactly the approved wording", () => {
  const source = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
  assert.match(source, />Most discussed across oncology</);
  assert.match(source, /ranked by independent clinician attention/);
  assert.match(source, />Recent approvals &amp; readouts</);
  // time claims we refuse to make: event cards stay in this rail for a rolling 14 days, so
  // "this week" was false for every approval older than Monday (audit 2026-08-24)
  assert.doesNotMatch(source, /this week, all specialties/);
  assert.match(source, /You&rsquo;re caught up — \{reviewedCount\}/);
  assert.match(source, />Since your last read</);
  // editorial claims we refuse to make
  assert.doesNotMatch(source, /most important/i);
  assert.doesNotMatch(source, /practice-changing/i);
});

test("the front page composes over the engine's payload and never re-scores it", () => {
  const source = fs.readFileSync(new URL("../app/allFrontPage.ts", import.meta.url), "utf8");
  const code = source.replace(/\/\/.*$/gm, ""); // rules are DESCRIBED in the comments; check the code
  // the only ranking inputs are the engine's own deck ORDER and plain receipt counts
  assert.match(source, /percentile/);
  assert.doesNotMatch(code, /Math\.random/);
  assert.doesNotMatch(code, /\b(importance|verdict|sentiment)\b/i);
  // the composition layer must stay a pure function of the payload: no fetching, no engine calls,
  // and no local recompute reaching for anything but the cards it was handed
  assert.doesNotMatch(code, /fetch\(|supabase|functions\/v1/i);
  // and no runtime imports at all — this is what keeps the rules loadable under node --test
  assert.doesNotMatch(code, /^\s*import\s+(?!type\b)/m);
});

test("seen-state keys on the durable anchor id, never the per-build index id", () => {
  const source = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
  // `all:${a}:${i}` remains the DOM/accordion key, but must never reach the seen log
  assert.doesNotMatch(source, /markSeen\(\s*`all:/);
  assert.doesNotMatch(source, /recordSeen\(\s*`all:/);
  assert.match(source, /data-sid=\{s\.id\}/);
});

test("reading a Since-band row during this visit never dims it", () => {
  const source = fs.readFileSync(new URL("../app/AllView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /sessionSeen/);
  assert.doesNotMatch(source, /opacity:\s*visited/);
});
