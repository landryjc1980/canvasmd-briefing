import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(ROOT, "app/awesome/signalModel.ts"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { buildSignals } = module.exports;

const post = (url, likes = 10) => ({
  name: "Dr Example",
  handle: "examplemd",
  avatar: null,
  tweetUrl: url,
  text: "A substantive authored reaction",
  likes,
  retweets: 0,
  views: 0,
});

const mover = (drug, overrides = {}) => ({
  drugId: drug.toLowerCase().replaceAll(" ", "-"),
  drug,
  brand: null,
  company: null,
  score: 20,
  signalShape: "both",
  delta: 0,
  podConvs: 0,
  podEpisodes: 0,
  podShows: 0,
  xSharers: 0,
  articleCount: 0,
  podPct: 0,
  xPct: 0,
  articlePct: 0,
  topLikes: 0,
  why: null,
  eventChip: null,
  stanceChip: null,
  stance: null,
  avatars: [],
  showArt: [],
  shows: [],
  posts: [],
  papers: [],
  podcast: [],
  ...overrides,
});

const briefing = (area, movers, trials = []) => ({
  area,
  areas: [],
  windowDays: 7,
  generatedAt: "2026-08-23T12:00:00Z",
  recap: null,
  headline: `${area} field activity`,
  events: [],
  movers,
  topKols: [],
  topArticles: [],
  trials,
});

test("signal states require measured evidence rather than prominence", () => {
  const signals = buildSignals([
    briefing("GU", [
      mover("Practice Drug", {
        stance: { total: 4, favorable: 4, skeptical: 0, mixed: 0, quote: "", practiceChanging: true, axis: "efficacy", takes: [] },
      }),
      mover("Debate Drug", {
        stance: { total: 5, favorable: 3, skeptical: 2, mixed: 0, quote: "", practiceChanging: false, axis: "safety", takes: [] },
      }),
      mover("Contested Practice Drug", {
        stance: { total: 5, favorable: 3, skeptical: 2, mixed: 0, quote: "", practiceChanging: true, axis: "sequencing", takes: [] },
      }),
      mover("Breakout Drug", { delta: 8, xSharers: 8, podEpisodes: 1, xPct: 80, podPct: 20 }),
      mover("Early Drug", { xSharers: 6, xPct: 100 }),
    ]),
  ]);

  const states = Object.fromEntries(signals.map((signal) => [signal.mover.drug, signal.state]));
  assert.equal(states["Practice Drug"], "practice-shift");
  assert.equal(states["Debate Drug"], "debate");
  assert.equal(states["Contested Practice Drug"], "debate");
  assert.equal(states["Breakout Drug"], "breakout");
  assert.equal(states["Early Drug"], "early");
});

test("the same receipt is not repeated when stance and X evidence overlap", () => {
  const url = "https://x.com/examplemd/status/1";
  const [signal] = buildSignals([
    briefing("GU", [
      mover("Receipt Drug", {
        xSharers: 1,
        posts: [post(url)],
        stance: {
          total: 4,
          favorable: 4,
          skeptical: 0,
          mixed: 0,
          quote: "",
          practiceChanging: false,
          axis: "efficacy",
          takes: [{
            valence: "favorable",
            text: "A substantive authored reaction",
            verbatim: true,
            sourceType: "x",
            sourceLabel: "Dr Example (@examplemd)",
            url,
            occurredAt: null,
            practiceChanging: false,
          }],
        },
      }),
    ]),
  ]);

  assert.equal(signal.receipts.filter((receipt) => receipt.url === url).length, 1);
});

test("cross-specialty peers link without summing potentially duplicate activity", () => {
  const gu = mover("Shared Drug", { drugId: "shared-drug", delta: 8, xSharers: 5 });
  const skin = mover("Shared Drug", { drugId: "shared-drug", delta: 3, xSharers: 4 });
  const signals = buildSignals([briefing("GU", [gu]), briefing("Skin", [skin])]);

  const guSignal = signals.find((signal) => signal.area === "GU");
  assert.deepEqual(guSignal.peers, [{ area: "Skin", delta: 3, state: "active" }]);
  assert.equal(guSignal.mover.xSharers, 5);
});

test("trial watch only attaches intervention-matched registry records", () => {
  const trials = [
    {
      nctId: "NCT00000001",
      acronym: "MATCHED",
      title: "Matched trial",
      phase: "Phase 3",
      status: "Recruiting",
      sponsor: "Example",
      interventions: ["Pembrolizumab"],
      podMentions: 0,
      xMentions: 4,
      articleMentions: 0,
      totalMentions: 4,
      resultsFresh: false,
      pods: [],
      posts: [],
      articles: [],
      url: "https://clinicaltrials.gov/study/NCT00000001",
    },
    {
      nctId: "NCT00000002",
      acronym: "OTHER",
      title: "Unrelated trial",
      phase: "Phase 2",
      status: "Recruiting",
      sponsor: "Example",
      interventions: ["Nivolumab"],
      podMentions: 0,
      xMentions: 9,
      articleMentions: 0,
      totalMentions: 9,
      resultsFresh: false,
      pods: [],
      posts: [],
      articles: [],
      url: "https://clinicaltrials.gov/study/NCT00000002",
    },
  ];

  const [signal] = buildSignals([briefing("Lung", [mover("Pembrolizumab")], trials)]);
  assert.deepEqual(signal.trials.map((trial) => trial.nctId), ["NCT00000001"]);
});
