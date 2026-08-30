import type { Metadata } from "next";
import EditorialReadout from "./briefing-preview/EditorialReadout";
import "./briefing-preview/preview.css";
import { getCachedReadoutWindow } from "@/lib/readoutWindowServer";

export const metadata: Metadata = {
  title: "The Readout · CanvasMD",
  description: "The papers, approvals, and episodes oncology clinicians are sharing.",
  alternates: { canonical: "https://briefing.canvasmd.io/" },
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function ReadoutPage() {
  const initialPayload = await getCachedReadoutWindow("All", "today");
  return <EditorialReadout initialPayload={initialPayload} />;
}
