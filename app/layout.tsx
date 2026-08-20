import type { Metadata, Viewport } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import "./globals.css";

// Newsreader, SELF-HOSTED. This used to be a render-blocking <link> to fonts.googleapis.com.
// A health-system proxy that blackholes (rather than refuses) that request stalls first paint
// until the browser times out — a blank Readout, on exactly the networks our readers are on.
// The @font-face rules are Google's own, rewritten to /fonts/*.woff2 and inlined here so the
// page costs zero third-party requests and zero blocking stylesheets. Read once at module load.
// The family is still literally "Newsreader", so every existing inline `font:` string keeps working.
// On a force-dynamic route (e.g. /r/[slug]) this module can evaluate INSIDE a serverless
// function, where `public/` may not be traced onto disk — so never let a missing file crash
// the render. next.config traces the font for /r/[slug]; if it's ever still absent, fall back
// to no inlined @font-face (every `font:` stack already names Georgia next). Never a 500.
let FONT_CSS = "";
try {
  FONT_CSS = readFileSync(join(process.cwd(), "public/fonts/newsreader.css"), "utf8");
} catch {
  /* Georgia fallback */
}

export const metadata: Metadata = {
  title: "The Readout · CanvasMD",
  description:
    "What moved this week in oncology — the drugs the field is discussing, fused from podcasts, verified-clinician X takes, and shared journal papers.",
};

// Mobile-first: most people will open the shared link on their phone.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Deliberately minimal: no cross-page nav. This is a single, public, ungated
// surface — the Weekly Briefing only. It renders the SAME snapshot the native
// app shows (computed by the `briefing` edge function); see app/api/briefing.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Newsreader — the serif the story/reader designs use for headlines, drug names, quotes */}
        <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
