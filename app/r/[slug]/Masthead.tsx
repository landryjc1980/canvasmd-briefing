// The Readout masthead, copied EXACTLY from the reader's production masthead
// (app/ReaderView.tsx, the `wide && !compact` branch) so a post page carries the same logo as
// briefing.canvasmd.io rather than a lookalike:
//
//   CanvasMD    750 10px/1 system-ui, uppercase, area accent — NO letter-spacing
//   The Readout 500 28px/1 Georgia,'Newsreader',serif, margin 5px 0 0, nowrap
//   edition     700 13px system-ui in the area accent (the reader's areaSwitcher "chip" label)
//   rule        1px LINE hairline under the row
//
// ⚠️ Georgia comes FIRST in that stack and the weight is 500 — flipping the order to
// 'Newsreader',Georgia or dropping to 400 visibly changes the logotype. If the reader's masthead
// changes, change it here too. Presentational only (no hooks), so both the server-rendered public
// page and the client-rendered member card can use it.

const INK = "#17181a", LINE = "#cfd0cb";

export default function Masthead({ accent, areaFull, href, note }: { accent: string; areaFull: string; href: string; note?: string }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .rmast-logo{font:500 28px/1 Georgia,'Newsreader',serif;color:${INK};margin:5px 0 0;white-space:nowrap}
        @media(max-width:600px){.rmast-logo{font-size:22px}}
      ` }} />
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 18, paddingTop: 22 }}>
        <a href={href} style={{ textDecoration: "none", display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ color: accent, font: "750 10px/1 system-ui", textTransform: "uppercase" }}>CanvasMD</span>
          <h1 className="rmast-logo">The Readout</h1>
        </a>
        <a href={href} style={{ textDecoration: "none", font: "700 13px system-ui", color: accent, whiteSpace: "nowrap", paddingBottom: 2 }}>{areaFull}</a>
      </div>
      {note && <div style={{ font: "600 10px system-ui", color: "#6d7074", marginTop: 9 }}>{note}</div>}
      <div aria-hidden style={{ height: 1, margin: "14px 0 12px", background: LINE }} />
    </>
  );
}
