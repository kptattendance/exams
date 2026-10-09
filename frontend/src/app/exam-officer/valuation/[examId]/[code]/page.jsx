"use client";

import { useParams } from "next/navigation";

import ValuationPaper from "../../../../components/exams/ValuationPaper";

export default function ExamOfficerValuationPaperPage() {
  const { examId, code } = useParams();
  return <ValuationPaper examId={examId} code={decodeURIComponent(code)} backHref="/exam-officer/valuation" />;
}
