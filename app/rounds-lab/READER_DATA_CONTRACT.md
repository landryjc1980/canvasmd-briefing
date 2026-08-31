# Rounds reader-data contract

**Status:** Binding design constraint for any future reader tracking or personalization. The current `/rounds-lab` prototype collects no reader behavior and uses explicit local scenarios instead. Implementing this contract requires separate privacy, security, legal, and clinical-governance review; this document alone is not consent to begin collection.

## Load-bearing boundary

Clinician reading behavior is reader-product data, not pharma intelligence. What a clinician opens, searches, replays, follows, or revisits may imply perceived knowledge gaps, decision concerns, or patient mix. Rounds therefore keeps behavior data logically and operationally separate from every pharma-facing intelligence pipeline.

Reader behavior is never sold, licensed, disclosed, or made queryable to a pharma customer—individually, pseudonymously, as a segment, or in a small-N or ostensibly aggregated report. A commercial request does not override this rule. Product identifiers, access roles, storage, transformations, exports, and deletion jobs must enforce the boundary rather than relying on policy language alone.

## Data classes and minimization

If a future feature is approved, it may collect only the minimum data necessary for a reader-visible purpose:

- account-level visit checkpoints needed to explain “since your last visit”;
- question events needed for a reader's own read/unread, saved, or followed state;
- explicit reader preferences and consent records;
- search and playback events only when separately justified, disclosed, and opted into; and
- coarse product-health telemetry that cannot reveal an individual's clinical interests.

Raw audio, transcript contents, inferred diagnoses, inferred patient panels, clinical notes, protected health information, precise location, employer data, and third-party data enrichment are outside this contract. The system must not infer a clinician's competence, knowledge gap, prescribing intent, patient identity, or patient mix from reading behavior.

## Permitted uses

Opted-in reader data may be used only to provide or improve a feature visible to that reader, maintain cross-device continuity, protect account security, diagnose reliability or accessibility defects, and evaluate product quality internally under the access and aggregation rules below.

Initial recommendations, if later approved, are finite and explainable. They use first-class editorial tags—such as disease, stage, decision type, modality, drug, biomarker, procedure, patient-management dimension, and clinical role—and say why an item is shown (for example, “Related to your recent reading about treatment duration”). They are capped, never an infinite feed, and do not use collaborative filtering, “readers like you,” commercial priority, or engagement-maximizing rank.

## Prohibited uses

Reader behavior must not be used for:

- pharma-facing intelligence, targeting, lead generation, market research, sales enablement, segmentation, or measurement;
- individual or small-cohort reports, including filters that could reveal specialty, institution, geography, disease interest, or likely patient mix;
- advertising, sponsored ranking, pricing, eligibility, credentialing, employment, or insurance decisions;
- collaborative-filtering profiles, opaque engagement scores, or addictive/infinite recommendation loops;
- joining to prescription, claims, CRM, conference, identity-broker, or pharma datasets;
- training a general-purpose model or customer model without a new, specific opt-in and separate approved contract; or
- autonomous clinical, editorial, or publication decisions.

De-identification does not convert prohibited pharma use into permitted use. Removing a name while retaining a stable identifier, rare specialty, institution, geography, or narrow question history is still reader behavior under this contract.

## Consent and reader control

Collection is **off by default**. Consent is informed, specific, freely given, and separate from access to the unpersonalized question library. Search, playback, cross-device history, recommendations, and product research use are disclosed separately when their data needs differ. The interface explains what is collected, why, retention, who can access it, and that it is not shared with pharma customers.

A reader can inspect consent and stored preferences, pause collection, reset history, opt out without losing the unpersonalized product, export their data, and withdraw consent as easily as it was granted. Withdrawal stops new collection immediately. Consent is versioned and re-requested when purpose or data class materially changes; silence, continued use, bundled terms, or a prechecked control is not consent.

## Account continuity and event semantics

Reader continuity is account-level, not device-local. A clinician switching between phone and desktop must receive one truthful history. The “since your last visit” snapshot is frozen when the page loads so items do not disappear while being read. It is calculated from immutable events, not only current question states; movement that occurred and later settled remains visible for the applicable visit window.

The reader-facing explanation distinguishes the reader's last visit, the last material question change, and conversations reviewed through. Tracking never changes the editorial state itself, which remains shared and editor-controlled.

## Access and operational separation

Access follows least privilege and is logged. A small, named reader-product operations group may access identifiable records only for documented support, security, deletion, or reliability work. Editorial staff see a reader's behavior only when that reader deliberately submits it with feedback. Pharma, commercial sales, customer-success, external sponsors, and pharma-intelligence personnel have no row-level, segment-level, query, export, model, or dashboard access.

Reader identifiers and event stores use separate schemas, service credentials, warehouses, queues, exports, and analytics projects from pharma intelligence. No shared stable identifier or reverse-lookup table crosses the boundary. Derived datasets inherit the same restrictions. Access is reviewed quarterly; every emergency access is time-bounded, audited, and reviewed afterward.

## Retention, reset, deletion, and export

- Identifiable fine-grained search, open, and playback events expire after **90 days** unless the reader deletes them sooner.
- Account-level visit checkpoints, saved/followed questions, explicit preferences, and consent records remain while the feature is active, until reset, or until account deletion. Superseded consent receipts may be retained only as required to prove the reader's choices.
- Eligible de-identified internal product-health aggregates expire after **13 months** and cannot be converted back to person-level or question-history data.
- Reset removes personalization history and derived recommendations immediately from the active product. Account deletion or consent withdrawal queues deletion from active stores immediately and completes removal from recoverable backups within **30 days**, subject only to a documented legal or security hold disclosed to the reader.

Before deletion, a reader can export a machine-readable local copy containing their consent receipts, preferences, visit checkpoints, saved/followed state, and retained fine-grained events. Export excludes other readers, internal security signals, pharma datasets, and the intentionally wrong correction-test fixture. Exports are authenticated, time-limited, and audited.

## Aggregation and small-N protection

Reader behavior never appears in pharma-facing outputs, including aggregates. For permitted internal product-health analysis, every released cell must contain at least **50 distinct opted-in readers** over the reporting window, and no combination of filters or differencing may reconstruct a smaller cell. Rare dimensions are coarsened or suppressed. Institution, precise geography, narrow specialty, individual question, timestamp, and free-text search terms are not combined when they could reveal a reader or patient mix.

Minimum-N is a floor, not a safe harbor. Privacy review may require a larger threshold, differential privacy, broader time windows, or no analysis at all. Raw small-N results remain restricted to the automated system performing suppression and are not exposed in dashboards, logs, downloads, or model prompts.

## Change control and enforcement

Any new event, purpose, recipient, retention period, recommender method, export, vendor, or commercial use requires a documented privacy impact review, updated data map, threat model, consent assessment, deletion test, and approval before collection. Automated tests must prove that the local prototype has no behavior collection, pharma-facing code cannot import reader-event data, consent gates precede writes, retention and deletion jobs work, and small-N suppression cannot be bypassed.

If code and this contract conflict, collection stops. The safe fallback is the fully functional, unpersonalized movement front door and searchable canonical question library.
