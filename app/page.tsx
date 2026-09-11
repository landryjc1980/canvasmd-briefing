import type { Metadata } from "next";
import EditorialReadout from "./briefing-preview/EditorialReadout";
import "./briefing-preview/preview.css";
import { getCachedReadoutWindow } from "@/lib/readoutWindowServer";
import { getCachedConferenceList } from "@/lib/conferenceServer";

export const metadata: Metadata = {
  title: "The Readout · CanvasMD",
  description: "The papers, approvals, and episodes oncology clinicians are sharing.",
  alternates: { canonical: "https://briefing.canvasmd.io/" },
  robots: { index: true, follow: true },
};

export const dynamic = "force-dynamic";

export default async function ReadoutPage() {
  // Start the bounded conference read alongside the canonical edition read. A conference
  // timeout never changes the Readout payload; it merely omits the optional teaser.
  const conferenceMeetingsPromise = getCachedConferenceList().catch(() => []);
  const initialPayload = await getCachedReadoutWindow("All", "today");
  const conferenceMeetings = await conferenceMeetingsPromise;
  return <EditorialReadout initialPayload={initialPayload} conferenceMeetings={conferenceMeetings} />;
}
