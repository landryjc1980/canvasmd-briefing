// The LOGGED-OUT post page — the site's own reader chrome, not a microsite.
//
// It renders inside the reader's `.reader-editorial` paper context and reuses the hero-card
// classes from brief.css, so the masthead, type scale, and card language are byte-identical to
// briefing.canvasmd.io. Below the story it shows a GLIMPSE of what the gate holds: the sourced
// count line, an anonymous facepile, a redacted conversation block, and an inventory of what's
// inside — then what else is in the current 14-day edition.
//
// SAFETY BOUNDARY: this component receives ONLY the whitelisted primitives assembled in page.tsx
// (headline, source label, templated teaser, non-verbatim excerpt, count strings, other
// headlines). No clinician names, no post text, and no avatars ever reach it — the redacted block
// is drawn from counts alone, never from hidden real text.

import Masthead from "./Masthead";

const INK = "#17181a", INK_2 = "#4f5257", MUT = "#696c71", MUT2 = "#6d7074";
const LINE = "#cfd0cb", SURFACE = "#ebeae5", PAPER = "#f4f4f1";

export type PublicViewData = {
  headline: string;
  kicker: string;
  sourceLabel: string | null;
  sourceUrl: string | null;
  teaser: string;
  excerpt: string | null;
  why: string | null;
  area: string;
  areaFull: string;
  accent: string;
  inside: string[];
  insideNote: string; // kind-aware tail ("what each of them said" vs "the exact moments, with audio")
  faceCount: number;
  also: { headline: string; kicker: string; sourceLabel: string | null; href: string }[];
};

export default function PublicCard({ v, signInHref }: { v: PublicViewData; signInHref: string }) {
  const accent = v.accent;
  return (
    <div className="reader-editorial" style={{ minHeight: "100vh", overflowWrap: "break-word", background: PAPER, color: INK, fontFamily: "system-ui,-apple-system,'Segoe UI',sans-serif", ["--rv-accent" as string]: accent, ["--rv-ink" as string]: INK, ["--rv-ink-2" as string]: INK_2, ["--rv-copy" as string]: INK_2, ["--rv-muted" as string]: MUT, ["--rv-muted-2" as string]: MUT2, ["--rv-line" as string]: LINE, ["--rv-surface" as string]: SURFACE, ["--rv-card" as string]: "#fff", ["--rv-card-line" as string]: "#d8d7d1" }}>
      {/* Raw-injected (this page is server-rendered; a JSX <style> text node would escape the `>`
          combinators on the server only — see PostCard.tsx). */}
      <style dangerouslySetInnerHTML={{ __html: `
        .rpub-frame{max-width:690px;margin:0 auto;padding:0 32px 110px}
        @media(max-width:600px){.rpub-frame{padding:18px 20px 90px}}
        .rpub-cta{display:inline-flex;align-items:center;gap:7px;border:1px solid ${accent};color:${accent};background:transparent;border-radius:6px;padding:9px 16px;font:600 13px system-ui;text-decoration:none;transition:background .15s ease}
        @media(hover:hover){.rpub-cta:hover{background:${accent}0f}}
        .rpub-link{color:${accent};font:600 13px system-ui;text-decoration:none}
        @media(hover:hover){.rpub-link:hover{text-decoration:underline;text-underline-offset:4px}}
        .rpub-also a{text-decoration:none;display:block;padding:13px 0;border-top:1px solid ${LINE}}
        @media(hover:hover){.rpub-also a:hover .rpub-also-h{text-decoration:underline;text-underline-offset:3px}}
        .rpub-bar{height:9px;border-radius:3px;background:${SURFACE}}
      ` }} />
      <div className="rpub-frame">
        <Masthead accent={accent} areaFull={v.areaFull} href={`/?area=${encodeURIComponent(v.area)}`} note="What oncology is reading, discussing, and citing recently" />

        {/* THE STORY — the site's own hero-card language (classes from brief.css) */}
        <article className="readout-hero-card is-lead">
          <div className="hero-row"><div>
            <div className="readout-hero-kicker" style={{ font: "700 11px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: accent }}>{v.kicker}</div>
            {v.sourceLabel && <div className="readout-hero-source" style={{ color: INK_2 }}>{v.sourceLabel}</div>}
            <h1 className="readout-hero-title" style={{ font: "600 27px/1.2 ui-serif,'New York','Iowan Old Style',Georgia,serif", margin: "0 0 12px" }}>{v.headline}</h1>
            {/* The paper's own published text when we have it. No excerpt → say nothing rather than
                pad with marketing copy; the count line and the conversation block carry the page. */}
            {v.excerpt && <p className="hero-excerpt" style={{ color: INK_2 }}>{v.excerpt}</p>}

            {/* GLIMPSE — sourced count line + anonymous facepile (no identities leave the server) */}
            {v.why && (
              <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 16, flexWrap: "wrap" }}>
                {v.faceCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center" }} aria-hidden>
                    {Array.from({ length: v.faceCount }).map((_, i) => (
                      <div key={i} style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${PAPER}`, background: `${accent}2e`, marginLeft: i ? -7 : 0 }} />
                    ))}
                  </div>
                )}
                <span style={{ font: "500 12.5px system-ui", color: MUT }}>{v.why}</span>
              </div>
            )}
          </div></div>
        </article>

        {/* WHAT'S BEHIND THE GATE — redacted conversation drawn from counts alone */}
        <div style={{ marginTop: 4, border: `1px solid ${LINE}`, borderRadius: 8, background: "#fff", padding: "16px 17px 17px" }}>
          {/* Lock + "members" make the bars read as REDACTED, not as a page still loading. */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, font: "700 9.5px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: MUT2 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flex: "none" }}>
              <rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 1 1 8 0v3" />
            </svg>
            The conversation
          </div>
          <div aria-hidden style={{ display: "flex", flexDirection: "column", gap: 7, margin: "12px 0 14px" }}>
            <div className="rpub-bar" style={{ width: "94%" }} />
            <div className="rpub-bar" style={{ width: "86%" }} />
            <div className="rpub-bar" style={{ width: "58%" }} />
          </div>
          {v.inside.length > 0 && (
            <div style={{ font: "400 12.5px/1.55 system-ui", color: INK_2 }}>
              Inside: {v.inside.join(" · ")} — {v.insideNote}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 15 }}>
            <a href={signInHref} className="rpub-cta">Open in The Readout →</a>
            {v.sourceUrl && (
              <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="rpub-link">
                Read {v.sourceLabel ? `at ${v.sourceLabel}` : "the source"} ↗
              </a>
            )}
          </div>
        </div>

        {/* WHAT ELSE IS IN THE EDITION — the rest of the week, as real headlines */}
        {v.also.length > 0 && (
          <div className="rpub-also" style={{ marginTop: 34 }}>
            <div style={{ font: "700 9.5px system-ui", letterSpacing: ".14em", textTransform: "uppercase", color: MUT2, marginBottom: 4 }}>
              Also in this {v.areaFull} 14-day edition
            </div>
            {v.also.map((a, i) => (
              <a key={i} href={a.href}>
                <div style={{ font: "700 9.5px system-ui", letterSpacing: ".1em", textTransform: "uppercase", color: accent }}>
                  {a.kicker}{a.sourceLabel ? <span style={{ color: MUT2, letterSpacing: 0, textTransform: "none", font: "500 11px system-ui" }}> · {a.sourceLabel}</span> : null}
                </div>
                <div className="rpub-also-h" style={{ font: "500 16px/1.35 'Newsreader',Georgia,serif", color: INK, marginTop: 4 }}>{a.headline}</div>
              </a>
            ))}
            <div style={{ borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
              <a href={signInHref} className="rpub-link">See the full {v.areaFull} edition →</a>
            </div>
          </div>
        )}

        <div aria-hidden style={{ height: 1, background: LINE, margin: "30px 0 13px" }} />
        <p style={{ font: "400 11px/1.6 system-ui", color: MUT2, margin: 0, textAlign: "center" }}>
          Signal from tracked oncology clinicians and selected podcasts. No anonymous accounts.
        </p>
      </div>
    </div>
  );
}
