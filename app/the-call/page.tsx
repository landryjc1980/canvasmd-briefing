import type { Metadata } from "next";
import TheCall from "./TheCall";

export const metadata: Metadata = {
  title: "The Call | CanvasMD",
  description: "One source-anchored oncology decision at a time.",
};

export default function TheCallPage() {
  return <TheCall />;
}
