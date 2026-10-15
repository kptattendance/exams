"use client";

import { useParams } from "next/navigation";

import ExamDetail from "../../../components/exams/ExamDetail";

export default function ExamOfficerExamPage() {
  const { id } = useParams();
  return <ExamDetail id={id} basePath="/exam-officer/examinations" />;
}
