import "server-only";

import { archivedEditorialArticle, EDITION_AREAS } from "@/app/briefing-preview/edition";
import {
  buildReadoutEditionSnapshot,
  appearedInMorningEdition,
  isReadoutEditionSnapshot,
  mergeReadoutEditionSnapshot,
  type ReadoutEditionSnapshot,
} from "@/app/briefing-preview/editionSnapshot";
import {
  activeReadoutEditionDate,
  etEditionDate,
  etEditionHour,
  hasFrozenPrepublishedEdition,
  hasScheduledReadoutSourceRun,
  prepublicationEditionDate,
  scheduledReadoutSourceRunId,
} from "@/app/briefing-preview/readoutRequest";
import {
  canonicalReadoutEditionSnapshot,
  readoutEditionForArea,
} from "@/app/briefing-preview/editionHistory";
import {
  fetchFreshReadoutWindowForPrepublication,
  fetchFreshReadoutWindowForInsertions,
  supabaseApiKeyHeaders,
  withReadoutSelectionVersion,
} from "@/lib/readoutWindowServer";
import {
  assertReadoutCandidateBuildUnchanged,
  refreshReadoutCandidatesForEdition,
} from "@/lib/readoutCandidateRefresh";
import { readoutAttentionAnchor } from "@/lib/readoutAttention";

function supabaseServiceEnvironment() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service environment for edition archive.");
  return { url, key };
}

function throwIfAborted(signal?: AbortSignal) { if (signal?.aborted) throw new Error("Readout canonical publication aborted before write."); }

async function writeEditionRow(snapshot: ReadoutEditionSnapshot, signal?: AbortSignal) {
  throwIfAborted(signal);
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(`${url}/rest/v1/readout_posts?on_conflict=tok`, {
    method: "POST",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify([{
      tok: `edition:v2:${snapshot.editionDate}:All`,
      area: "All",
      kind: "edition",
      headline: `The Readout ${snapshot.editionDate} All`,
      card: snapshot,
      evidence: {},
      last_seen: snapshot.generatedAt,
    }]),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Edition archive returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function readEditionRow(editionDate: string): Promise<ReadoutEditionSnapshot | null> {
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(`edition:v2:${editionDate}:All`);
  const response = await fetch(`${url}/rest/v1/readout_posts?select=card&tok=eq.${tok}&limit=1`, {
    headers: supabaseApiKeyHeaders(key),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Edition lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return isReadoutEditionSnapshot(rows[0]?.card) ? rows[0].card : null;
}

function validPrepublishedEdition(snapshot: ReadoutEditionSnapshot | null, editionDate: string): snapshot is ReadoutEditionSnapshot {
  return hasFrozenPrepublishedEdition(snapshot, editionDate);
}

type SourceSnapshotRow = { area?: unknown; data?: { build?: { sourceRunId?: unknown } }; generated_at?: unknown };
const MORNING_SOURCE_AREAS = EDITION_AREAS.filter((area) => area !== "All");

/** The pre-6am edition may only derive from all seven frozen specialty source sets. */
async function assertScheduledMorningSource(now: Date) {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(
    `${url}/rest/v1/briefing_snapshots?select=area,data,generated_at&area=in.(${MORNING_SOURCE_AREAS.join(",")})`,
    { headers: supabaseApiKeyHeaders(key), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Morning source lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as SourceSnapshotRow[];
  const expected = scheduledReadoutSourceRunId(now);
  const missing = MORNING_SOURCE_AREAS.filter((area) => {
    const row = rows.find((candidate) => candidate.area === area);
    return !row || !hasScheduledReadoutSourceRun(row.data?.build?.sourceRunId, now) ||
      typeof row.generated_at !== "string" || !Number.isFinite(Date.parse(row.generated_at));
  });
  if (missing.length) throw new Error(`Morning source is incomplete for ${missing.join(", ")}; expected ${expected}.`);
}

async function readEditionRows(): Promise<ReadoutEditionSnapshot[]> {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(
    `${url}/rest/v1/readout_posts?select=card&kind=eq.edition&area=eq.All&order=last_seen.desc`,
    { headers: supabaseApiKeyHeaders(key), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Edition history lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return rows.map((row) => row.card).filter(isReadoutEditionSnapshot);
}

async function readAllEditionRows(): Promise<ReadoutEditionSnapshot[]> {
  const { url, key } = supabaseServiceEnvironment();
  const response = await fetch(
    `${url}/rest/v1/readout_posts?select=card&kind=eq.edition&order=last_seen.desc`,
    { headers: supabaseApiKeyHeaders(key), cache: "no-store" },
  );
  if (!response.ok) throw new Error(`Edition repair lookup returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const rows = await response.json() as Array<{ card?: unknown }>;
  return rows.map((row) => row.card).filter(isReadoutEditionSnapshot);
}

async function updateEditionRow(snapshot: ReadoutEditionSnapshot, signal?: AbortSignal) {
  throwIfAborted(signal);
  const { url, key } = supabaseServiceEnvironment();
  const tok = encodeURIComponent(`edition:v2:${snapshot.editionDate}:All`);
  const response = await fetch(`${url}/rest/v1/readout_posts?tok=eq.${tok}`, {
    method: "PATCH",
    headers: {
      ...supabaseApiKeyHeaders(key),
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify({ card: snapshot, last_seen: snapshot.updatedAt ?? snapshot.generatedAt }),
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(`Edition update returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function priorEditions(
  editionDate: string,
  history: unknown[],
): Promise<ReadoutEditionSnapshot[]> {
  const stored = await readEditionRows();
  const candidates = [...stored, ...history.filter(isReadoutEditionSnapshot)]
    .filter(isReadoutEditionSnapshot)
    .filter((snapshot) => snapshot.area === "All")
    .filter((snapshot) => snapshot.editionDate < editionDate);
  const seen = new Set<string>();
  return candidates.filter((snapshot) => {
    const key = `${snapshot.editionDate}:${snapshot.generatedAt}:${snapshot.area}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function writeSelectionAudit(snapshot: ReadoutEditionSnapshot, candidateBuild: { runId: string; generatedAt: string }, audit: unknown, candidateCards: unknown[], previous: ReadoutEditionSnapshot[], captureKind: "prepublication" | "fallback" | "repair", signal?: AbortSignal) {
  throwIfAborted(signal);
  const { url, key } = supabaseServiceEnvironment();
  const source = audit as { scope?: unknown; papers?: Array<Record<string, unknown>> } | null;
  if (source?.scope !== "source-admitted-candidates" || !Array.isArray(source.papers)) throw new Error("Selection audit receipt is missing or malformed.");
  const selectedIds = new Set([...snapshot.developments.map((x) => x.development.id), ...snapshot.relevant.map((x) => x.article.id)]);
  const candidates = new Map(candidateCards.map((card) => {
    const article = archivedEditorialArticle(card as any);
    return [article.id, article] as const;
  }));
  const papers: Array<Record<string, unknown>> = source.papers.map((paper): Record<string, unknown> => {
    const id = typeof paper.id === "string" ? paper.id : "";
    const selected = selectedIds.has(id);
    const candidate = candidates.get(id);
    const priorMorning = candidate ? appearedInMorningEdition(candidate, previous) : false;
    return { ...paper, selected, selectionReason: selected ? "selected" : paper.eligible === false ? paper.reason : priorMorning ? "prior_morning_repeat" : "not_selected" };
  });
  for (const id of selectedIds) if (!papers.some((paper) => paper.id === id)) papers.push({ id, eligible: null, selected: true, selectionReason: "selected_audit_eligibility_unknown" });
  throwIfAborted(signal);
  const response = await fetch(`${url}/rest/v1/readout_edition_selection_audits?on_conflict=edition_date,selection_version`, { method: "POST", headers: { ...supabaseApiKeyHeaders(key), "content-type": "application/json", prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify([{ edition_date: snapshot.editionDate, selection_version: snapshot.selectionVersion, candidate_build_run_id: candidateBuild.runId, candidate_generated_at: candidateBuild.generatedAt, attention_anchor: snapshot.attentionAnchor ?? null, papers, capture_kind: captureKind }]), cache: "no-store", signal });
  if (!response.ok) throw new Error(`Selection audit write returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
}

async function buildCanonicalEdition(
  now: Date,
  options: { editionDate?: string; prepublication?: boolean; signal?: AbortSignal; captureKind?: "prepublication" | "fallback" | "repair" } = {},
): Promise<ReadoutEditionSnapshot> {
  const editionDate = options.editionDate ?? activeReadoutEditionDate(now);
  const attentionAnchor = readoutAttentionAnchor(editionDate);
  const { url, key } = supabaseServiceEnvironment();
  const candidateEnvironment = { url, headers: supabaseApiKeyHeaders(key) };
  const candidateBuild = await refreshReadoutCandidatesForEdition(candidateEnvironment, { signal: options.signal });
  const previousCanonical = await priorEditions(editionDate, []);
  let selectionAudit: unknown = null;
  let selectionAuditCards: unknown[] = [];
  const snapshots = await Promise.all(EDITION_AREAS.map(async (area) => {
    // Every new canonical must consume the just-completed candidate build, not
    // a one-hour source cache. Existing saved editions bypass this constructor.
    const payload = await fetchFreshReadoutWindowForPrepublication(area, editionDate, attentionAnchor, { includeSelectionAudit: area === "All", signal: options.signal });
    if (area === "All") { selectionAudit = (payload as any).selectionAudit ?? null; selectionAuditCards = [...(payload.cards ?? []), ...(payload.moreCards ?? [])]; }
    if (payload.stale === true) {
      throw new Error(`Prepublication source is stale for ${area}.`);
    }
    if (payload.attentionWindow?.startAt !== attentionAnchor.startAt ||
        payload.attentionWindow.editionDate !== editionDate || payload.attentionWindow.kind !== "edition") {
      throw new Error(`Prepublication attention window is missing or mismatched for ${area}.`);
    }
    const previousForArea = previousCanonical
      .map((snapshot) => readoutEditionForArea(snapshot, area))
      .filter((snapshot): snapshot is ReadoutEditionSnapshot => !!snapshot);
    return { ...buildReadoutEditionSnapshot(area, payload, now, previousForArea, editionDate), attentionAnchor };
  }));
  const canonical = canonicalReadoutEditionSnapshot(snapshots);
  if (!canonical) throw new Error("The canonical All edition could not be built.");
  await assertReadoutCandidateBuildUnchanged(candidateEnvironment, candidateBuild);
  const versioned = await withReadoutSelectionVersion({ ...canonical, candidateBuild });
  await writeSelectionAudit(versioned, candidateBuild, selectionAudit, selectionAuditCards, previousCanonical, options.captureKind ?? (options.prepublication ? "prepublication" : "fallback"), options.signal);
  return versioned;
}

/** Consolidate exact rows saved by the old per-specialty archive. This repairs
 * history without synthesizing a story that was not present in a saved edition. */
async function consolidateStoredEditions(signal?: AbortSignal): Promise<string[]> {
  const stored = await readAllEditionRows();
  const dates = [...new Set(stored.map((snapshot) => snapshot.editionDate))];
  const consolidated: string[] = [];
  for (const editionDate of dates) {
    const canonical = canonicalReadoutEditionSnapshot(
      stored.filter((snapshot) => snapshot.editionDate === editionDate),
    );
    if (!canonical) continue;
    await updateEditionRow(canonical, signal);
    consolidated.push(editionDate);
  }
  return consolidated;
}

/** Explicit, service-authenticated repair for a bad saved morning payload. */
export async function rebuildCurrentReadoutEdition(now = new Date(), signal?: AbortSignal) {
  const editionDate = activeReadoutEditionDate(now);
  const consolidated = await consolidateStoredEditions(signal);
  const snapshot = await buildCanonicalEdition(now, { signal, captureKind: "repair" });
  const existing = await readEditionRow(editionDate);
  if (existing) await updateEditionRow(snapshot, signal);
  else await writeEditionRow(snapshot, signal);
  return { editionDate, rebuilt: ["All"], consolidated, selectionVersion: snapshot.selectionVersion ?? null };
}

export async function archiveCurrentReadoutEdition(now = new Date(), signal?: AbortSignal) {
  const editionDate = etEditionDate(now);
  if (etEditionHour(now) !== 6) return { editionDate, archived: [], skipped: "outside-6am-et" };
  const existing = await readEditionRow(editionDate);
  if (validPrepublishedEdition(existing, editionDate)) {
    return { editionDate, archived: ["All"], skipped: "prepublished", selectionVersion: existing.selectionVersion ?? null };
  }
  const snapshot = await buildCanonicalEdition(now, { signal });
  await writeEditionRow(snapshot, signal);
  return { editionDate, archived: ["All"], skipped: null, selectionVersion: snapshot.selectionVersion ?? null };
}

/**
 * Build the next public day without changing the public rollover. This writes only
 * `edition:v2:<today ET>:All`; all browser/current-window reads remain pinned to
 * yesterday until `activeReadoutEditionDate()` switches at 06:00 ET. The audio
 * publisher may read this exact service-role row before 06:00, but must require
 * schemaVersion 2, area All, the requested ET date, and selectionVersion.
 */
export async function prepublishCurrentReadoutEdition(now = new Date(), signal?: AbortSignal) {
  const editionDate = prepublicationEditionDate(now);
  if (etEditionHour(now) !== 5) {
    return { editionDate, prepublished: [], skipped: "outside-5am-et" as const };
  }
  // A retry must never replace a selection that narration might already be using.
  const existing = await readEditionRow(editionDate);
  if (validPrepublishedEdition(existing, editionDate)) {
    return { editionDate, prepublished: ["All"], selectionVersion: existing.selectionVersion, skipped: "already-prepublished" as const };
  }
  if (existing) throw new Error(`Existing ${editionDate} canonical edition is not a valid prepublication.`);
  await assertScheduledMorningSource(now);
  const snapshot = await buildCanonicalEdition(now, { editionDate, prepublication: true, signal });
  await writeEditionRow(snapshot, signal);
  return { editionDate, prepublished: ["All"], selectionVersion: snapshot.selectionVersion ?? null, skipped: null };
}

export async function mergeCurrentReadoutEditionInsertions(now = new Date(), signal?: AbortSignal) {
  const editionDate = activeReadoutEditionDate(now);
  const snapshot = await readEditionRow(editionDate);
  if (!snapshot) {
    if (etEditionHour(now) < 6) return { editionDate, results: [], changed: false, skipped: "no-morning-edition" as const };
    const created = await buildCanonicalEdition(now, { signal });
    await writeEditionRow(created, signal);
    return { editionDate, results: [{ area: "All", inserted: [], skipped: null, bootstrapped: true }], changed: true };
  }

  const previousCanonical = await priorEditions(editionDate, []);
  const mergedByArea = await Promise.all(EDITION_AREAS.map(async (area) => {
    const currentForArea = readoutEditionForArea(snapshot, area);
    if (!currentForArea) throw new Error(`Canonical edition cannot project ${area}.`);
    const payload = await fetchFreshReadoutWindowForInsertions(area);
    const previousForArea = previousCanonical
      .map((edition) => readoutEditionForArea(edition, area))
      .filter((edition): edition is ReadoutEditionSnapshot => !!edition);
    return mergeReadoutEditionSnapshot(currentForArea, payload, now, previousForArea);
  }));
  const merged = canonicalReadoutEditionSnapshot(mergedByArea);
  if (!merged) throw new Error("The merged canonical edition could not be built.");
  const inserted = (merged.middayInsertions ?? []).filter((id) => !(snapshot.middayInsertions ?? []).includes(id));
  const changed = JSON.stringify(merged) !== JSON.stringify(snapshot);
  if (changed) await updateEditionRow(merged, signal);
  return {
    editionDate,
    results: [{ area: "All", inserted, skipped: changed ? null : "no-new-development", bootstrapped: false }],
    changed,
  };
}
