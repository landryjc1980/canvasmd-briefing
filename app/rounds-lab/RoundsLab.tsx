"use client";

import { useMemo, useRef, useState } from "react";
import {
  LOCAL_ROUNDS_BRIEFS,
  QUIET_FRONT_DOOR_SCENARIO,
  type LocalDiscussionBrief,
  type MovementState,
  type SourceConversation,
  type SourceReference,
} from "./fixture";
import RoundsBrief from "./RoundsBrief";
import RoundsPlayer, { type RoundsPlayback } from "./RoundsPlayer";
import {
  findRoundsQuestion,
  searchRoundsQuestions,
  type RoundsQuestionSearchResult,
} from "./librarySearch";

const MOVEMENT_STATE_DESCRIPTIONS: Record<MovementState, string> = {
  "Newly tracked": "A new question worth following",
  Updated: "New evidence changed the answer",
  Watch: "A signal to keep watching",
  Steady: "Reviewed with no meaningful change",
};

const READER_MOVEMENT_LABELS: Record<MovementState, string> = {
  "Newly tracked": "Newly tracked",
  Updated: "Updated answer",
  Watch: "Watching",
  Steady: "No meaningful change",
};

type LibraryView = "movement" | "library";

const RECENT_MOVEMENT_WINDOW_START = "2026-06-01";

const PRIMARY_MOVEMENT_EVENTS = new Set([
  "question-created",
  "brief-recorded",
  "materially-updated",
]);

function movementQuestions() {
  return [...LOCAL_ROUNDS_BRIEFS]
    .map((brief) => ({
      brief,
      event: [...brief.events]
        .reverse()
        .find((event) => (
          event.occurredOn >= RECENT_MOVEMENT_WINDOW_START
          && event.material
          && PRIMARY_MOVEMENT_EVENTS.has(event.type)
        )),
    }))
    .filter((entry): entry is { brief: LocalDiscussionBrief; event: NonNullable<typeof entry.event> } => (
      Boolean(entry.event)
      && ["Newly tracked", "Updated"].includes(entry.brief.movement.state)
    ))
    .sort((left, right) => right.event.occurredOn.localeCompare(left.event.occurredOn))
    .map(({ brief }) => brief);
}

function watchedQuestions() {
  return [...LOCAL_ROUNDS_BRIEFS]
    .map((brief) => ({
      brief,
      event: [...brief.events]
        .reverse()
        .find((event) => (
          event.occurredOn >= RECENT_MOVEMENT_WINDOW_START
          && event.type === "watch-signal"
        )),
    }))
    .filter((entry): entry is { brief: LocalDiscussionBrief; event: NonNullable<typeof entry.event> } => (
      Boolean(entry.event) && entry.brief.movement.state === "Watch"
    ))
    .sort((left, right) => right.event.occurredOn.localeCompare(left.event.occurredOn))
    .map(({ brief }) => brief);
}

function QuestionRows({
  questions,
  emptyLabel,
  searchResults,
}: {
  questions: LocalDiscussionBrief[];
  emptyLabel: string;
  searchResults?: readonly RoundsQuestionSearchResult[];
}) {
  if (!questions.length) return <p className="rl-library-empty">{emptyLabel}</p>;

  const resultById = new Map(searchResults?.map((result) => [result.id, result]) ?? []);

  return (
    <ol className="rl-question-rows">
      {questions.map((brief, index) => (
        <li key={brief.id}>
          <a href={resultById.get(brief.id)?.canonicalHref ?? `/rounds-lab?question=${encodeURIComponent(brief.slug)}`}>
            <span className="rl-question-number" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="rl-question-row-copy">
              <span className="rl-question-row-meta">
                <strong data-state={brief.movement.state}>
                  {READER_MOVEMENT_LABELS[brief.movement.state]}
                </strong>
                <span>{brief.movement.date}</span>
                <span>{brief.area}</span>
              </span>
              <span className="rl-question-row-title">{brief.question}</span>
              <span className="rl-question-row-read">{brief.answerHeading}</span>
              {resultById.get(brief.id)?.matchedFields.length ? (
                <span className="rl-question-row-match">
                  Matched in {resultById.get(brief.id)?.matchedFields
                    .map((field) => field.replaceAll("-", " "))
                    .join(", ")}
                </span>
              ) : null}
            </span>
            <span className="rl-question-row-arrow" aria-hidden="true">→</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

export default function RoundsLab({
  initialQuestionId,
  initialScenario,
  hostedDraft = false,
}: {
  initialQuestionId?: string;
  initialScenario?: "movement" | "quiet";
  hostedDraft?: boolean;
}) {
  const initialBrief = initialQuestionId
    ? findRoundsQuestion(initialQuestionId, LOCAL_ROUNDS_BRIEFS)
    : undefined;
  const focusedQuestion = Boolean(initialBrief);
  const activeBrief = initialBrief ?? movementQuestions()[0] ?? LOCAL_ROUNDS_BRIEFS[0];
  const [libraryView, setLibraryView] = useState<LibraryView>("movement");
  const [query, setQuery] = useState("");
  const [quietScenario, setQuietScenario] = useState(initialScenario === "quiet");
  const [playback, setPlayback] = useState<RoundsPlayback | null>(null);
  const playbackRequestRef = useRef(0);
  const playbackTriggerRef = useRef<HTMLElement | null>(null);
  const searchResults = useMemo(
    () => searchRoundsQuestions(query, LOCAL_ROUNDS_BRIEFS),
    [query],
  );
  const searchQuestions = searchResults.map((result) => result.question);
  const currentMovement = useMemo(() => movementQuestions(), []);
  const watchQuestions = useMemo(() => watchedQuestions(), []);
  const reviewedThrough = LOCAL_ROUNDS_BRIEFS.reduce((earliest, brief) => (
    Date.parse(brief.movement.reviewedThrough) < Date.parse(earliest)
      ? brief.movement.reviewedThrough
      : earliest
  ), LOCAL_ROUNDS_BRIEFS[0]?.movement.reviewedThrough ?? "Not recorded");
  const quietExploreQuestions = QUIET_FRONT_DOOR_SCENARIO.exploreQuestionIds
    .map((questionId) => findRoundsQuestion(questionId, LOCAL_ROUNDS_BRIEFS))
    .filter((question): question is LocalDiscussionBrief => Boolean(question));
  const quietClocks = {
    simulatedLastVisit: QUIET_FRONT_DOOR_SCENARIO.lastVisitOn,
    lastMaterialChange: QUIET_FRONT_DOOR_SCENARIO.lastMaterialChangeOn,
    reviewedThrough: QUIET_FRONT_DOOR_SCENARIO.sourceConversationsReviewedThrough,
  };

  const openPlayer = (source: SourceConversation, reference: SourceReference) => {
    if (document.activeElement instanceof HTMLElement) playbackTriggerRef.current = document.activeElement;
    playbackRequestRef.current += 1;
    setPlayback({ source, reference, requestId: playbackRequestRef.current });
  };

  const closePlayer = () => {
    setPlayback(null);
    requestAnimationFrame(() => playbackTriggerRef.current?.focus({ preventScroll: true }));
  };

  const setScenario = (nextQuiet: boolean) => {
    setQuietScenario(nextQuiet);
    const url = new URL(window.location.href);
    if (nextQuiet) url.searchParams.set("scenario", "quiet");
    else url.searchParams.delete("scenario");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <div className={`rounds-lab${playback ? " has-player" : ""}`}>
      <header className="rl-masthead">
        <div className="rl-brand" aria-label="CanvasMD Rounds Lab">
          <span className="rl-brand-mark" aria-hidden="true">C</span>
          <span>CanvasMD</span>
          <span className="rl-brand-divider" aria-hidden="true" />
          <span className="rl-lab-name">Rounds Lab</span>
        </div>
        <nav className="rl-local-nav" aria-label={hostedDraft ? "Draft status" : "Local prototype tools"}>
          {!hostedDraft ? (
            <a href={focusedQuestion ? `/rounds-lab/reviewer?question=${encodeURIComponent(activeBrief.slug)}` : "/rounds-lab/reviewer"}>Reviewer</a>
          ) : null}
          <span className="rl-local-flag">{hostedDraft ? "Draft review surface" : "Local prototype"}</span>
        </nav>
      </header>

      {hostedDraft ? (
        <aside className="rl-draft-notice" aria-label="Draft status">
          <strong>Draft review surface</strong>
          <span>Editorial and verification checks remain open. Not clinical guidance.</span>
        </aside>
      ) : null}

      <main>
        {focusedQuestion ? (
          <div className="rl-focused-question">
            <nav className="rl-question-breadcrumb" aria-label="Question navigation">
              <a href="/rounds-lab">← All clinical questions</a>
              {!hostedDraft ? (
                <a href={`/rounds-lab/reviewer?question=${encodeURIComponent(activeBrief.slug)}`}>
                  Review evidence
                </a>
              ) : null}
            </nav>
            <div className="rl-current-question-anchor" id="current-question">
              <p className="rl-current-question-label">Clinical question brief</p>
              <RoundsBrief
                key={activeBrief.id}
                brief={activeBrief}
                playback={playback}
                onListen={openPlayer}
                idPrefix="reader"
              />
            </div>
          </div>
        ) : (
          <section className="rl-question-index" aria-labelledby="questions-being-tracked">
          <div className="rl-question-index-intro">
            <div>
              <p className="rl-eyebrow" id="questions-being-tracked">GU oncology briefings</p>
              <h1>The clinical questions worth following now.</h1>
              <p className="rl-product-promise">
                Start with what is new, see the short answer, then follow the evidence behind it.
              </p>
            </div>
            <div className="rl-index-status">
              <span>Current library evidence reviewed through {reviewedThrough}</span>
              <p className="rl-state-key" aria-label="Question state definitions">
                {(Object.keys(MOVEMENT_STATE_DESCRIPTIONS) as MovementState[]).map((state) => (
                  <span key={state} data-state={state}>
                    <strong>{state}</strong>
                    {MOVEMENT_STATE_DESCRIPTIONS[state]}
                  </span>
                ))}
              </p>
            </div>
          </div>

          <div className="rl-frontdoor-controls">
            <div className="rl-view-switch" aria-label="Question view">
              <button type="button" aria-pressed={libraryView === "movement"} onClick={() => setLibraryView("movement")}>
                What changed
              </button>
              <button type="button" aria-pressed={libraryView === "library"} onClick={() => setLibraryView("library")}>
                All questions <span>{LOCAL_ROUNDS_BRIEFS.length}</span>
              </button>
            </div>
            <button className="rl-scenario-link" type="button" onClick={() => setScenario(!quietScenario)}>
              {quietScenario ? "Show movement" : "Preview caught-up state"}
            </button>
          </div>

          {libraryView === "movement" && quietScenario ? (
            <div className="rl-caught-up" role="status">
              <p className="rl-section-label">You’re caught up</p>
              <h2>No meaningful movement since your simulated last visit.</h2>
              <dl>
                <div><dt>Last visit</dt><dd>{quietClocks.simulatedLastVisit}</dd></div>
                <div><dt>Last material change</dt><dd>{quietClocks.lastMaterialChange}</dd></div>
                <div><dt>Scenario evidence reviewed through</dt><dd>{quietClocks.reviewedThrough}</dd></div>
              </dl>
              <div className="rl-caught-up-explore">
                <div>
                  <h3>Explore other questions</h3>
                  <p>A short set of related clinical decisions.</p>
                </div>
                <QuestionRows
                  questions={quietExploreQuestions}
                  emptyLabel="No suggested questions yet."
                />
              </div>
              <button type="button" onClick={() => setLibraryView("library")}>Browse all questions</button>
            </div>
          ) : libraryView === "movement" ? (
            <div className="rl-movement-list" aria-labelledby="movement-heading">
              <div className="rl-list-heading">
                <h2 id="movement-heading">New questions and changed answers</h2>
                <p>Begin here when a question is new or the evidence changed the short answer.</p>
              </div>
              <QuestionRows
                questions={currentMovement}
                emptyLabel="No meaningful movement in the reviewed window."
              />
              {watchQuestions.length > 0 ? (
                <div className="rl-watch-list">
                  <div>
                    <h3>Watching</h3>
                    <p>Signals worth following that have not changed the answer yet.</p>
                  </div>
                  <QuestionRows
                    questions={watchQuestions}
                    emptyLabel="No Watch questions."
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rl-library" aria-labelledby="library-heading">
              <div className="rl-library-heading">
                <div>
                  <h2 id="library-heading">All clinical questions</h2>
                  <p>Search the latest brief. Each question keeps its source and revision history.</p>
                </div>
                <label className="rl-search">
                  <span className="sr-only">Search clinical questions</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search disease, treatment, biomarker, decision…"
                  />
                </label>
              </div>
              <p className="rl-result-count" aria-live="polite">
                {searchQuestions.length} {searchQuestions.length === 1 ? "question" : "questions"}
              </p>
              <QuestionRows
                questions={searchQuestions}
                searchResults={searchResults}
                emptyLabel="No tracked question matches this search."
              />
            </div>
          )}
          </section>
        )}
      </main>

      <footer className="rl-footer">
        <span>Curated draft question set</span>
        <span>Static fixture data</span>
        <span>No reader tracking</span>
        <span>Not clinical guidance</span>
      </footer>

      {playback && <RoundsPlayer playback={playback} onClose={closePlayer} />}
    </div>
  );
}
