import type { Metadata } from "next";
import SignalRoom from "./SignalRoom";

export const metadata: Metadata = {
  title: "Signal Room | CanvasMD",
  description: "Cross-specialty oncology field signals with source-level evidence.",
};

export default function AwesomePage() {
  return <SignalRoom />;
}
