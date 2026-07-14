import type { Metadata } from "next";

// Server layout wrapping the (client) invite page ONLY so it can carry OG metadata — a shared
// brief link (always an /i/<code> URL from brief-share) then renders a rich card, not a bare
// title. Next auto-attaches the sibling opengraph-image.tsx as the image.
export const metadata: Metadata = {
  title: "The Readout — the weekly oncology brief",
  description:
    "What moved this week in oncology — the drugs the field is actually discussing, fused from podcasts, verified-clinician takes, and shared journal papers.",
  openGraph: {
    title: "The Readout · by CanvasMD",
    description: "What moved this week in oncology — the drugs the field is actually discussing.",
    siteName: "The Readout",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
