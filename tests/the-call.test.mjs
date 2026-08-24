import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(ROOT, "app/the-call/callModel.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { buildPracticeCalls } = module.exports;
const { unansweredPracticeCalls } = module.exports;

const card = (kind, id, overrides = {}) => ({
  id,
  kind,
  anchorId: id,
  headline: `${kind} headline`,
  why: "",
  sourceLabel: kind === "event" ? "U.S. Food and Drug Administration" : "Journal",
  url: `https://example.com/${id}`,
  excerpt: "Exact source-backed development.",
  support: { clinicianPosts: [], publisherPosts: [], links: [] },
  ...overrides,
});

const briefing = (area, cards) => ({
  area,
  areas: [],
  windowDays: 7,
  generatedAt: "2026-08-24T00:00:00Z",
  recap: null,
  headline: null,
  events: [],
  movers: [],
  topKols: [],
  topArticles: [],
  trials: [],
  heroCandidates: { cards, tieCount: 0 },
});

test("official actions outrank papers without using social volume", () => {
  const calls = buildPracticeCalls([
    briefing("Lung", [card("paper", "popular-paper", { why: "shared by 900 clinicians" })]),
    briefing("Heme", [card("event", "fda-action", { why: "3 clinician-authored posts" })]),
  ]);

  assert.equal(calls[0].card.kind, "event");
  assert.equal(calls[0].sourceKind, "Official action");
  assert.doesNotMatch(source, /xSharers|topLikes|retweets|views/);
});

test("an exact primary-source link replaces the card fallback", () => {
  const primary = "https://fda.gov/official-action";
  const [call] = buildPracticeCalls([
    briefing("Heme", [card("event", "approval", {
      support: {
        clinicianPosts: [],
        publisherPosts: [],
        links: [{
          kind: "article",
          id: "primary",
          title: "FDA action",
          url: primary,
          sourceLabel: "FDA",
          relationshipType: "primary_source",
          occurredAt: null,
        }],
      },
    })]),
  ]);

  assert.equal(call.primaryUrl, primary);
  assert.equal(call.sourceLabel, "FDA");
});

test("one exact authored note and one deeper episode are retained", () => {
  const note = { name: "Dr Example", handle: "examplemd", avatar: null, tweetUrl: "https://x.com/example/1", text: "Exact authored note", likes: 20, retweets: 0, quotes: 0, views: 0 };
  const [call] = buildPracticeCalls([
    briefing("GU", [card("event", "approval", {
      support: {
        clinicianPosts: [note],
        publisherPosts: [],
        links: [{
          kind: "episode",
          id: "episode",
          title: "Clinical discussion",
          url: "https://podcast.example/episode",
          sourceLabel: "Oncology Podcast",
          relationshipType: "covers_approval",
          occurredAt: null,
        }],
      },
    })]),
  ]);

  assert.equal(call.fieldNote.text, "Exact authored note");
  assert.equal(call.deeperLink.kind, "episode");
});

test("cards without a resolvable source URL cannot become calls", () => {
  const calls = buildPracticeCalls([
    briefing("Skin", [card("paper", "missing", { url: null })]),
  ]);
  assert.deepEqual(calls, []);
});

test("answered calls leave a finite remaining set and never wrap", () => {
  const calls = buildPracticeCalls([
    briefing("Heme", [card("event", "approval"), card("paper", "paper")]),
  ]);

  assert.equal(unansweredPracticeCalls(calls, {}).length, 2);
  assert.deepEqual(
    unansweredPracticeCalls(calls, { [calls[0].id]: "yes" }).map((call) => call.id),
    [calls[1].id]
  );
  assert.deepEqual(
    unansweredPracticeCalls(calls, { [calls[0].id]: "yes", [calls[1].id]: "not-yet" }),
    []
  );
});
