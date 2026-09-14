// Per-post OG/social card. Next 14 wires this to og:image + twitter:image automatically for the
// sibling page. Resolves the SAME weekly hero card and renders its headline (public-safe) in the
// ink house style, so a shared /r/ link unfurls a branded card on X / LinkedIn / Slack / iMessage.

import { ImageResponse } from "next/og";
import { resolveHeroPost, publicTitleOf } from "@/app/heroPost";
import { idFromSlug } from "@/lib/postId";

export const runtime = "edge";
// A SQUARE mark, not a wide banner. Messages, X and Slack render a wide image as a hero with
// the page title printed under it, so the headline appeared twice. A square image renders as a
// thumbnail beside the title: one headline, ours in text (John, 2026-09-14).
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "CanvasMD";

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
  // The headline IS the card. Messages prints the page title under the image as well, and
  // that is fine: the image is what carries on X, LinkedIn and Slack (John, 2026-09-14).
  // ⚠️ A thread card's headline is a clinician's VERBATIM post — never unfurl it (publicTitleOf
  // swaps in a neutral edition line; same policy as the page + metadata).
  const title = post
    ? publicTitleOf(post.card.kind, post.card.headline, area)
    : "CanvasMD — daily oncology intelligence";

  void title;
  // The image slot is the CanvasMD mark, not the headline: Messages, X and Slack print the page
  // title as text under the image, so a headline in the image showed twice (John, 2026-09-14).
  void title;
  const markBytes = await fetch(new URL("./canvasmd-mark.png", import.meta.url)).then((r) => r.arrayBuffer());
  const mark = `data:image/png;base64,${btoa(String.fromCharCode(...new Uint8Array(markBytes)))}`;
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", alignItems: "center", background: "#0D1017", color: "#fff", padding: "0 96px", fontFamily: "system-ui, sans-serif" }}>
        <img src={mark} width={260} height={260} style={{ borderRadius: 56, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 72 }}>
          <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3, display: "flex" }}>CanvasMD</div>
          <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
            <div style={{ width: 40, height: 8, background: accent, borderRadius: 4, display: "flex" }} />
            <div style={{ fontSize: 26, letterSpacing: 6, color: accent, marginLeft: 16, display: "flex" }}>{kicker}</div>
            <div style={{ fontSize: 26, color: "#8b9096", marginLeft: 28, display: "flex" }}>{AREA_LABELS[area] ?? "Oncology"}</div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
