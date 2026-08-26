import EditorialReadout from "./EditorialReadout";
import "./preview.css";
import { getCachedReadoutWindow } from "@/lib/readoutWindowServer";

export const metadata = { title: "The Readout · Briefing Preview" };
export const dynamic = "force-dynamic";

export default async function BriefingPreviewPage() {
  const initialPayload = await getCachedReadoutWindow("All", "today");
  return <EditorialReadout initialPayload={initialPayload} />;
}
