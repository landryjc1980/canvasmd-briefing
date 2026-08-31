import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  LOCAL_ROUNDS_BRIEFS,
  LOCAL_ROUNDS_FRONT_DOOR_SCENARIOS,
  LOCAL_ROUNDS_QUESTION_BY_ID,
  LOCAL_ROUNDS_QUESTION_BY_SLUG,
  LOCAL_ROUNDS_QUESTIONS,
  MOVEMENT_STATES,
  QUIET_FRONT_DOOR_SCENARIO,
} from "../app/rounds-lab/fixture.ts";
import {
  findRoundsQuestion,
  searchRoundsQuestions,
} from "../app/rounds-lab/librarySearch.ts";
import {
  validateQuestionEventLog,
  validateQuestionTags,
} from "../app/rounds-lab/questionModel.ts";
import { omitAdjacentRepeatedSourceRefs } from "../app/rounds-lab/sourceReferences.ts";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/rounds-lab/page.tsx");
const view = read("app/rounds-lab/RoundsLab.tsx");
const briefView = read("app/rounds-lab/RoundsBrief.tsx");
const player = read("app/rounds-lab/RoundsPlayer.tsx");
const engine = read("app/rounds-lab/playerEngine.ts");
const fixture = read("app/rounds-lab/fixture.ts");
const css = read("app/rounds-lab/rounds-lab.css");
const middleware = read("middleware.ts");

const wordCount = (...parts) =>
  parts.join(" ").trim().split(/\s+/u).filter(Boolean).length;

const timestampMs = (label) =>
  label
    .split(" · ")[0]
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0) * 1_000;

test("the hosted Rounds reader is a noindexed, static-data draft with no production reviewer path", () => {
  assert.match(page, /robots:\s*\{\s*index: false, follow: false, noarchive: true, nocache: true\s*\}/);
  assert.doesNotMatch(page, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(page, /hostedDraft=\{process\.env\.NODE_ENV === "production"\}/);
  assert.match(page, /question && !findRoundsQuestion\(question, LOCAL_ROUNDS_BRIEFS\)\) notFound\(\)/);
  assert.match(middleware, /pathname === "\/rounds-lab" \|\| pathname\.startsWith\("\/rounds-lab\/"\)/);
  assert.ok(
    middleware.indexOf('pathname === "/rounds-lab"') < middleware.indexOf("activeContactId(session.contactId)"),
    "Rounds Lab must bypass the contact gate before any production contact lookup",
  );
  assert.doesNotMatch(middleware, /PUBLIC_PREFIXES\s*=\s*\[[^\]]*["']\/rounds-lab["']/);
  assert.match(fixture, /LOCAL_FIXTURE/);
  assert.match(fixture, /intentionally disconnected from every[\s\S]*production endpoint/);
  assert.doesNotMatch(`${view}\n${briefView}\n${player}\n${engine}`, /\/api\/|supabase|lib\/db|logSignal|fetch\s*\(/i);
  assert.doesNotMatch(`${page}\n${view}\n${fixture}`, /localStorage|sessionStorage|sendBeacon|trackEvent|readerId/i);
  assert.match(view, /Draft review surface/);
  assert.match(view, /Editorial and verification checks remain open\. Not clinical guidance\./);
  assert.match(view, /!hostedDraft[\s\S]*\/rounds-lab\/reviewer/);
  assert.match(view, /Static fixture data/);
  assert.match(view, /No reader tracking/);
});

test("the fixture is a six-question canonical GU library with all four exact states", () => {
  assert.equal(LOCAL_ROUNDS_BRIEFS.length, 6);
  assert.equal(LOCAL_ROUNDS_QUESTIONS.length, 6);
  assert.deepEqual(MOVEMENT_STATES, ["Newly tracked", "Updated", "Watch", "Steady"]);
  assert.deepEqual(
    new Set(LOCAL_ROUNDS_BRIEFS.map((brief) => brief.movement.state)),
    new Set(MOVEMENT_STATES),
  );
  assert.ok(LOCAL_ROUNDS_BRIEFS.every((brief) => brief.area === "GU oncology"));
  assert.equal(new Set(LOCAL_ROUNDS_BRIEFS.map((brief) => brief.id)).size, 6);
  assert.equal(new Set(LOCAL_ROUNDS_BRIEFS.map((brief) => brief.slug)).size, 6);

  for (const requiredId of [
    "proteus-perioperative",
    "mibc-perioperative-systemic",
    "mibc-bladder-preservation",
    "rcc-adjuvant-selection",
    "nmibc-fgfr-intravesical",
    "metastatic-uc-ev-pembro-access",
  ]) {
    assert.ok(LOCAL_ROUNDS_QUESTION_BY_ID[requiredId], `missing ${requiredId}`);
  }
  assert.ok(LOCAL_ROUNDS_BRIEFS.some((brief) => brief.tags.diseases.some((tag) => /kidney|renal/i.test(tag))));
  assert.ok(LOCAL_ROUNDS_BRIEFS.some((brief) => [
    ...brief.tags.decisionTypes,
    ...brief.tags.patientManagement,
  ].some((tag) => /toxicity|adverse|adherence|feasibility|access|treatment burden/i.test(tag))));
  assert.doesNotMatch(JSON.stringify(LOCAL_ROUNDS_BRIEFS), /\bMoving\b/);
});

test("reader trust copy bounds single-source evidence and keeps reviewer mechanics out of correction history", () => {
  const fgfr = LOCAL_ROUNDS_QUESTION_BY_ID["nmibc-fgfr-intravesical"];
  assert.equal(fgfr.movement.state, "Newly tracked");
  assert.equal(fgfr.sources.length, 1);
  assert.equal(fgfr.sources[0].episodeSupport.kind, "educational-grant-supported");
  assert.equal(
    fgfr.movement.evidenceQualifier,
    "One complete grant-supported conversation reviewed",
  );
  assert.match(briefView, /brief\.movement\.evidenceQualifier/);

  const mibc = LOCAL_ROUNDS_QUESTION_BY_ID["mibc-perioperative-systemic"];
  assert.equal(mibc.events.some((event) => event.type === "correction-issued"), false);
  const correctionEvent = fgfr.events.find((event) => event.type === "correction-issued");
  assert.equal(
    correctionEvent?.summary,
    "A prior version linked this question to the wrong trial registry. MoonRISe-1 (NCT06319820) replaced it on Aug 30, and the earlier version is preserved.",
  );
  assert.equal(correctionEvent?.versionId, fgfr.currentVersionId);
  assert.ok(fgfr.versions.some((version) => version.status === "superseded"));
  assert.doesNotMatch(correctionEvent?.summary ?? "", /fixture|test|deliberately erroneous/i);
  assert.doesNotMatch(JSON.stringify(LOCAL_ROUNDS_BRIEFS), /v0-correction-test/);
  assert.doesNotMatch(briefView, /Transcript search is available in the reviewer workbench/i);
  assert.doesNotMatch(briefView, /Transcript not available in this local fixture/i);
});

test("each canonical question carries immutable current version, ordered events, rigorous tags, and editor-confirmed creation", () => {
  const globalEventIds = new Set();
  const questionIds = new Set(LOCAL_ROUNDS_BRIEFS.map((brief) => brief.id));

  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    assert.equal(LOCAL_ROUNDS_QUESTION_BY_ID[brief.id], brief);
    assert.equal(LOCAL_ROUNDS_QUESTION_BY_SLUG[brief.slug], brief);
    assert.equal(findRoundsQuestion(brief.id, LOCAL_ROUNDS_QUESTIONS), brief);
    assert.equal(findRoundsQuestion(brief.slug, LOCAL_ROUNDS_QUESTIONS), brief);
    assert.match(brief.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);

    assert.ok(Object.isFrozen(brief.versions));
    assert.equal(brief.versions.filter((version) => version.status === "current").length, 1);
    const current = brief.versions.find((version) => version.id === brief.currentVersionId);
    assert.ok(current, `${brief.id} has no current version pointer`);
    assert.equal(current.status, "current");
    assert.equal(current.snapshot.question, brief.question);
    assert.equal(current.snapshot.answerHeading, brief.answerHeading);
    assert.equal(current.snapshot.snapshotSchema, "rounds-reader-core-v1");
    assert.ok(current.snapshot.movement.headline);
    assert.ok(current.snapshot.decisionBoundary);
    assert.ok(current.snapshot.patientFactors);
    assert.ok(current.snapshot.clinicalFacts);
    assert.ok(Object.isFrozen(current));
    assert.ok(Object.isFrozen(current.snapshot));
    assert.ok(Object.isFrozen(current.snapshot.synthesisClaims));
    assert.deepEqual(new Set(current.snapshot.sourceIds), new Set(brief.sources.map((source) => source.id)));
    for (const prior of brief.versions.filter((version) => version.status !== "current")) {
      assert.ok(Object.isFrozen(prior));
      assert.ok(Object.isFrozen(prior.snapshot));
      assert.equal(prior.snapshot.snapshotSchema, "rounds-reader-core-v1");
      assert.ok(prior.snapshot.movement.headline);
      assert.equal("decisionBoundary" in prior.snapshot, true);
      assert.equal("patientFactors" in prior.snapshot, true);
      assert.equal("clinicalFacts" in prior.snapshot, true);
      assert.notEqual(prior.id, brief.currentVersionId);
    }

    assert.equal(validateQuestionEventLog(brief.id, brief.events), true);
    assert.ok(brief.events.some((event) => event.type === "question-created"));
    assert.ok(brief.events.some((event) => event.versionId === brief.currentVersionId));
    for (const event of brief.events) {
      assert.equal(globalEventIds.has(event.id), false, `duplicate event ${event.id}`);
      globalEventIds.add(event.id);
      assert.ok(event.sourceIds.every((sourceId) => brief.sources.some((source) => source.id === sourceId)));
      if (event.versionId) {
        assert.ok(
          brief.versions.some((version) => version.id === event.versionId),
          `${event.id} references missing version ${event.versionId}`,
        );
      }
    }

    assert.equal(validateQuestionTags(brief.tags), true);
    assert.deepEqual(Object.keys(brief.tags).sort(), [
      "clinicalRoles",
      "clinicalSettings",
      "commonTerminology",
      "decisionTypes",
      "diseases",
      "drugsBiomarkersProcedures",
      "patientManagement",
      "stagesOrLines",
      "treatmentsOrModalities",
    ]);
    assert.equal(brief.editorConfirmed.status, "editor-confirmed");
    assert.ok(brief.editorConfirmed.proposedFromSourceIds.length > 0);
    assert.ok(brief.editorConfirmed.proposedFromSourceIds.every((sourceId) =>
      brief.sources.some((source) => source.id === sourceId),
    ));
    assert.ok(brief.relations.every((relation) =>
      questionIds.has(relation.questionId) && relation.questionId !== brief.id && relation.editorConfirmedOn,
    ));
  }
  assert.ok(LOCAL_ROUNDS_BRIEFS.some((brief) => brief.versions.some((version) => version.status === "superseded")));
  const steady = LOCAL_ROUNDS_QUESTION_BY_ID["rcc-adjuvant-selection"];
  assert.equal(steady.movement.state, "Steady");
  assert.ok(steady.versions.length >= 2, "the Steady example must preserve the prior reviewed version");
  assert.equal(steady.versions.at(-2).id, "rcc-adjuvant-selection-v0.2");
  assert.equal(steady.versions.at(-2).status, "superseded");
  assert.equal(steady.events.at(-1).material, false);
  assert.equal(steady.events.at(-1).type, "brief-recorded");

  const corrected = LOCAL_ROUNDS_QUESTION_BY_ID["nmibc-fgfr-intravesical"];
  assert.ok(
    corrected.events.some((event) =>
      event.type === "correction-issued"
      && event.versionId === corrected.currentVersionId
      && event.material === false,
    ),
    "the corrected registry must have a resolvable correction event",
  );
  assert.match(briefView, /brief\.versions/);
  assert.match(briefView, /brief\.events/);
  assert.match(briefView, /Question history/);
  assert.match(briefView, /Review activity/);
});

test("the simulated quiet front door separates last visit, last material movement, and review-through clocks", () => {
  assert.equal(LOCAL_ROUNDS_FRONT_DOOR_SCENARIOS.includes(QUIET_FRONT_DOOR_SCENARIO), true);
  assert.equal(QUIET_FRONT_DOOR_SCENARIO.simulated, true);
  assert.equal(QUIET_FRONT_DOOR_SCENARIO.hasMovementSinceLastVisit, false);
  assert.deepEqual(QUIET_FRONT_DOOR_SCENARIO.prioritizedQuestionIds, []);
  assert.ok(QUIET_FRONT_DOOR_SCENARIO.exploreQuestionIds.length > 0);
  assert.ok(QUIET_FRONT_DOOR_SCENARIO.exploreQuestionIds.every((id) => LOCAL_ROUNDS_QUESTION_BY_ID[id]));
  assert.ok(Date.parse(QUIET_FRONT_DOOR_SCENARIO.lastMaterialChangeOn) < Date.parse(QUIET_FRONT_DOOR_SCENARIO.lastVisitOn));
  assert.ok(Date.parse(QUIET_FRONT_DOOR_SCENARIO.lastVisitOn) < Date.parse(QUIET_FRONT_DOOR_SCENARIO.sourceConversationsReviewedThrough));

  assert.match(view, /QUIET_FRONT_DOOR_SCENARIO/);
  assert.match(view, /No meaningful movement since your simulated last visit/i);
  assert.match(view, /<dt>Last visit<\/dt>/);
  assert.match(view, /<dt>Last material change<\/dt>/);
  assert.match(view, /<dt>Scenario evidence reviewed through<\/dt>/);
  assert.match(view, /Current library evidence reviewed through/);
  assert.match(view, /quietExploreQuestions/);
  assert.match(view, /Explore other questions/i);
  assert.match(view, /Browse all questions/i);
});

test("the movement front door is event-based and canonical question URLs focus the brief", () => {
  assert.match(view, /brief\.events/);
  assert.match(view, /PRIMARY_MOVEMENT_EVENTS/);
  assert.match(view, /event\.occurredOn >= RECENT_MOVEMENT_WINDOW_START/);
  assert.match(view, /event\.type === "watch-signal"/);
  assert.match(view, /\["Newly tracked", "Updated"\]\.includes\(entry\.brief\.movement\.state\)/);
  assert.match(view, /entry\.brief\.movement\.state === "Watch"/);
  assert.match(view, /right\.event\.occurredOn\.localeCompare\(left\.event\.occurredOn\)/);
  assert.match(view, /focusedQuestion \? \(/);
  assert.match(view, /← All clinical questions/);
  assert.match(view, /Review evidence/);
  assert.match(view, /href=\{resultById\.get\(brief\.id\)\?\.canonicalHref/);
  assert.doesNotMatch(view, /scrollIntoView/);
});

test("search exercises the canonical helper across title, disease, treatment, biomarker, terminology, decision type, and current read", () => {
  const cases = [
    ["After PROTEUS", "proteus-perioperative", "title"],
    ["KEYNOTE-564", "rcc-adjuvant-selection", "biomarker-or-procedure"],
    ["kidney cancer", "rcc-adjuvant-selection", "disease"],
    ["intravesical therapy", "nmibc-fgfr-intravesical", "treatment"],
    ["TAR-210", "nmibc-fgfr-intravesical", "biomarker-or-procedure"],
    ["adjuvant pembro", "rcc-adjuvant-selection", "common-terminology"],
    ["toxicity management", "nmibc-fgfr-intravesical", "decision-type"],
    ["biomarker-and-delivery hypothesis", "nmibc-fgfr-intravesical", "current-read"],
    ["not routinely", "proteus-perioperative", "current-read"],
    ["positive phase 3 result", "proteus-perioperative", "current-read"],
    ["possibly intravesical delivery", "nmibc-fgfr-intravesical", "current-read"],
  ];

  for (const [query, expectedId, expectedField] of cases) {
    const results = searchRoundsQuestions(query, LOCAL_ROUNDS_QUESTIONS);
    const match = results.find((result) => result.id === expectedId);
    assert.ok(match, `${query} did not find ${expectedId}`);
    assert.ok(match.matchedFields.includes(expectedField), `${query} did not match ${expectedField}`);
    assert.equal(match.question, LOCAL_ROUNDS_QUESTION_BY_ID[expectedId]);
    assert.equal(match.canonicalHref, `/rounds-lab?question=${encodeURIComponent(match.slug)}`);
    assert.equal("versionId" in match, false);
  }

  assert.equal(searchRoundsQuestions("not-a-real-rounds-query", LOCAL_ROUNDS_QUESTIONS).length, 0);
  assert.equal(searchRoundsQuestions("", LOCAL_ROUNDS_QUESTIONS, { limit: 2 }).length, 2);
  assert.equal(new Set(searchRoundsQuestions("pembrolizumab", LOCAL_ROUNDS_QUESTIONS).map((result) => result.id)).size,
    searchRoundsQuestions("pembrolizumab", LOCAL_ROUNDS_QUESTIONS).length);
  assert.ok(searchRoundsQuestions("", LOCAL_ROUNDS_QUESTIONS).every((result) =>
    result.question.versions.some((version) =>
      version.id === result.question.currentVersionId && version.status === "current",
    ),
  ));
  assert.match(view, /searchRoundsQuestions/);
  assert.match(view, /Search clinical questions/i);
  assert.match(view, /Search the latest brief\. Each question keeps its source and revision history/i);
});

test("every material discussion layer resolves to timestamped, full-episode source context", () => {
  const canonicalSources = new Map();

  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    const sourceById = new Map(brief.sources.map((source) => [source.id, source]));
    assert.equal(sourceById.size, brief.sources.length);

    for (const source of brief.sources) {
      assert.match(source.citationLabel, / · /);
      assert.ok(source.sourceRole);
      assert.ok(source.editorialFamily);
      assert.ok(source.independenceCluster);
      assert.match(source.episodeSupport.kind, /^(unsponsored|sponsor-supported|commercial-partner-disclosed|educational-grant-supported|publisher-produced|program-context|support-not-established)$/);
      assert.match(source.audioUrl, /^https:\/\//);
      assert.match(source.url, /^https:\/\//);
      assert.notEqual(source.audioUrl, source.url);
      assert.ok(Number.isFinite(source.durationSeconds) && source.durationSeconds > 0);
      assert.ok(Math.abs(source.relevantAtMs - timestampMs(source.relevantAt)) < 1_000);
      assert.ok(source.relevantAtMs < source.durationSeconds * 1_000);

      const stable = {
        show: source.show,
        episode: source.episode,
        published: source.published,
        audioUrl: source.audioUrl,
        durationSeconds: source.durationSeconds,
        url: source.url,
      };
      if (canonicalSources.has(source.id)) assert.deepEqual(stable, canonicalSources.get(source.id));
      else canonicalSources.set(source.id, stable);
    }

    const references = [
      ...brief.movement.sourceRefs,
      ...brief.synthesisClaims.flatMap((claim) => claim.sourceRefs),
      ...brief.lenses.flatMap((lens) => lens.sourceRefs),
      ...brief.factors.flatMap((factor) => factor.sourceRefs),
    ];
    assert.ok(references.length > 0);
    for (const reference of references) {
      const source = sourceById.get(reference.sourceId);
      assert.ok(source, `${brief.id}: unresolved source ${reference.sourceId}`);
      assert.ok(Math.abs(reference.startMs - timestampMs(reference.relevantAt)) < 1_000);
      assert.ok(reference.startMs < source.durationSeconds * 1_000);
    }
  }

  const uromigos = [...canonicalSources.keys()].filter((id) => id.startsWith("uromigos-"));
  assert.ok(uromigos.length >= 3);
  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    for (const source of brief.sources.filter((candidate) => candidate.id.startsWith("uromigos-"))) {
      assert.equal(source.episodeSupport.kind, "unsponsored");
    }
  }
});

test("clinical facts are source-checked separately and never imply unperformed human verification", () => {
  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    const evidenceIds = new Set(brief.clinicalContext.evidence.map((evidence) => evidence.id));
    const facts = [brief.clinicalContext.status, ...brief.clinicalContext.keyFacts];
    assert.ok(facts.length >= 2);
    for (const fact of facts) {
      assert.ok(fact.id);
      assert.ok(fact.text.length > 20);
      assert.match(fact.sourceCheckedOn, /2026/);
      assert.equal("verifiedOn" in fact, false);
      assert.match(fact.independentVerification.status, /^(required|complete|not-required)$/);
      assert.ok(fact.evidenceIds.length > 0);
      assert.ok(fact.evidenceIds.every((id) => evidenceIds.has(id)));
    }
    assert.equal(brief.governance.publicationState, "local-prototype");
    assert.match(brief.governance.factVerificationPolicy, /independent verification/i);
    assert.match(brief.governance.interpretiveReviewPolicy, /risk-based/i);
    assert.equal(brief.governance.independentFactVerification.status, "required");
  }

  assert.match(briefView, /Clinical facts/);
  assert.match(briefView, /Source-checked facts, shown separately from the discussion synthesis/i);
  assert.match(briefView, /Clinical source checked/);
  assert.match(briefView, /Independent human verification required before external use/);
  assert.doesNotMatch(briefView, />Facts verified|>Verified facts|factVerifiedOn/);
});

test("each first-pass reader narrative remains compact", () => {
  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    const words = wordCount(
      brief.question,
      brief.movement.headline,
      brief.answerLabel,
      brief.answerHeading,
      ...brief.synthesisClaims.map((claim) => claim.text),
      "Decision boundary",
      brief.differencesHeading,
      brief.differencesContext,
      brief.factorsLabel,
      brief.factorsHeading,
      brief.factorsContext,
    );
    assert.ok(words <= 220, `${brief.id} exposes ${words} first-pass words`);
  }
  assert.match(briefView, /className="rl-discussion rl-progressive-section"/);
  assert.match(briefView, /className="rl-factors rl-progressive-section"/);
});

test("reader hierarchy is explicit and progressive disclosure preserves source context", () => {
  const markers = [
    'className="rl-opening"',
    'className="rl-current-read"',
    'className="rl-discussion rl-progressive-section"',
    'className="rl-factors rl-progressive-section"',
    'className="rl-clinical-context"',
    'className="rl-sources"',
  ];
  const positions = markers.map((marker) => briefView.indexOf(marker));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((left, right) => left - right), positions);
  assert.match(view, /GU oncology briefings/);
  assert.match(view, /What changed/);
  assert.match(view, /All clinical questions/);
  assert.match(view, /Clinical question brief/);
  for (const label of ["Why the answer changed", "Why this question is new", "Why we’re watching", "What we reviewed"]) {
    assert.match(briefView, new RegExp(label));
  }
  for (const step of ["Short answer", "Where the choice gets difficult", "What changes the decision for a patient", "Clinical facts", "Full evidence"]) {
    assert.match(briefView, new RegExp(step));
  }
  assert.match(briefView, /brief\.answerLabel/);
  assert.doesNotMatch(briefView, /readerFacingCopy/);
  assert.match(briefView, /\{brief\.answerHeading\}/);
  assert.match(briefView, /\{claim\.text\}/);
  assert.match(briefView, /\{brief\.movement\.headline\}/);
  assert.match(briefView, /className="rl-answer-logic"/);
  assert.match(briefView, /narrativeStageLabel\(claim\)/);
  assert.match(briefView, /claim\.stageLabel/);
  assert.ok(LOCAL_ROUNDS_BRIEFS.every((brief) =>
    brief.synthesisClaims.every((claim) => Boolean(claim.stageLabel?.trim())),
  ));
  assert.match(briefView, /className="rl-answer-evidence"/);
  assert.match(briefView, /See the cited moments behind this answer/);
  assert.match(briefView, /className="rl-movement-evidence"/);
  assert.equal(
    LOCAL_ROUNDS_QUESTION_BY_ID["proteus-perioperative"].synthesisClaims[0].stageLabel,
    "Evidence supporting selective use",
  );
  assert.equal(
    LOCAL_ROUNDS_QUESTION_BY_ID["proteus-perioperative"].synthesisClaims[1].stageLabel,
    "Evidence against routine use",
  );
  assert.match(briefView, /className="rl-answer-logic-sources"/);
  assert.match(briefView, /href=\{`#\$\{targetId\}`\}/);
  assert.match(briefView, /onRevealEvidence\(targetId\)/);
  assert.match(briefView, /anchorPrefix=\{`\$\{prefix\}-answer-evidence-/);
  assert.match(briefView, /setAnswerEvidenceOpen\(true\)/);
  assert.match(briefView, /Voices behind this brief/);
  assert.match(briefView, /source\.show/);
  assert.match(briefView, /source\.episode/);
  assert.match(briefView, /Guest:/);
  assert.match(briefView, /source\.episodeSupport\.label/);
  assert.match(briefView, /evidenceLabel/);
  assert.match(briefView, /All papers, episodes, disclosures, and review notes/);
  assert.match(briefView, /onRevealFullEvidence\(fullEvidenceId\)/);
  assert.match(briefView, /Study records and papers/);
  assert.match(briefView, /Conversation evidence:/);
  assert.match(briefView, /claim\.sourceContext/);
  assert.match(briefView, /Source limitations/);
  assert.match(briefView, /Claims changed or held back/);
  assert.doesNotMatch(briefView, /Bottom line|Discussion lenses|Verified clinical context/i);

  assert.match(briefView, /aria-expanded=\{expanded\}/);
  assert.match(briefView, /aria-controls=\{factorPanelId\}/);
  assert.match(briefView, /hidden=\{!expanded\}/);
  assert.match(briefView, /aria-expanded=\{sourcesOpen\}/);
  assert.match(briefView, /hidden=\{!sourcesOpen\}/);
  assert.match(briefView, /<details className="rl-clinical-context">/);
  assert.match(briefView, /Source-checked status and key numbers/);
  assert.match(briefView, /not a measure of consensus across the field/);
  assert.match(briefView, /without assigning a position to an individual clinician/);
});

test("PROTEUS credits the guests and distinguishes included from excluded conversations", () => {
  const proteus = LOCAL_ROUNDS_QUESTION_BY_ID["proteus-perioperative"];
  const completeSourceIds = proteus.editorialAudit.sourceReviews
    .filter((review) => review.status === "complete-asset-reviewed")
    .map((review) => review.sourceId);
  const completeSources = proteus.sources.filter((source) => completeSourceIds.includes(source.id));

  assert.equal(completeSources.length, 3);
  assert.ok(completeSources.every((source) => source.guests?.length));
  assert.deepEqual(
    [...new Set(completeSources.flatMap((source) => source.guests.map((guest) => guest.name)))].sort(),
    ["Mary-Ellen Taplin", "Neha Vapiwala"],
  );
  assert.equal(
    proteus.editorialAudit.sourceReviews.filter((review) => review.status === "partial-asset-excluded").length,
    1,
  );
  const favorableSources = proteus.synthesisClaims[0].sourceRefs.map((reference) =>
    proteus.sources.find((source) => source.id === reference.sourceId),
  );
  assert.ok(favorableSources.every((source) => source?.guests?.some((guest) => guest.name === "Mary-Ellen Taplin")));
  assert.equal(favorableSources[0]?.independenceCluster, "PROTEUS trial discussion circuit");
  assert.equal(favorableSources[1]?.independenceCluster, favorableSources[0]?.independenceCluster);
  assert.equal(
    proteus.sources.find((source) => source.id === "gu-cast-proteus")?.episodeSupport.label,
    "Sponsor-supported episode · Johnson & Johnson",
  );
  assert.equal(
    proteus.editorialAudit.sourceReviews.find((review) => review.sourceId === "uromigos-508")?.status,
    "partial-asset-excluded",
  );
  assert.match(proteus.synthesisClaims[0].sourceContext ?? "", /not independent confirmations/i);
  assert.match(briefView, /guestNames/);
  assert.match(
    briefView,
    /sourceReview\.status === "complete-asset-reviewed"[\s\S]*"Complete transcript reviewed"[\s\S]*"Not used in this answer · only part of the transcript was available"/,
  );
});

test("reader evidence counts agree with the structured source-review ledger", () => {
  const countValue = new Map([
    ["one", 1],
    ["two", 2],
    ["three", 3],
    ["four", 4],
  ]);
  const parsedCount = (value) => Number.isFinite(Number(value))
    ? Number(value)
    : countValue.get(value.toLocaleLowerCase());

  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    const complete = brief.editorialAudit.sourceReviews.filter(
      (review) => review.status === "complete-asset-reviewed",
    ).length;
    const partial = brief.editorialAudit.sourceReviews.filter(
      (review) => review.status === "partial-asset-excluded",
    ).length;
    const completeMatch = brief.answerLabel.match(/\b(\d+|one|two|three|four) complete\b/i);
    assert.ok(completeMatch, `${brief.id} has no structured complete-source count in its answer label`);
    assert.equal(parsedCount(completeMatch[1]), complete, brief.id);
    const partialMatch = brief.answerLabel.match(/\b(\d+|one|two|three|four) partial\b/i);
    assert.equal(partialMatch ? parsedCount(partialMatch[1]) : 0, partial, brief.id);
  }
});

test("PROTEUS full evidence distinguishes primary, repeated, contextual, and interpretive records", () => {
  const proteus = LOCAL_ROUNDS_QUESTION_BY_ID["proteus-perioperative"];
  const evidenceById = new Map(proteus.clinicalContext.evidence.map((item) => [item.id, item]));

  for (const id of [
    "proteus-nejm",
    "proteus-registry",
    "proteus-asco-final",
    "proteus-design-paper",
    "proteus-natural-history",
    "proteus-critical-editorial",
    "erleada-us-label",
  ]) {
    assert.ok(evidenceById.has(id), `missing ${id}`);
  }
  assert.match(evidenceById.get("proteus-asco-final").label, /same trial dataset/i);
  assert.match(evidenceById.get("proteus-natural-history").label, /not a randomized PROTEUS result/i);
  assert.match(evidenceById.get("proteus-critical-editorial").label, /interpretation/i);
  assert.equal(evidenceById.get("proteus-nejm").role, "primary-study");
  assert.equal(evidenceById.get("proteus-registry").role, "trial-registry");
  assert.equal(evidenceById.get("proteus-asco-final").role, "conference-report");
  assert.match(briefView, /item\.role/);
  assert.match(briefView, /Full evidence/);
});

test("Full evidence remains available when a question has no featured primary-study record", () => {
  const mibc = LOCAL_ROUNDS_QUESTION_BY_ID["mibc-perioperative-systemic"];
  assert.equal(mibc.clinicalContext.evidence.some((item) => item.role === "primary-study"), false);
  assert.ok(mibc.clinicalContext.evidence.some((item) => item.role === "regulatory"));
  assert.match(briefView, /const featured = studyRecords\.length/);
  assert.match(briefView, /item\.role === "regulatory"/);
  assert.doesNotMatch(briefView, /if \(!studyRecords\.length\) return null/);
});

test("the citation helper remains exact while reader claims retain their own timestamp links", () => {
  const prior = [{ sourceId: "same", relevantAt: "00:01 · first", startMs: 1_000 }];
  const current = [
    { sourceId: "same", relevantAt: "00:01 · first", startMs: 1_000 },
    { sourceId: "same", relevantAt: "00:02 · different", startMs: 2_000 },
    { sourceId: "other", relevantAt: "00:01 · other", startMs: 1_000 },
  ];
  assert.deepEqual(omitAdjacentRepeatedSourceRefs(current, prior), current.slice(1));
  assert.deepEqual(omitAdjacentRepeatedSourceRefs(prior, prior), prior);
  assert.doesNotMatch(briefView, /omitAdjacentRepeatedSourceRefs/);
  assert.match(briefView, /sourceRefs=\{claim\.sourceRefs\}/);
});

test("every regenerated brief exposes the four reader-safe stages and a complete challenge audit", () => {
  for (const brief of LOCAL_ROUNDS_BRIEFS) {
    assert.deepEqual(
      brief.synthesisClaims.map((claim) => claim.stage),
      ["previous", "new", "current", "unresolved"],
      brief.id,
    );
    assert.ok(brief.editorialAudit.sourceReviews.length > 0);
    assert.ok(brief.editorialAudit.stateRationale.length > 30);
    assert.ok(brief.editorialAudit.evidenceSelections.length > 0);
    assert.ok(brief.editorialAudit.counterevidence.length > 0);
    assert.ok(brief.editorialAudit.revisedOrBlockedClaims.length > 0);
    assert.ok(brief.editorialAudit.unresolved.length > 0);
    assert.equal(brief.governance.sourceCheckedOn, "Aug 30, 2026");
    assert.equal(brief.governance.independentFactVerification.status, "required");
    assert.equal(brief.versions.at(-2).status, "superseded");
    assert.equal(brief.versions.at(-1).status, "current");
    assert.ok(brief.synthesisClaims.every((claim) => claim.stageLabel?.trim()));
  }

  const proteus = LOCAL_ROUNDS_QUESTION_BY_ID["proteus-perioperative"];
  assert.equal(
    proteus.synthesisClaims.some((claim) =>
      claim.sourceRefs.some((reference) => reference.sourceId === "uromigos-508")),
    false,
  );
  const access = LOCAL_ROUNDS_QUESTION_BY_ID["metastatic-uc-ev-pembro-access"];
  assert.equal(
    access.synthesisClaims.some((claim) =>
      claim.sourceRefs.some((reference) => reference.sourceId === "uromigos-504")),
    false,
  );
  assert.match(briefView, /narrativeStageLabel\(claim\)/);
});

test("every citation opens the full episode player at the exact moment", () => {
  assert.match(briefView, /candidate\.id === reference\.sourceId/);
  assert.match(briefView, /onClick=\{\(\) => onListen\?\.\(source, reference\)\}/);
  assert.match(briefView, /Play \$\{source\.show\}, \$\{source\.episode\}, from \$\{reference\.relevantAt\} in the full-episode player/);
  assert.match(briefView, /Episode page/);
  assert.match(view, /playbackRequestRef\.current \+= 1/);
  assert.match(view, /setPlayback\(\{ source, reference, requestId: playbackRequestRef\.current \}\)/);

  assert.equal((player.match(/<audio\b/g) ?? []).length, 1);
  assert.match(player, /preload="none"/);
  assert.match(player, /Full episode · \{playback\.source\.citationLabel\}/);
  assert.match(player, /Return to cited moment/);
  assert.match(player, /aria-label="15 seconds backward"/);
  assert.match(player, /aria-label="15 seconds forward"/);
  assert.match(player, /type="range"/);
  assert.match(player, /Episode page/);
  assert.match(player, /id="rounds-full-episode-player"/);
  assert.match(player, /audio\.removeAttribute\("src"\)/);
  assert.match(engine, /audio\.src = mediaFragmentUrl/);
  assert.doesNotMatch(player, /endMs|endSeconds|clipDuration|crossOrigin=/);
});

test("reader controls remain accessible, touch-sized, responsive, and motion-safe", () => {
  assert.match(view, /aria-label="Question view"/);
  assert.match(view, /aria-pressed=\{libraryView === "movement"\}/);
  assert.match(view, /aria-pressed=\{libraryView === "library"\}/);
  assert.match(view, /aria-live="polite"/);
  assert.match(view, /type="search"/);
  assert.match(view, /<a href=\{resultById\.get\(brief\.id\)\?\.canonicalHref/);
  assert.match(css, /\.rl-question-rows a\s*\{[^}]*min-height:\s*112px;/);
  assert.match(css, /\.rl-claim-sources button\s*\{[^}]*min-height:\s*44px;/);
  assert.match(css, /\.rl-factor-summary\s*\{[^}]*min-height:\s*78px;/);
  assert.match(css, /\.rl-source-actions button,[\s\S]{0,100}min-height:\s*44px;/);
  assert.match(css, /\.rounds-lab button:focus-visible/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media \(max-width: 900px\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.rl-answer-logic-sources a\s*\{[^}]*min-height:\s*44px;/);
  assert.match(briefView, /tabIndex=\{anchorPrefix && firstSourceOccurrence \? -1 : undefined\}/);
  assert.match(briefView, /window\.matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(briefView, /decodedLocationHash/);
});
