import EditorialReadout from "../briefing-preview/EditorialReadout";
import "../briefing-preview/preview.css";

export const metadata = {
  title: "The Readout · CanvasMD",
  robots: { index: false, follow: false },
};

export default function ReadoutNextPage() {
  return <EditorialReadout />;
}
