import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoundsLab from "./RoundsLab";
import { LOCAL_ROUNDS_BRIEFS } from "./fixture";
import { findRoundsQuestion } from "./librarySearch";
import "./rounds-lab.css";

export const metadata: Metadata = {
  title: "Rounds Lab · CanvasMD",
  description: "A draft library of consequential GU oncology questions and the evidence behind them.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export const dynamic = "force-dynamic";

export default function RoundsLabPage({
  searchParams,
}: {
  searchParams?: { question?: string | string[]; scenario?: string | string[] };
}) {
  const question = typeof searchParams?.question === "string" ? searchParams.question : undefined;
  if (question && !findRoundsQuestion(question, LOCAL_ROUNDS_BRIEFS)) notFound();
  const scenario = searchParams?.scenario === "quiet" ? "quiet" : "movement";
  return (
    <RoundsLab
      initialQuestionId={question}
      initialScenario={scenario}
      hostedDraft={process.env.NODE_ENV === "production"}
    />
  );
}
