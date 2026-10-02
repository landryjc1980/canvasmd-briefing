// Publication registry, Readout web read side: the pure part (no app imports, so
// node tests load it). A line-for-line mirror of the physician app's
// lib/publication-core.ts (publication registry step 3, John 2026-10-01), with the
// engine's own `article_id` read first in the own-id pick (step 4).
//
// Which source name a card shows:
//   1. The card has its own article id (an x_shared_articles UUID): the live
//      registry lookup for that id. Resolved -> the publication's name;
//      unresolved or conflict -> no source name (no name, no domain).
//   2. No valid id, but the card carries the saved step-2a fields
//      (publication_status / publication_name, or publicationStatus /
//      publicationName on web edition cards): resolved with a name -> that
//      name; any other valid status -> no source name.
//   3. Neither: the legacy label, decided by the caller exactly as before.
// An id whose lookup failed or found no row uses rule 2 when the card has saved
// fields, otherwise no source name. Never the legacy label once a card has a
// valid id or a valid saved status.

export type PublicationStatus = "resolved" | "unresolved" | "conflict";

/** One article's registry answer. A resolved entry always has a name. */
export type PublicationEntry = { status: PublicationStatus; name: string | null };

/** A card's own article id: one id, ids with no single pick, or none. */
export type OwnArticlePick = { kind: "id"; id: string } | { kind: "undecided" } | { kind: "none" };

/** The step-2a fields a card may carry, in raw (snake) or web edition (camel) case. */
export type SavedPublication = {
  publication_status?: unknown;
  publication_name?: unknown;
  publicationStatus?: unknown;
  publicationName?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = new Set<string>(["resolved", "unresolved", "conflict"]);

/** The id, lower-cased (as PostgREST returns it), when it is an x_shared_articles UUID; otherwise null. */
export const articleKey = (value: unknown): string | null =>
  typeof value === "string" && UUID.test(value) ? value.toLowerCase() : null;

const nonEmpty = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/** A valid saved status, or null. */
export const publicationStatusOf = (value: unknown): PublicationStatus | null =>
  typeof value === "string" && STATUSES.has(value) ? value as PublicationStatus : null;

/** Rule 2. undefined: the card has no valid saved status; null: it has one that shows no name. */
export function savedPublicationName(saved: SavedPublication | null | undefined): string | null | undefined {
  if (!saved || typeof saved !== "object") return undefined;
  const snake = publicationStatusOf(saved.publication_status);
  const status = snake ?? publicationStatusOf(saved.publicationStatus);
  if (!status) return undefined;
  if (status !== "resolved") return null;
  return snake ? nonEmpty(saved.publication_name) : nonEmpty(saved.publicationName);
}

const uuids = (values: unknown): string[] =>
  [...new Set((Array.isArray(values) ? values : []).flatMap((value) => {
    const key = articleKey(value);
    return key ? [key] : [];
  }))];

/**
 * The item's own article id: `article_id` / `articleId` when a UUID; else
 * `canonicalArticleId` when a UUID; else the single UUID in `articleIds`.
 * UUID ids with no single pick are "undecided" (no source name); no UUID ids at
 * all is "none" (rule 2, then the legacy label).
 */
export function ownArticlePick(item: unknown): OwnArticlePick {
  if (!item || typeof item !== "object") return { kind: "none" };
  const value = item as { article_id?: unknown; articleId?: unknown; canonicalArticleId?: unknown; articleIds?: unknown };
  const own = articleKey(value.article_id) ?? articleKey(value.articleId);
  if (own) return { kind: "id", id: own };
  const canonical = articleKey(value.canonicalArticleId);
  if (canonical) return { kind: "id", id: canonical };
  const ids = uuids(value.articleIds);
  if (ids.length === 1) return { kind: "id", id: ids[0] };
  return ids.length ? { kind: "undecided" } : { kind: "none" };
}

/** The picked id, or null when the pick is undecided or none. */
export const pickId = (pick: OwnArticlePick): string | null => (pick.kind === "id" ? pick.id : null);

/**
 * The source name for one card. `entries` is the registry lookup (null when it
 * failed). Returns a string (show it), null (show no source) or undefined (rule 3:
 * the caller shows its legacy label).
 */
export function publicationName({ pick, entries, saved }: {
  pick: OwnArticlePick;
  entries: Map<string, PublicationEntry> | null;
  saved?: SavedPublication | null;
}): string | null | undefined {
  if (pick.kind === "undecided") return null;
  const fromSaved = savedPublicationName(saved);
  if (pick.kind === "id") {
    const entry = entries?.get(pick.id);
    if (entry?.status === "resolved") {
      const name = nonEmpty(entry.name);
      if (name) return name;
    } else if (entry) return null;
    return fromSaved ?? null;
  }
  return fromSaved;
}

/** The field a decorated item carries: a registry name, or null for "show no source". */
export const SOURCE_NAME_KEY = "sourceName";

/** The source a decorated item shows: its `sourceName` when the key is present, else the legacy label. */
export function shownSource(
  item: { sourceName?: string | null; [key: string]: unknown },
  legacy: string | null | undefined,
): string | null {
  return SOURCE_NAME_KEY in item ? item.sourceName ?? null : legacy ?? null;
}
