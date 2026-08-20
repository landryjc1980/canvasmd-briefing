// Data + resolver for a single Readout post — the /r/<slug> "article" page.
// Server-only (service-role over PostgREST, same dependency-light pattern as lib/db.ts).
//
// SAFETY: the PUBLIC face of a post comes ONLY from daily_readout_items, whose columns are
// public-safe by construction (title, generator-written teaser, source label, areas). The
// gated full text (line/sub — which can carry names/verbatim source) lives in the
// daily_readout payload and is fetched separately, and merged in ONLY for a signed-in reader.

import { postSlug } from "@/lib/postId";

const URL_ = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The public, shareable face of a post — safe to render to anyone, incl. crawlers.
export type PublicPost = {
  id: string;
  slug: string;
  section: string;
  kind: string;
  title: string;
  teaser: string | null;
  areas: string[];
  sourceUrl: string | null;
  sourceLabel: string | null;
  nct: string | null;
  date: string;
};

// GATED extras — merged in only for a signed-in reader.
export type PostDetail = { line: string | null; sub: string | null };

async function get<T>(path: string): Promise<T | null> {
  if (!URL_ || !SERVICE_KEY) return null;
  try {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // table may not exist yet (pre-migration) — resolve to not-found, never throw
  }
}

// Resolve the public post by its stable id — one indexed PK lookup.
export async function getPublicPost(id: string): Promise<PublicPost | null> {
  const rows = await get<any[]>(
    `daily_readout_items?select=id,slug,section,kind,title,teaser,areas,source_url,source_label,nct,date&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  const r = rows?.[0];
  if (!r) return null;
  return {
    id: String(r.id), slug: String(r.slug), section: String(r.section), kind: String(r.kind),
    title: String(r.title), teaser: r.teaser ?? null, areas: (r.areas ?? []) as string[],
    sourceUrl: r.source_url ?? null, sourceLabel: r.source_label ?? null,
    nct: r.nct ?? null, date: String(r.date),
  };
}

// Gated full text — find the exact item in that date's payload by its stamped id.
export async function getPostDetail(date: string, id: string): Promise<PostDetail | null> {
  const rows = await get<{ payload: { sections?: { items?: any[] }[] } }[]>(
    `daily_readout?select=payload&date=eq.${encodeURIComponent(date)}&limit=1`,
  );
  const sections = rows?.[0]?.payload?.sections ?? [];
  for (const s of sections) {
    for (const it of s.items ?? []) {
      if (it.id === id) return { line: it.line ?? null, sub: it.sub ?? null };
    }
  }
  return null;
}

// The canonical, tokenless slug for a post (retitle-safe; id is the trailing segment).
export const canonicalSlug = (p: PublicPost) => postSlug(p.title, p.id);
