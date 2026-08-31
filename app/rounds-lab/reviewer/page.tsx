import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReviewerWorkbench from "./ReviewerWorkbench";
import { LOCAL_ROUNDS_BRIEFS } from "../fixture";
import { findRoundsQuestion } from "../librarySearch";
import { buildReviewerQuestionRecords } from "./reviewerFixture";
import { loadLocalTranscriptAssets } from "./transcripts/loadLocalTranscriptAssets.server";
import "../rounds-lab.css";
import "./reviewer.css";

export const metadata: Metadata = {
  title: "Rounds Reviewer · Local CanvasMD Workbench",
  description: "A local-only editorial review workbench for the Rounds prototype.",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
};

export const dynamic = "force-dynamic";

export default async function RoundsReviewerPage({
  searchParams,
}: {
  searchParams?: { question?: string | string[] };
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const requestedQuestion = Array.isArray(searchParams?.question)
    ? searchParams?.question[0]
    : searchParams?.question;
  if (requestedQuestion && !findRoundsQuestion(requestedQuestion, LOCAL_ROUNDS_BRIEFS)) notFound();
  const transcriptLoad = await loadLocalTranscriptAssets();
  const questionRecords = buildReviewerQuestionRecords(transcriptLoad.assets);
  return (
    <ReviewerWorkbench
      initialQuestionId={requestedQuestion}
      questionRecords={questionRecords}
      transcriptLoadIssues={transcriptLoad.issues}
    />
  );
}
