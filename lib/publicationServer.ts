import "server-only";
import { supabaseApiKeyHeaders } from "@/lib/readoutWindowServer";
import {
  articleKey,
  ownArticlePick,
  publicationName,
  publicationStatusOf,
  type OwnArticlePick,
  type PublicationEntry,
  type SavedPublication,
} from "@/lib/publicationDisplay";
import type { ReadoutWindowPayload } from "@/lib/types";
import type { ConferenceWindowPayload } from "@/lib/conference";

// Publication registry step 4: the Readout web's live registry read. Names are
// resolved at read time, after every cache, and never frozen into an edition or a
// cached window. Same lookup as the app's fetchArticlePublications
// (lib/publication-core.ts): v_article_publication, then publications, 100 ids per
// request, all or nothing. Here a failure returns null (never throws to the page).

type Json = Record<string, unknown>;

const BATCH = 100;
const CONCURRENCY = 4;
const LOOKUP_TIMEOUT_MS = 2_500;

const nonEmpty = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const isObject = (value: unknown): value is Json => !!value && typeof value === "object" && !Array.isArray(value);

async function selectIn(
  url: string,
  key: string,
  table: string,
  columns: string,
  column: string,
  ids: readonly string[],
  signal: AbortSignal,
): Promise<Json[]> {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += BATCH) batches.push(ids.slice(index, index + BATCH));
  const out: Json[] = [];
  for (let index = 0; index < batches.length; index += CONCURRENCY) {
    const results = await Promise.all(batches.slice(index, index + CONCURRENCY).map(async (batch) => {
      const response = await fetch(
        `${url}/rest/v1/${table}?select=${columns}&${column}=in.(${batch.map(encodeURIComponent).join(",")})`,
        { headers: supabaseApiKeyHeaders(key), cache: "no-store", signal },
      );
      if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
      return response.json() as Promise<unknown>;
    }));
    for (const data of results) if (Array.isArray(data)) out.push(...data.filter(isObject));
  }
  return out;
}

/**
 * Article id -> registry status and name for every valid id that has a row, or
 * null when the lookup failed (any non-OK response, error or the 2.5 s bound).
 * A resolved row whose publication has no name is left out.
 */
export async function fetchArticlePublications(
  articleIds: Iterable<unknown>,
  signal?: AbortSignal,
): Promise<Map<string, PublicationEntry> | null> {
  const ids = [...new Set([...articleIds].flatMap((id) => {
    const value = articleKey(id);
    return value ? [value] : [];
  }))];
  const publications = new Map<string, PublicationEntry>();
  if (!ids.length) return publications;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[publications] registry lookup skipped: missing Supabase service environment.");
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) throw new Error("aborted");
    const rows = await selectIn(url, key, "v_article_publication", "article_id,publication_id,status", "article_id", ids, controller.signal);
    const resolvedPublicationIds = [...new Set(rows.flatMap((row) =>
      row.status === "resolved" && nonEmpty(row.publication_id) ? [String(row.publication_id).trim()] : []))];
    const names = new Map<string, string>();
    if (resolvedPublicationIds.length) {
      for (const row of await selectIn(url, key, "publications", "id,name", "id", resolvedPublicationIds, controller.signal)) {
        const name = nonEmpty(row.name);
        if (row.id != null && name) names.set(String(row.id), name);
      }
    }
    for (const row of rows) {
      const articleId = articleKey(row.article_id);
      const status = publicationStatusOf(row.status);
      if (!articleId || !status) continue;
      if (status === "resolved") {
        const publicationId = nonEmpty(row.publication_id);
        const name = publicationId ? names.get(publicationId) : undefined;
        if (name) publications.set(articleId, { status: "resolved", name });
      } else {
        publications.set(articleId, { status, name: null });
      }
    }
    return publications;
  } catch (error) {
    // One failed batch fails the lookup; stop the sibling requests still in flight.
    controller.abort();
    console.error("[publications] registry lookup failed:", error instanceof Error ? error.message : String(error));
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

/** The registry map for these ids (null when the lookup failed). */
export function resolvePublicationNames(ids: Iterable<unknown>): Promise<Map<string, PublicationEntry> | null> {
  return fetchArticlePublications(ids);
}

/** Adds `key` to a copy of the item only when rule 1 or 2 decided (string or null). */
function decorate<T>(item: T, name: string | null | undefined, key: string): T {
  return name === undefined || !isObject(item) ? item : { ...item, [key]: name };
}

const isEpisodeItem = (item: unknown): boolean =>
  isObject(item) && (item.kind === "episode" || "episodeId" in item);

// FDA cards keep their label (plan: "Episodes, regulatory (FDA) cards and X threads are not
// articles"). An archived event card carries nickname "REGULATORY"; a regulatory candidate
// carries sourceAction "View FDA source". Their ids point at coverage, not at a publication.
const isRegulatoryItem = (item: unknown): boolean =>
  isObject(item) && (item.nickname === "REGULATORY" || item.sourceAction === "View FDA source" || item.kind === "event");

const skipsRegistry = (item: unknown): boolean => isEpisodeItem(item) || isRegulatoryItem(item);

const pickIds = (picks: OwnArticlePick[]): string[] => picks.flatMap((pick) => (pick.kind === "id" ? [pick.id] : []));

type SnapshotLike = { developments?: unknown; relevant?: unknown };
const developmentsOf = (snapshot: SnapshotLike): unknown[] =>
  Array.isArray(snapshot.developments) ? snapshot.developments.map((entry) => (isObject(entry) ? entry.development : null)) : [];
const relevantOf = (snapshot: SnapshotLike): unknown[] =>
  Array.isArray(snapshot.relevant) ? snapshot.relevant.map((entry) => (isObject(entry) ? entry.article : null)) : [];

function decorateSnapshot(snapshot: unknown, name: (item: unknown) => string | null | undefined): unknown {
  if (!isObject(snapshot)) return snapshot;
  const out: Json = { ...snapshot };
  if (Array.isArray(snapshot.developments)) {
    out.developments = snapshot.developments.map((entry) => isObject(entry) && !skipsRegistry(entry.development)
      ? { ...entry, development: decorate(entry.development, name(entry.development), "sourceName") }
      : entry);
  }
  if (Array.isArray(snapshot.relevant)) {
    out.relevant = snapshot.relevant.map((entry) => isObject(entry) && !skipsRegistry(entry.article)
      ? { ...entry, article: decorate(entry.article, name(entry.article), "sourceName") }
      : entry);
  }
  return out;
}

/**
 * The Readout window with `sourceName` on each edition article (current edition,
 * seven-day history) and designation card that rule 1 or 2 decides. Rule-3 items
 * keep no key, so the renderer shows their legacy label. Never mutates the input
 * and never throws: a failed lookup applies the saved fields only.
 */
export async function withPublicationNames<T extends ReadoutWindowPayload>(payload: T): Promise<T> {
  try {
    const snapshots: SnapshotLike[] = [payload.currentEdition, ...(payload.editionHistory ?? [])].filter(isObject);
    const items = [
      ...snapshots.flatMap((snapshot) => [...developmentsOf(snapshot), ...relevantOf(snapshot)]),
      ...(payload.designationCards ?? []),
    ].filter((item) => isObject(item) && !skipsRegistry(item));
    const ids = pickIds(items.map(ownArticlePick));
    const entries = ids.length ? await fetchArticlePublications(ids) : new Map<string, PublicationEntry>();
    const name = (item: unknown) => publicationName({ pick: ownArticlePick(item), entries, saved: item as SavedPublication });
    return {
      ...payload,
      ...(payload.currentEdition !== undefined ? { currentEdition: decorateSnapshot(payload.currentEdition, name) } : {}),
      ...(Array.isArray(payload.editionHistory) ? { editionHistory: payload.editionHistory.map((snapshot) => decorateSnapshot(snapshot, name)) } : {}),
      ...(Array.isArray(payload.designationCards)
        ? { designationCards: payload.designationCards.map((card) => decorate(card, name(card), "sourceName")) }
        : {}),
    };
  } catch (error) {
    console.error("[publications] could not add source names:", error instanceof Error ? error.message : String(error));
    return payload;
  }
}

/** The key conference items carry the registry answer under (the engine already sends a legacy `sourceName`). */
export const REGISTRY_SOURCE_KEY = "registrySource";

const metadataOf = (item: Json): Json | null => (isObject(item.sourceMetadata) ? item.sourceMetadata : null);

/** A conference card/article's own id: sourceMetadata's (or the item's) pick, then its first articleIds entry. */
function conferenceItemPick(item: Json): OwnArticlePick {
  const metadata = metadataOf(item);
  const pick = ownArticlePick(metadata ?? item);
  if (pick.kind !== "none") return pick;
  const first = Array.isArray(item.articleIds) ? articleKey(item.articleIds[0]) : null;
  return first ? { kind: "id", id: first } : pick;
}

const reportPick = (report: Json): OwnArticlePick => {
  const id = articleKey(report.id);
  return id ? { kind: "id", id } : { kind: "none" };
};

/** Saved step-2a fields on the item itself, else on its sourceMetadata. */
function conferenceSaved(item: Json): SavedPublication {
  const own = item as SavedPublication;
  if (publicationStatusOf(own.publication_status) || publicationStatusOf(own.publicationStatus)) return own;
  return (metadataOf(item) ?? {}) as SavedPublication;
}

/**
 * The conference window with `registrySource` on each report, card and article
 * that rule 1 or 2 decides. Episodes are left alone. Never mutates the input and
 * never throws.
 */
export async function withConferencePublicationNames(payload: ConferenceWindowPayload): Promise<ConferenceWindowPayload> {
  try {
    const coverage = payload.coverage;
    const reports = (coverage.reports ?? []) as unknown[];
    const articleItems = [...(coverage.cards ?? []), ...(coverage.articles ?? [])].filter((item): item is Json => isObject(item) && !isEpisodeItem(item));
    const ids = pickIds([
      ...reports.filter(isObject).map(reportPick),
      ...articleItems.map(conferenceItemPick),
    ]);
    const entries = ids.length ? await fetchArticlePublications(ids) : new Map<string, PublicationEntry>();
    const decorateItem = (pickOf: (item: Json) => OwnArticlePick) => (item: unknown) =>
      isObject(item) && !isEpisodeItem(item)
        ? decorate(item, publicationName({ pick: pickOf(item), entries, saved: conferenceSaved(item) }), REGISTRY_SOURCE_KEY)
        : item;
    return {
      ...payload,
      coverage: {
        ...coverage,
        cards: (coverage.cards ?? []).map(decorateItem(conferenceItemPick)),
        articles: (coverage.articles ?? []).map(decorateItem(conferenceItemPick)),
        ...(coverage.reports ? { reports: coverage.reports.map(decorateItem(reportPick)) as typeof coverage.reports } : {}),
      },
    };
  } catch (error) {
    console.error("[publications] could not add conference source names:", error instanceof Error ? error.message : String(error));
    return payload;
  }
}
