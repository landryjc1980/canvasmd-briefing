import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const source = fs.readFileSync(new URL("../lib/conference.ts", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../app/conference/[key]/page.tsx", import.meta.url), "utf8");
const coverage = fs.readFileSync(new URL("../app/conference/[key]/ConferenceCoverage.tsx", import.meta.url), "utf8");
const readoutCard = fs.readFileSync(new URL("../components/ReadoutArticleCard.tsx", import.meta.url), "utf8");
const teaser = fs.readFileSync(new URL("../app/briefing-preview/ConferenceTeaser.tsx", import.meta.url), "utf8");
const coverageCss = fs.readFileSync(new URL("../app/conference/[key]/conference.css", import.meta.url), "utf8");
const server = fs.readFileSync(new URL("../lib/conferenceServer.ts", import.meta.url), "utf8");
const runtime = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText).toString("base64")}`);

test("conference selection gives a live meeting precedence over a nearby meeting and respects specialty", () => {
  assert.match(source, /rank: Record<ConferencePhase, number> = \{ live: 0, upcoming: 1, recent: 2, past: 3 \}/);
  assert.match(source, /filter\(\(meeting\) => appliesToArea\(meeting, area\)\)/);
  assert.match(source, /start - 2 \* DAY_MS/);
  assert.match(source, /end \+ 7 \* DAY_MS/);
});

test("conference selection picks live SOHO for All and Heme while Lung receives WCLC", () => {
  const now = new Date("2026-09-10T16:00:00Z");
  const soho = { key: "soho", name: "SOHO", shortName: "SOHO 2026", society: null, location: "Houston", startDate: "2026-09-09", endDate: "2026-09-12", tumorFocus: "Heme", sourceUrl: null, year: 2026 };
  const wclc = { key: "wclc", name: "WCLC", shortName: "WCLC 2026", society: null, location: "Seoul", startDate: "2026-09-12", endDate: "2026-09-15", tumorFocus: ["Lung"], sourceUrl: null, year: 2026 };
  assert.equal(runtime.selectConference([wclc, soho], "All", now)?.key, "soho");
  assert.equal(runtime.selectConference([wclc, soho], "Heme", now)?.key, "soho");
  assert.equal(runtime.selectConference([soho, wclc], "Lung", now)?.key, "wclc");
  assert.equal(runtime.selectConference([soho, wclc], "All", new Date("2026-09-16T16:00:00Z"))?.key, "wclc");
  assert.equal(runtime.conferenceHref(soho), "/conference/soho?year=2026");
});

test("conference promotion starts two Eastern calendar days before opening and includes the full final day", () => {
  const meeting = { key: "meeting", name: "Meeting", shortName: "Meeting", society: null, location: null, startDate: "2026-09-09", endDate: "2026-09-12", tumorFocus: "General", sourceUrl: null, year: 2026 };
  const at = (date) => new Date(`${date}T16:00:00Z`);
  assert.equal(runtime.conferencePhase(meeting, at("2026-09-07")), "upcoming");
  assert.equal(runtime.conferenceIsEligible(meeting, at("2026-09-07")), true);
  assert.equal(runtime.conferenceIsEligible(meeting, at("2026-09-06")), false);
  assert.equal(runtime.conferencePhase(meeting, at("2026-09-09")), "live");
  assert.equal(runtime.conferencePhase(meeting, at("2026-09-12")), "live");
  assert.equal(runtime.selectConference([meeting], "Lung", at("2026-09-09"))?.key, "meeting");
  const distant = { ...meeting, key: "future", startDate: "2026-11-01", endDate: "2026-11-04" };
  assert.equal(runtime.selectConference([distant], "All", at("2026-09-10")), null);
});

test("conference links preserve the requested meeting year while the page accepts legacy latest links", () => {
  assert.match(source, /\?year=\$\{meeting\.year\}/);
  assert.match(page, /readYear\(searchParams\.year\)/);
  assert.match(page, /getConferenceWindow\(key, readYear\(searchParams\.year\)\)/);
});

test("conference reports use the Readout source-card anatomy without a report taxonomy", () => {
  assert.match(coverage, /ReadoutArticleCard/);
  assert.match(readoutCard, /className=\{`er-development \$\{className\}`\.trim\(\)\}/);
  assert.match(coverage, /className="er-excerpt"/);
  assert.doesNotMatch(coverage, /reportLabel\(/);
  assert.doesNotMatch(coverage, />Source report</);
  assert.match(coverage, /item\.excerpt/);
  assert.match(coverage, /publicationDateLabel\(item\.publishedAt\)/);
  assert.doesNotMatch(coverage, /sharedAt/);
  assert.doesNotMatch(coverage, /source\.abstract/);
});

test("conference reports render only validated clinician receipt attribution", () => {
  assert.match(source, /clinicianShares\?: ConferenceClinicianShare\[\]/);
  assert.match(coverage, /function clinicianShares\(value: unknown\)/);
  assert.match(coverage, /kind !== "share" && kind !== "repost" && kind !== "quote"/);
  assert.match(coverage, /Shared by/);
  assert.match(coverage, /Reposted by/);
  assert.match(coverage, /Quote-posted by/);
  assert.match(coverage, /href=\{share\.postUrl\}/);
  assert.doesNotMatch(coverage, /share\.text/);
  assert.doesNotMatch(coverage, />↗</);
  assert.match(coverageCss, /conference-clinician-receipt/);
  assert.match(coverageCss, /conference-clinician-more/);
});

test("conference reports accept only attributable publisher X comments and keep them separate from clinician receipts", () => {
  assert.match(source, /publisherComments\?: ConferencePublisherComment\[\]/);
  assert.match(source, /export type ConferencePublisherComment/);
  assert.match(source, /export function parseConferencePublisherComments\(value: unknown\)/);
  assert.match(source, /const sourceId = publisherCommentText\(comment\.sourceId\)/);
  assert.match(source, /const postUrl = publisherCommentUrl\(comment\.postUrl\)/);
  assert.match(source, /!sourceId \|\| !name \|\| !text \|\| !postUrl \|\| !postedAt/);
  assert.match(coverage, /parseConferencePublisherComments\(source\.publisherComments\)/);
  assert.match(coverage, /<PublisherComments comments=\{item\.publisherComments\}/);
  assert.match(coverage, /<ClinicianReceipts shares=\{item\.clinicianShares\}/);
  assert.match(coverage, /ReadoutVoice/);
  assert.match(coverage, /Show full comment/);
});

test("publisher comment parser rejects unreceipted posts and preserves valid source URLs", () => {
  const valid = [{ sourceId: "source-42", name: "SOHO", handle: "SOHO_Oncology", avatarUrl: "https://images.example/soho.png", text: "New report from the meeting.", postUrl: "https://x.com/SOHO_Oncology/status/123", postedAt: "2026-09-11T14:00:00Z" }];
  assert.deepEqual(runtime.parseConferencePublisherComments(valid), valid);
  assert.deepEqual(runtime.parseConferencePublisherComments([{ ...valid[0], postUrl: "javascript:alert(1)" }]), []);
  assert.deepEqual(runtime.parseConferencePublisherComments([{ ...valid[0], sourceId: "" }]), []);
  assert.deepEqual(runtime.parseConferencePublisherComments([{ ...valid[0], text: "" }]), []);
  assert.deepEqual(runtime.parseConferencePublisherComments([{ ...valid[0], postedAt: "" }]), []);
});

test("conference page preserves existing cards, articles, and episode coverage with source links", () => {
  assert.match(coverage, /coverage\.cards/);
  assert.match(coverage, /coverage\.articles/);
  assert.match(coverage, /coverage\.episodes/);
  assert.match(coverage, /externalUrl/);
  assert.match(coverage, /canonicalUrl/);
  assert.match(coverage, /dedupeCoverage/);
  assert.match(coverage, /source\.pubDate/);
  assert.match(coverage, /source\.published/);
  assert.match(coverage, /source\.episodeId/);
  assert.match(coverageCss, /\.conference-source-link \{[^}]*min-height: 44px/);
  assert.match(server, /CONFERENCE_TIMEOUT_MS = 5_000/);
  assert.match(server, /meeting\.key !== seriesKey/);
});

test("conference detail uses the meeting short name, full name, status, and dated range", () => {
  assert.match(coverage, /conferenceStatusLabel\(meeting\)/);
  assert.match(coverage, /<h1>\{meeting\.shortName\}<\/h1>/);
  assert.match(coverage, /conference-name">\{meeting\.name\}/);
  assert.match(source, /\$\{startMonth\} \$\{start\.getUTCDate\(\)\}–\$\{end\.getUTCDate\(\)\}, \$\{year\}/);
});

test("the Readout teaser follows the selected specialty and uses working conference links", () => {
  assert.match(teaser, /selectConference\(meetings, area\)/);
  assert.match(teaser, /href=\{conferenceHref\(meeting\)\}/);
});
