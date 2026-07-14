import type { Metadata, Viewport } from "next";
import "./globals.css";

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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Newsreader — the serif the story/reader designs use for headlines, drug names, quotes */}
        <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
