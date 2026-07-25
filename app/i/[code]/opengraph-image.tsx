import { ImageResponse } from "next/og";

// The link-preview card iMessage / Mail / Slack render when a reader shares the brief. Lives under
// the PUBLIC `/i/` prefix (middleware allowlist) so crawlers can fetch it past the gate. Brand
// navy + periwinkle, set in Newsreader (the masthead serif) — the .ttf is bundled beside this file
// and loaded into Satori, which can't use system fonts.

export const runtime = "edge"; // required: the `fetch(new URL('./x.ttf', import.meta.url))` font-load pattern only resolves to an absolute URL under edge
export const alt = "The Readout — the weekly oncology brief, by CanvasMD";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// The card was byte-identical every week, forever, so a colleague who had seen one shared link had
// no reason to open the next — the weakest link in an invite-led growth loop. Dating it is enough
// to make each week's share distinct. Deliberately derived from the clock rather than the snapshot:
// briefing_snapshots is RLS-locked to the anon key, and an image that has to fetch data is an image
// that can fail to render at exactly the moment someone is sharing it. The link always opens the
// CURRENT brief, so the current week is the honest label.
export const revalidate = 3600;

const weekOf = (now: Date) => {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

export default async function Image() {
  const newsreader = await fetch(new URL("./Newsreader-500.woff", import.meta.url)).then((r) => r.arrayBuffer());
  const week = weekOf(new Date());
  return new ImageResponse(
    (
      <div style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", backgroundColor: "#12305f", padding: "78px 84px", fontFamily: "Newsreader" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 27, fontWeight: 600, letterSpacing: 9, color: "#9fc0ff" }}>THE WEEKLY BRIEF</div>
          <div style={{ fontSize: 146, fontWeight: 600, color: "#f4f7ff", marginTop: 10, letterSpacing: -2 }}>The Readout</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 20 }}>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 8, color: "rgba(255,255,255,0.55)" }}>BY CANVASMD</div>
            <div style={{ width: 5, height: 5, backgroundColor: "rgba(255,255,255,0.35)" }} />
            {/* one interpolated string, not "text {expr}" — Satori treats that as TWO children
                and refuses to lay out a div with multiple children unless it is display:flex */}
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 3, color: "#9fc0ff" }}>{`WEEK OF ${week.toUpperCase()}`}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 120, height: 5, backgroundColor: "#9fc0ff" }} />
          <div style={{ fontSize: 40, fontWeight: 400, color: "#dce4f5", marginTop: 26, lineHeight: 1.35 }}>What moved this week in oncology — the drugs the field is actually discussing.</div>
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Newsreader", data: newsreader, style: "normal", weight: 500 }] },
  );
}
