# Rounds Lab publication contract

**Scope:** This contract governs the hand-curated `/rounds-lab` draft reader fixture and the development-only `/rounds-lab/reviewer` fixture. The reader may be exposed as a noindexed draft review surface, but doing so does not make it a production workflow, clinical guidance, or an editorially published brief. A Rounds brief reports what selected source conversations are discussing; it does not establish consensus, count clinicians, estimate field prevalence, or make a treatment recommendation.

## Durable product model

Rounds is a persistent library of consequential clinical questions, not a feed of podcast episodes. Each question has a stable canonical ID and URL, one current reviewed brief, immutable prior versions, movement and review events, source-conversation provenance, separately stored clinical facts, correction history when applicable, and first-class editorial tags. Search and links resolve to the current canonical question; an archived version is reached only from that question's explicit history.

New episodes may propose a new question, but only the accountable editor may create one. Before creating it, the editor searches the library and either merges the evidence into an existing question, relates the questions explicitly, or documents why a distinct question is necessary. An episode is evidence for a question, never the product's organizing unit.

The front door is movement-first. It prioritizes `Newly tracked` and `Updated` questions, may separately surface `Watch` signals, and keeps `Steady` questions in **All tracked clinical questions**. Rounds never publishes to satisfy a daily or weekly cadence.

When no question materially changed, the front door renders an active caught-up statement and names three different clocks without conflating them:

- the reader's **simulated last visit**;
- the question library's **last material change**; and
- **source conversations reviewed through**.

The local prototype uses named fixture scenarios for these clocks and does not collect reader behavior. A future account-aware delta must be frozen at page load and calculated from immutable events, not inferred from current states; a question that changed and later became `Steady` must not disappear from the reader's since-last-visit record.

## Exact editorial states

States describe editorial handling of selected conversations, not importance, consensus, correctness, urgency, or prevalence. The state vocabulary is closed:

- **Newly tracked** — the first editor-reviewed appearance of a durable clinical question. It has a current brief but no earlier published version.
- **Updated** — new information materially changed the current read, decision boundary, patient factors, clinical context, or material uncertainty of an existing question.
- **Watch** — a notable, decision-relevant signal appeared, but the current read did not materially change. A high-signal episode triggers review; it does not automatically prove movement.
- **Steady** — the selected corpus was reviewed again and no meaningful change to the current read was found. The review event and reviewed-through date still advance.

An **external clinical trigger** is a trial result, approval, safety communication, guideline change, or other human-verified event. **Conversation movement** is a material change in how selected episodes discuss a question. Either may occur without the other, so every event records `why now`, `what changed`, and what remained stable.

Repetition alone does not establish movement. A cross-source synthesis that claims change across conversations ordinarily requires at least two genuinely independent source/editorial families. The accountable editor may admit a durable question as `Newly tracked` from one credible conversation; that state records the question's first reviewed appearance, not corroborated movement. Any single-source or commercially supported basis must remain visibly bounded in the reader and reviewer, and it cannot be described or scored as corroboration. A single conversation can also support a carefully bounded `Watch` or `Steady` record when those state definitions are otherwise met.

## Human accountability and gates

Each externally published brief has **one accountable publishing editor**. That editor owns the canonical question, reviews the complete selected source conversations, determines the state, approves the synthesis and claim mapping, and makes the publication decision.

Every new or materially changed clinical fact must be independently verified before publication by a qualified human other than the publishing editor, using current primary or authoritative sources. The record identifies the fact, verifier, source, jurisdiction and population where relevant, and completion time. Unchanged facts retain their prior verification record unless recency, safety, jurisdiction, or a correction creates a reason to recheck them.

Additional human review of an interpretation is risk-based, not automatic. It is required when documented triggers apply, including materially conflicting conversations, off-label or safety-sensitive framing, commercially supported evidence (including episode sponsorship or educational grants) without independent corroboration, uncertain source independence, a high-consequence inference, or a correction that could change clinical interpretation. A completed verification or interpretive review always records a nonblank human identity and valid completion time; a status alone cannot clear a gate.

AI may assist with extraction, transcript organization, tagging, candidate-question detection, state proposals, claim mapping, and drafting. AI output remains a proposal until the accountable editor accepts it. **AI never serves as the independent verifier and never publishes autonomously.** A model-generated date, source lookup, confidence score, or reviewer simulation cannot be displayed as completed human verification.

A local audit may record that AI read a complete candidate asset from beginning to end and ran a challenge search. That editorial-process receipt never upgrades the asset's publication completeness, attests word accuracy, substitutes for the accountable editor, or clears any human verification or interpretive-review gate.

The reviewer may approve editorial language while publication remains blocked. A gate blocks external publication whenever a required clinical-fact verifier is missing, is the publishing editor, or has not completed review; a required interpretive review is incomplete; a material claim lacks traceable support; a required complete transcript is unavailable; or a correction is unresolved. The workbench has no bypass labeled as publication.

## Sources, transcripts, independence, and support

- The public unit of conversation evidence is the **show and episode**, never an individual clinician. The reader opens the complete source episode in context at the relevant timestamp; isolated speaker clips are not used.
- Source weight reflects relevance, specialization, recency, depth, proximity to primary data, disclosure context, and editorial independence. It is not a vote count.
- Multiple episodes from the same show can establish a useful timeline but are not automatically independent. Different shows may also share a trial team, conference presentation, guest circuit, or commissioned program.
- Uromigos episodes in this fixture are recorded as unsponsored episode-level sources. That disclosure does not by itself establish independence or accuracy, and repeated Uromigos episodes still belong to the same editorial family.
- Sponsor-supported, industry-supported, CME, society, and publisher-produced conversations may be included when relevant. Support and provenance are recorded at the episode level and carried into every claim mapping they support. Sponsorship neither automatically includes nor excludes a source.

Transcript **access scope** and **publication completeness** are separate. Access scope records whether the workbench has a searchable full-conversation transcript, bounded evidence windows, or no local text. A reviewer may search a publisher transcript or a locally generated machine transcript before CanvasMD has attested it, but the interface must identify its origin and method, show measured temporal span, and state whether human accuracy review and a completeness receipt are recorded. Search access never clears a publication gate.

Transcript status is explicit for every source at the publication layer: `complete`, `partial`, `unavailable`, or `rights-restricted`, with origin and last check recorded. **Complete** means the entire source conversation—not selected excerpts, a summary, chapter markers, or a generated reconstruction—has known origin and method, transcript-like density and lexical variation, time-coded segments no longer than two minutes across the source duration, and a whole-conversation completeness receipt with the checker, completion time, asset identifier, SHA-256 content digest, segment count, and duration. The reviewer recomputes that digest from the canonical current segments, so a changed transcript invalidates its receipt. Density, variation, temporal-span, and segmentation checks are fail-closed screening heuristics; the content-bound human receipt is the provenance record that distinguishes a searchable candidate from a publication-attested complete asset. A machine transcript must be labeled as such. A publisher transcript that omits opening or closing seconds may still provide full-conversation search access while remaining `partial` under the stricter publication status. Missing or incomplete transcript coverage is shown honestly and cannot be represented as completed human review.

Every cited passage includes its timestamp and enough surrounding context to assess the meaning. The workbench opens the complete audio or video at that moment and retains a path to the complete episode. If a complete searchable transcript is required for a material claim but is not lawfully available, that claim is blocked rather than filled with invented text.

## Claim and fact provenance

Each material discussion claim has a stable claim ID, exact episode references, relevant start timestamps, context passages, source role, support disclosure, and internal independence-family identifier. The structured AI audit records observable inputs only: evidence used, support mode (`direct support`, `paraphrase`, `cross-source synthesis`, `clinical fact — source checked`, `verified fact`, or `editorial interpretation`), relevance rationale, considered-but-excluded sources and reasons, conflicting or qualifying evidence, material uncertainty, state rationale, and wording changes from the prior version. `Verified fact` is reserved for completed human verification; a local draft awaiting that gate is labeled `clinical-fact-source-check`. Private chain-of-thought or model scratch work is never presented as provenance.

Every claim must resolve to at least one existing source and passage. Every referenced passage must resolve back to its complete episode and transcript status. A cross-source claim identifies each contributing source; sponsorship and shared editorial families remain visible. The episode/show remains the public attribution unit, and synthesis copy does not attribute a position to a named clinician.

Clinical facts are stored separately from discussion claims. Each fact has a stable fact ID, precise assertion, primary or authoritative evidence IDs and URLs, relevant population and jurisdiction, and a human-verification status. Effect estimates retain comparator, endpoint, time horizon, and uncertainty when available. `Source checked` records editorial source inspection; it is not interchangeable with `independently verified`. `Source conversations reviewed through` describes the conversation window and never substitutes for clinical-fact verification.

## Versions, events, and corrections

The canonical question points to exactly one eligible current version. Published versions are immutable snapshots. Every material revision creates a new version and event recording date, prior state, trigger, changed claims or facts, what stayed stable, accountable editor, independent fact verification when required, and any risk-based interpretive review. A `Steady` review can create an event without rewriting an unchanged brief.

Typographic fixes may be silent. Any error that could alter clinical interpretation requires a visible correction note, prompt re-verification, a superseding version, and preservation of the earlier version in corrected history. Safe correction that cannot be completed promptly requires withdrawal.

An intentionally wrong value used to exercise the local correction workflow is correction-test-only data. It must be marked in the data, ineligible as current, accessible only inside the reviewer correction-history context, excluded from reader rendering, search indexes, recommendations, ordinary exports, and every non-Rounds or production surface. Tests must fail if any of those protections regress. A fixture correction never implies that independent human verification actually occurred.

## Development and production gate

The draft reader remains noindexed and disconnected from production databases, analytics, and publishing systems. A hosted copy must visibly identify itself as a draft review surface. The reviewer route remains inaccessible in production; its transcript assets and browser-local review state are never part of the hosted reader. Local review state may persist only in the browser and may export only a clearly labeled local review record.

Production remains blocked until there is an accountable workflow; independent fact-verification enforcement; risk-review criteria; structured claim, transcript, and fact provenance; independence and support-disclosure review; correction and withdrawal operations; audio, transcript, and publisher-rights review; production-grade accessibility, security, privacy, player, and end-to-end tests; and an editorial backtest demonstrating that the four states can be applied consistently without forcing publication cadence. No model, feed, scheduled job, or reviewer-prototype control may publish directly to a clinician-facing surface.
