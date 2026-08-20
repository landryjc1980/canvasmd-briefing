// The Readout post page — /r/<kebab-title>-<id>. One shareable "article" per item.
//
// PUBLIC by design (allowlisted in middleware) so crawlers + logged-out clicks reach it. Three
// states: crawler → rich metadata; logged-out human → public teaser + email capture; signed-in
// member → full item + "Open in the Readout". The public shell renders WHITELISTED fields only
// (title/teaser/sourceLabel/areas/kind); gated line/sub appear only with a valid session.

import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cookies } from "next/headers";
import { getPublicPost, getPostDetail, canonicalSlug, type PublicPost } from "@/lib/post";
import { idFromSlug } from "@/lib/postId";
import { readSession, SESSION_COOKIE } from "@/lib/gate";

export const dynamic = "force-dynamic";

// ---- house palette (matches the Daily email + reader) --------------------------------------
const INK = "#17181a", INK2 = "#4f5257", MUT = "#696c71", MUT2 = "#85878c";
const LINE = "#cfd0cb", ACCENT = "#475569";
const SERIF = "Newsreader,Georgia,serif";
const SANS = "-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
const AREA_ACCENTS: Record<string, string> = {
  GU: "#0369a1", Breast: "#be185d", Lung: "#334155", GI: "#a45c0a", Heme: "#9b0f18", Gyn: "#0d6b5f", Skin: "#6d28d9",
};
const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic", Skin: "Skin cancer",
};
const KICKERS: Record<string, string> = { readout: "TRIAL READOUT", paper: "PAPER", event: "FDA", episode: "ON THE MICS", frontier: "FRONTIER" };

function siteBase(): string {
  return (process.env.BRIEF_PUBLIC_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://briefing.canvasmd.io").replace(/\/$/, "");
}
const accentOf = (p: PublicPost) => AREA_ACCENTS[p.areas?.[0] ?? ""] ?? ACCENT;

// ---- metadata (public; identical for everyone so crawlers + caches are happy) --------------
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPublicPost(idFromSlug(params.slug));
  if (!post) return { title: "The Readout — CanvasMD" };
  const url = `${siteBase()}/r/${canonicalSlug(post)}`;
  const desc = post.teaser ?? `${AREA_LABELS[post.areas?.[0] ?? ""] ?? "Oncology"} · The Readout`;
  return {
    title: `${post.title} — The Readout`,
    description: desc,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: desc, url, siteName: "The Readout · CanvasMD", type: "article" },
    twitter: { card: "summary_large_image", title: post.title, description: desc },
  };
}

// --------------------------------------------------------------------------------------------
export default async function PostPage({ params }: { params: { slug: string } }) {
  const id = idFromSlug(params.slug);
  const post = await getPublicPost(id);
  if (!post) notFound();

  // Retitle-safe: any non-canonical path 301s to the canonical slug (id is the source of truth).
  const canonical = canonicalSlug(post);
  if (params.slug !== canonical) permanentRedirect(`/r/${canonical}`);

  // Session decides depth. This page is NOT gated by middleware, so it reads the cookie itself.
  const contactId = await readSession(cookies().get(SESSION_COOKIE)?.value);
  const detail = contactId ? await getPostDetail(post.date, id) : null;

  const accent = accentOf(post);
  const kicker = KICKERS[post.kind] ?? post.kind.toUpperCase();
  const primaryArea = post.areas?.[0] ?? null;

  return (
    <main style={{ background: "#fff", minHeight: "100vh", fontFamily: SANS, color: INK }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "34px 22px 60px" }}>
        {/* masthead */}
        <a href={contactId ? `/${primaryArea ? `?area=${primaryArea}` : ""}` : "/"} style={{ textDecoration: "none", display: "inline-block" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: accent }}>CanvasMD</div>
          <div style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 27, color: INK, letterSpacing: "-.01em", marginTop: 2 }}>The Readout</div>
        </a>
        <div style={{ height: 1, background: LINE, margin: "18px 0 22px" }} />

        {/* kicker + area chips */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: accent, background: `${accent}14`, border: `1px solid ${accent}40`, borderRadius: 5, padding: "3px 8px" }}>{kicker}</span>
          {(post.areas ?? []).map((a) => {
            const c = AREA_ACCENTS[a] ?? ACCENT;
            return <a key={a} href={contactId ? `/?area=${a}` : `/welcome?area=${a}`} style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: c, textDecoration: "none" }}>{a}</a>;
          })}
        </div>

        {/* headline */}
        <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 30, lineHeight: 1.22, color: INK, margin: "0 0 14px", letterSpacing: "-.01em" }}>{post.title}</h1>

        {/* public teaser (whitelisted) */}
        {post.teaser && <p style={{ fontSize: 17, lineHeight: 1.55, color: INK2, margin: "0 0 18px", fontFamily: SERIF }}>{post.teaser}</p>}

        {/* GATED: full context only for a signed-in reader */}
        {detail?.line && <p style={{ fontSize: 15.5, lineHeight: 1.65, color: INK2, margin: "0 0 16px", fontFamily: SERIF }}>{detail.line}</p>}
        {detail?.sub && <div style={{ fontSize: 12.5, color: MUT2, margin: "0 0 16px", fontFamily: SANS }}>{detail.sub}</div>}

        {/* source CTA — always available; this is a mirror, not a wall */}
        {post.sourceUrl && (
          <a href={post.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: INK, color: "#fff", fontWeight: 700, fontSize: 13.5, textDecoration: "none", padding: "11px 22px", borderRadius: 8 }}>
            Read {post.sourceLabel ? `at ${post.sourceLabel}` : "the source"} ↗
          </a>
        )}

        {/* second action: capture (anon) or open-in-Readout (member) */}
        <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
          {contactId ? (
            <a href={`/${primaryArea ? `?area=${primaryArea}` : ""}`} style={{ fontSize: 13.5, fontWeight: 600, color: accent, textDecoration: "none" }}>Open {primaryArea ? `${AREA_LABELS[primaryArea] ?? primaryArea} ` : ""}in The Readout ↗</a>
          ) : (
            <>
              <div style={{ fontFamily: SERIF, fontSize: 17, color: INK, marginBottom: 8 }}>The Daily: what moved in oncology, only on the days it did.</div>
              <a href={`/welcome${primaryArea ? `?area=${primaryArea}` : ""}`} style={{ display: "inline-block", background: accent, color: "#fff", fontWeight: 700, fontSize: 13.5, textDecoration: "none", padding: "11px 22px", borderRadius: 8 }}>Get The Daily →</a>
              <div style={{ marginTop: 10 }}>
                <a href="/" style={{ fontSize: 12.5, color: MUT, textDecoration: "none" }}>Signal from tracked oncology clinicians and selected podcasts. Explore the Readout →</a>
              </div>
            </>
          )}
        </div>

        <div style={{ height: 1, background: LINE, margin: "28px 0 14px" }} />
        <p style={{ fontSize: 11, color: MUT, margin: 0, textAlign: "center" }}>{AREA_LABELS[primaryArea ?? ""] ?? "Oncology"} · The Readout · CanvasMD</p>
      </div>
    </main>
  );
}
