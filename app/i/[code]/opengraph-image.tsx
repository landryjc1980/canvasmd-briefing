import { ImageResponse } from "next/og";

// The link-preview card iMessage / Mail / Slack render when a reader shares the brief. Lives under
// the PUBLIC `/i/` prefix (middleware allowlist) so crawlers can actually fetch it past the gate.
// Brand navy + periwinkle to match the masthead. (Wordmark is the default sans here; matching the
// Newsreader serif would mean bundling a .ttf for Satori — a nice-to-have follow-up.)

export const runtime = "edge";
export const alt = "The Readout — the weekly oncology brief, by CanvasMD";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "#12305f", padding: "78px 84px" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 8, color: "#9fc0ff" }}>THE WEEKLY BRIEF</div>
          <div style={{ fontSize: 134, fontWeight: 700, color: "#f4f7ff", marginTop: 14, letterSpacing: -2 }}>The Readout</div>
          <div style={{ fontSize: 25, fontWeight: 600, letterSpacing: 7, color: "rgba(255,255,255,0.55)", marginTop: 16 }}>BY CANVASMD</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 120, height: 5, backgroundColor: "#9fc0ff" }} />
          <div style={{ fontSize: 38, color: "#dce4f5", marginTop: 26, lineHeight: 1.35 }}>What moved this week in oncology — the drugs the field is actually discussing.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
