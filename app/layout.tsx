import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanvasMD — Weekly Briefing",
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
      <body>{children}</body>
    </html>
  );
}
