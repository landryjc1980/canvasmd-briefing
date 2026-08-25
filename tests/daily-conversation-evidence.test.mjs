import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("web reader never fetches or renders The Daily surface", () => {
  const page = read("app/page.tsx");
  const reader = read("app/ReaderView.tsx");
  const all = read("app/AllView.tsx");

  assert.doesNotMatch(page, /\/api\/daily/);
  assert.doesNotMatch(page, /setDaily/);
  assert.doesNotMatch(reader, /<DailyConversationEvidence/);
  assert.doesNotMatch(reader, /The Daily ·/);
  assert.doesNotMatch(reader, /daily_readout/);
  assert.doesNotMatch(all, /The Daily</);
});

test("web Daily API and sender are disabled without reading historical rows", () => {
  const dailyRoute = read("app/api/daily/route.ts");
  const sendRoute = read("app/api/daily-send/route.ts");

  assert.match(dailyRoute, /daily: null, disabled: true/);
  assert.doesNotMatch(dailyRoute, /daily_readout\?select/);
  assert.match(sendRoute, /disabled: true/);
  assert.match(sendRoute, /reason: "daily_disabled"/);
  assert.doesNotMatch(sendRoute, /listDailyOptIns|renderDailyEmail|sendDailyEmail|recordDailySend/);
});

test("web onboarding no longer offers Daily opt-in", () => {
  for (const source of [read("app/welcome/page.tsx"), read("app/i/[code]/page.tsx")]) {
    assert.doesNotMatch(source, /The Daily/);
    assert.doesNotMatch(source, /daily,?\s*\}/);
    assert.doesNotMatch(source, /setDaily/);
  }
  assert.doesNotMatch(read("app/api/brief-request/route.ts"), /setDailyOptIn|dailyOptIn/);
  assert.doesNotMatch(read("app/api/brief-invite/route.ts"), /setDailyOptIn|dailyOptIn/);
});

test("standard Readout sections remain available on web", () => {
  const reader = read("app/ReaderView.tsx");
  assert.match(reader, /Top stories/);
  assert.match(reader, /episodesSection/);
  assert.match(reader, /papersSection/);
  assert.match(reader, /peopleSection/);
  assert.match(reader, /trialsSection/);
  assert.match(reader, /drugsSection/);
});
