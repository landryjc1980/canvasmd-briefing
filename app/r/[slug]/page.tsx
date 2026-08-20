// The Readout post page — /r/<kebab-headline>-<tok>. One shareable "article" per WEEKLY hero card.
//
// The shareable unit is the reader's source-anchored hero card (that's where the social evidence
// lives). Three states, resolved from the current briefing_snapshots (app/heroPost.ts):
//   • crawler / logged-out human → public teaser + email capture (safe fields only)
//   • signed-in member          → the FULL expanded card, evidence and all (components/PostCard)
// The public shell renders only public-safe fields (headline, source, area, a templated line); the
// gated evidence (clinician posts, abstracts, stance) appears only for a valid session — the same
// gate the home page sits behind, so a shared link can't leak it.

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cookies } from "next/headers";
import { idFromSlug, heroSlug } from "@/lib/postId";
import { resolveHeroPost, type HeroPost } from "@/app/heroPost";
import { readSession, SESSION_COOKIE } from "@/lib/gate";
import PostCard from "./PostCard";

export const dynamic = "force-dynamic";

// ---- house palette (paper/ink; matches the reader + Daily email) ----------------------------
const INK = "#17181a", INK2 = "#4f5257", MUT = "#696c71", MUT2 = "#85878c";
const LINE = "#cfd0cb", PAPER = "#f4f4f1", ACCENT = "#475569";
const SERIF = "Newsreader,Georgia,serif";
const SANS = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9",
};
const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic", Skin: "Skin cancer",
};
const KICKERS: Record<string, string> = {
  paper: "Paper", episode: "On the mics", event: "Regulatory", thread: "Clinician post", readout: "Trial readout", trial_milestone: "Trial milestone",
};

function siteBase(): string {
  return (process.env.BRIEF_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://briefing.canvasmd.io").replace(/\/$/, "");
}
const accentOf = (area: string) => AREA_ACCENTS[area] ?? ACCENT;
// A public-safe one-liner: never the card excerpt (which can be a verbatim tweet) — just where the
// conversation is and that it's inside the Readout.
const publicTeaser = (p: HeroPost) => `How tracked ${(AREA_LABELS[p.area] ?? "oncology").toLowerCase()} oncology clinicians are engaging — inside The Readout.`;

// ---- metadata (public; identical for everyone so crawlers + caches are happy) --------------
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await resolveHeroPost(idFromSlug(params.slug));
  if (!post) return { title: "The Readout — CanvasMD" };
  const url = `${siteBase()}/r/${heroSlug(post.card.headline, post.card.id)}`;
  const desc = publicTeaser(post);
  return {
    title: `${post.card.headline} — The Readout`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: post.card.headline, description: desc, url, siteName: "The Readout · CanvasMD", type: "article" },
    twitter: { card: "summary_large_image", title: post.card.headline, description: desc },
  };
}

// --------------------------------------------------------------------------------------------
export default async function PostPage({ params }: { params: { slug: string } }) {
  const tok = idFromSlug(params.slug);
  const post = await resolveHeroPost(tok);
  if (!post) notFound(); // token unknown, or the card has rotated out of the current window

  // Retitle-safe: any non-canonical path 301s to the canonical slug (the token is the truth).
  const canonical = heroSlug(post.card.headline, post.card.id);
  if (params.slug !== canonical) permanentRedirect(`/r/${canonical}`);

  // Session decides depth. This page is NOT gated by middleware, so it reads the cookie itself.
  const contactId = await readSession(cookies().get(SESSION_COOKIE)?.value);
  const { card, brief, area } = post;
  const accent = accentOf(area);
  const memberHome = `/?area=${area}`;

  // MEMBER → the full expanded card (the fix: the page BE the reader's card, evidence and all).
  // Pass only the four arrays resolveHeroEvidence reads (not the whole ~0.5MB brief) so the page
  // that gets serialized to the client stays lean on a shared-link cold open.
  if (contactId) {
    const briefForCard = { topStories: brief.topStories, topArticles: brief.topArticles, movers: brief.movers, heroCandidates: brief.heroCandidates };
    return <PostCard card={card} brief={briefForCard} area={area} memberHome={memberHome} />;
  }

  // PUBLIC → safe teaser + source + capture (drives the magic-link funnel; leaks no gated evidence).
  const kicker = KICKERS[card.kind] ?? card.kind.toUpperCase();
  return (
    <main style={{ background: PAPER, minHeight: "100vh", fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "34px 22px 60px" }}>
        {/* masthead */}
        <a href={`/welcome?area=${area}`} style={{ textDecoration: "none", display: "inline-block" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: accent }}>CanvasMD</div>
          <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 27, color: INK, letterSpacing: "-.01em", marginTop: 2 }}>The Readout</div>
        </a>
        <div style={{ height: 1, background: LINE, margin: "18px 0 22px" }} />

        {/* kicker + area */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: accent, background: `${accent}14`, border: `1px solid ${accent}40`, borderRadius: 5, padding: "3px 8px" }}>{kicker}</span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: accent }}>{area}</span>
        </div>

        {/* headline (public-safe: the story's own title) */}
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 30, lineHeight: 1.22, color: INK, margin: "0 0 14px", letterSpacing: "-.01em" }}>{card.headline}</h1>

        {/* public teaser (templated, safe by construction) */}
        <p style={{ fontSize: 16.5, lineHeight: 1.55, color: INK2, margin: "0 0 20px", fontFamily: SERIF }}>{publicTeaser(post)}</p>

        {/* source CTA — this is a mirror, not a wall */}
        {card.url && (
          <a href={card.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: INK, color: "#fff", fontWeight: 700, fontSize: 13.5, textDecoration: "none", padding: "11px 22px", borderRadius: 8 }}>
            Read {card.sourceLabel ? `at ${card.sourceLabel}` : "the source"} ↗
          </a>
        )}

        {/* capture — see who's discussing it + the full evidence, in the Readout */}
        <div style={{ marginTop: 24, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
          <div style={{ fontFamily: SERIF, fontSize: 17, color: INK, marginBottom: 8 }}>See who&rsquo;s discussing this — and what they said.</div>
          <a href={`/welcome?area=${area}`} style={{ display: "inline-block", background: accent, color: "#fff", fontWeight: 700, fontSize: 13.5, textDecoration: "none", padding: "11px 22px", borderRadius: 8 }}>Open in The Readout →</a>
          <div style={{ marginTop: 10 }}>
            <a href="/" style={{ fontSize: 12.5, color: MUT, textDecoration: "none" }}>Signal from tracked oncology clinicians and selected podcasts. Explore the Readout →</a>
          </div>
        </div>

        <div style={{ height: 1, background: LINE, margin: "28px 0 14px" }} />
        <p style={{ fontSize: 11, color: MUT2, margin: 0, textAlign: "center" }}>{AREA_LABELS[area] ?? "Oncology"} · The Readout · CanvasMD</p>
      </div>
    </main>
  );
}
