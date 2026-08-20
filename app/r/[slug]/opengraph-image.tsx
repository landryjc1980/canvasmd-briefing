// Per-post OG/social card. Next 14 wires this to og:image + twitter:image automatically for the
// sibling page. Resolves the SAME weekly hero card and renders its headline (public-safe) in the
// ink house style, so a shared /r/ link unfurls a branded card on X / LinkedIn / Slack / iMessage.

import { ImageResponse } from "next/og";
import { resolveHeroPost, publicTitleOf } from "@/app/heroPost";
import { idFromSlug } from "@/lib/postId";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "The Readout — CanvasMD";

const AREA_ACCENTS: Record<string, string> = {
  GU: "#38bdf8", Breast: "#f472b6", Lung: "#94a3b8", GI: "#f59e0b", Heme: "#f87171", Gyn: "#2dd4bf", Skin: "#a78bfa",
};
const AREA_LABELS: Record<string, string> = {
  GU: "Genitourinary", Breast: "Breast", Lung: "Lung", GI: "Gastrointestinal", Heme: "Hematology", Gyn: "Gynecologic", Skin: "Skin cancer",
};
const KICKERS: Record<string, string> = {
  paper: "PAPER", episode: "ON THE MICS", event: "REGULATORY", thread: "CLINICIAN POST", readout: "TRIAL READOUT", development: "BREAKING DEVELOPMENT", trial_milestone: "TRIAL MILESTONE",
};
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

export default async function Image({ params }: { params: { slug: string } }) {
  const post = await resolveHeroPost(idFromSlug(params.slug));
  const area = post?.area ?? "";
  const accent = AREA_ACCENTS[area] ?? "#94a3b8";
  const kicker = post ? (KICKERS[post.card.kind] ?? post.card.kind.toUpperCase()) : "THE READOUT";
  // ⚠️ A thread card's headline is a clinician's VERBATIM post — never unfurl it (publicTitleOf
  // swaps in a neutral edition line; same policy as the page + metadata).
  const title = post
    ? publicTitleOf(post.card.kind, post.card.headline, area)
    : "The Readout — daily oncology intelligence";

  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", background: "#0D1017", color: "#fff", padding: "64px 72px", justifyContent: "space-between", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ width: 46, height: 8, background: accent, borderRadius: 4, display: "flex" }} />
            <div style={{ fontSize: 25, letterSpacing: 6, color: accent, marginLeft: 18, display: "flex" }}>{kicker}</div>
          </div>
          <div style={{ fontSize: 60, lineHeight: 1.12, marginTop: 36, fontWeight: 600, letterSpacing: -1, display: "flex", maxWidth: 1010 }}>{clip(title, 135)}</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 16, letterSpacing: 6, color: "#8b9096", display: "flex" }}>CANVASMD</div>
            <div style={{ fontSize: 36, marginTop: 4, display: "flex" }}>The Readout</div>
          </div>
          <div style={{ fontSize: 20, color: "#8b9096", display: "flex" }}>{AREA_LABELS[area] ?? "Oncology"}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
