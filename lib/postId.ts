// Stable, URL-safe identity for a Readout post (per-item "article" page).
//
// The id is derived from an item's NATURAL ANCHOR (nct_id / episode id / article url), so it
// is identical across rebuilds — a shared or emailed link never rots. The slug is
// human/SEO-readable, but page resolution depends ONLY on the trailing id segment, so
// retitling an item never breaks an existing link.
//
// ⚠️ MIRROR: the `daily-readout` edge function (canvasmd repo) stamps items with ids using the
// SAME algorithm. If you change fnv1a/postId here, change it there too, byte-for-byte, or the
// email's links won't resolve to the pages.

// 32-bit FNV-1a — deterministic, dependency-free, stable across Node and Deno.
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const b36 = (n: number) => n.toString(36);

// The opaque, stable id. `kind` scopes the anchor so two sections that happen to share an
// anchor string never collide. ~6-7 chars.
export function postId(kind: string, anchor: string): string {
  return b36(fnv1a(`${kind}:${anchor}`)).padStart(6, "0");
}

export function kebab(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// `<kebab-title>-<id>`; the id is ALWAYS the final hyphen segment.
export function postSlug(title: string, id: string): string {
  const base = kebab(title);
  return base ? `${base}-${id}` : id;
}

// Recover the id from a slug (accepts the catch-all route's string[] too).
export function idFromSlug(slug: string | string[]): string {
  const s = Array.isArray(slug) ? slug[slug.length - 1] ?? "" : slug;
  const i = s.lastIndexOf("-");
  return i >= 0 ? s.slice(i + 1) : s;
}
