import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const publication = read("app/rounds-lab/PUBLICATION_CONTRACT.md");
const readerData = read("app/rounds-lab/READER_DATA_CONTRACT.md");

test("the publication contract defines the durable question library and exact state vocabulary", () => {
  assert.match(publication, /persistent library of consequential clinical questions, not a feed of podcast episodes/i);
  assert.match(publication, /stable canonical ID and URL/i);
  assert.match(publication, /one current reviewed brief/i);
  assert.match(publication, /immutable prior versions/i);
  assert.match(publication, /movement and review events/i);
  assert.match(publication, /first-class editorial tags/i);
  assert.match(publication, /only the accountable editor may create one/i);
  assert.match(publication, /merges the evidence into an existing question, relates the questions explicitly/i);
  assert.match(publication, /front door is movement-first/i);
  assert.match(publication, /All tracked clinical questions/i);
  assert.match(publication, /never publishes to satisfy a daily or weekly cadence/i);

  const stateHeadings = Array.from(
    publication.matchAll(/^- \*\*(Newly tracked|Updated|Watch|Steady)\*\*/gmu),
    (match) => match[1],
  );
  assert.deepEqual(stateHeadings, ["Newly tracked", "Updated", "Watch", "Steady"]);
  assert.doesNotMatch(publication, /^- \*\*Moving\*\*/mu);
  assert.match(publication, /States describe editorial handling[^.]*not importance, consensus, correctness, urgency, or prevalence/i);
  assert.match(publication, /admit a durable question as `Newly tracked` from one credible conversation/i);
  assert.match(publication, /first reviewed appearance, not corroborated movement/i);
  assert.match(publication, /single-source or commercially supported basis must remain visibly bounded/i);
  assert.match(publication, /cannot be described or scored as corroboration/i);
});

test("the quiet front door separates its three clocks and prohibits hidden tracking", () => {
  assert.match(publication, /simulated last visit/i);
  assert.match(publication, /last material change/i);
  assert.match(publication, /source conversations reviewed through/i);
  assert.match(publication, /uses named fixture scenarios[^.]*does not collect reader behavior/i);
  assert.match(publication, /frozen at page load/i);
  assert.match(publication, /calculated from immutable events, not inferred from current states/i);
});

test("human accountability separates editorial approval, independent verification, and publication", () => {
  assert.match(publication, /one accountable publishing editor/i);
  assert.match(publication, /new or materially changed clinical fact must be independently verified/i);
  assert.match(publication, /qualified human other than the publishing editor/i);
  assert.match(publication, /Additional human review of an interpretation is risk-based, not automatic/i);
  assert.match(publication, /AI never serves as the independent verifier and never publishes autonomously/i);
  assert.match(publication, /AI read a complete candidate asset from beginning to end and ran a challenge search/i);
  assert.match(publication, /never upgrades the asset's publication completeness/i);
  assert.match(publication, /reviewer may approve editorial language while publication remains blocked/i);
  assert.match(publication, /required clinical-fact verifier is missing, is the publishing editor, or has not completed review/i);
  assert.match(publication, /workbench has no bypass labeled as publication/i);
  assert.doesNotMatch(publication, /three (?:human )?(?:owners|approvers)|three-person/i);
});

test("the evidence contract is episode-level, claim-level, and honest about transcript completeness", () => {
  assert.match(publication, /public unit of conversation evidence is the \*\*show and episode\*\*/i);
  assert.match(publication, /not a vote count/i);
  assert.match(publication, /isolated speaker clips are not used/i);
  assert.match(publication, /Transcript status is explicit for every source/i);
  assert.match(publication, /`complete`, `partial`, `unavailable`, or `rights-restricted`/i);
  assert.match(publication, /Complete[^.]*entire source conversation/i);
  assert.match(publication, /not selected excerpts, a summary, chapter markers, or a generated reconstruction/i);
  assert.match(publication, /blocked rather than filled with invented text/i);
  assert.match(publication, /stable claim ID/i);
  assert.match(publication, /support mode \(`direct support`, `paraphrase`, `cross-source synthesis`, `clinical fact — source checked`, `verified fact`, or `editorial interpretation`\)/i);
  assert.match(publication, /`Verified fact` is reserved for completed human verification/i);
  assert.match(publication, /Private chain-of-thought or model scratch work is never presented as provenance/i);
  assert.match(publication, /`Source checked`[^.]*not interchangeable with `independently verified`/i);
});

test("version and correction rules make the deliberately wrong fixture non-exportable and non-current", () => {
  assert.match(publication, /canonical question points to exactly one eligible current version/i);
  assert.match(publication, /Published versions are immutable snapshots/i);
  assert.match(publication, /A `Steady` review can create an event without rewriting an unchanged brief/i);
  assert.match(publication, /correction-test-only data/i);
  assert.match(publication, /ineligible as current/i);
  assert.match(publication, /reviewer correction-history context/i);
  assert.match(publication, /excluded from reader rendering, search indexes, recommendations, ordinary exports/i);
  assert.match(publication, /fixture correction never implies that independent human verification actually occurred/i);
});

test("the reader-data contract keeps clinician behavior outside pharma intelligence", () => {
  assert.match(readerData, /current `\/rounds-lab` prototype collects no reader behavior/i);
  assert.match(readerData, /Clinician reading behavior is reader-product data, not pharma intelligence/i);
  assert.match(readerData, /never sold, licensed, disclosed, or made queryable to a pharma customer/i);
  assert.match(readerData, /individually, pseudonymously, as a segment, or in a small-N or ostensibly aggregated report/i);
  assert.match(readerData, /De-identification does not convert prohibited pharma use into permitted use/i);
  assert.match(readerData, /no row-level, segment-level, query, export, model, or dashboard access/i);
  assert.match(readerData, /separate schemas, service credentials, warehouses, queues, exports, and analytics projects/i);
});

test("future personalization is opt-in, finite, explainable, and reader-controlled", () => {
  assert.match(readerData, /Collection is \*\*off by default\*\*/i);
  assert.match(readerData, /separate from access to the unpersonalized question library/i);
  assert.match(readerData, /pause collection, reset history, opt out/i);
  assert.match(readerData, /export their data/i);
  assert.match(readerData, /withdraw consent as easily as it was granted/i);
  assert.match(readerData, /Initial recommendations[^.]*finite and explainable/i);
  assert.match(readerData, /first-class editorial tags/i);
  assert.match(readerData, /never an infinite feed/i);
  assert.match(readerData, /do not use collaborative filtering, “readers like you,” commercial priority, or engagement-maximizing rank/i);
  assert.match(readerData, /account-level, not device-local/i);
  assert.match(readerData, /snapshot is frozen when the page loads/i);
  assert.match(readerData, /immutable events, not only current question states/i);
});

test("reader-data retention, deletion, export, and small-N rules are concrete", () => {
  assert.match(readerData, /expire after \*\*90 days\*\*/i);
  assert.match(readerData, /expire after \*\*13 months\*\*/i);
  assert.match(readerData, /recoverable backups within \*\*30 days\*\*/i);
  assert.match(readerData, /machine-readable local copy/i);
  assert.match(readerData, /Export excludes other readers/i);
  assert.match(readerData, /every released cell must contain at least \*\*50 distinct opted-in readers\*\*/i);
  assert.match(readerData, /no combination of filters or differencing may reconstruct a smaller cell/i);
  assert.match(readerData, /Reader behavior never appears in pharma-facing outputs, including aggregates/i);
});
