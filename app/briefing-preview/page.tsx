import EditorialReadout from "./EditorialReadout";
import "./preview.css";
import { getCachedReadoutWindow } from "@/lib/readoutWindowServer";
import { getCachedConferenceList } from "@/lib/conferenceServer";

export const metadata = { title: "The Readout · Briefing Preview" };
export const dynamic = "force-dynamic";

export default async function BriefingPreviewPage() {
  const [initialPayload, conferenceMeetings] = await Promise.all([
    getCachedReadoutWindow("All", "today"),
    getCachedConferenceList().catch(() => []),
  ]);
  return <EditorialReadout initialPayload={initialPayload} conferenceMeetings={conferenceMeetings} />;
}
