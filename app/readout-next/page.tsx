import EditorialReadout from "../briefing-preview/EditorialReadout";
import "../briefing-preview/preview.css";
import { getCachedReadoutWindow } from "@/lib/readoutWindowServer";

export const metadata = {
  title: "The Readout · CanvasMD",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ReadoutNextPage() {
  const initialPayload = await getCachedReadoutWindow("All", "today");
  return <EditorialReadout initialPayload={initialPayload} />;
}
