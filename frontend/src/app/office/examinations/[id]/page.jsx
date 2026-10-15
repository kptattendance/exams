"use client";

import { useParams } from "next/navigation";

import ExamDetail from "../../../components/exams/ExamDetail";

// Office: sees the exam and may add / remove back papers for hall tickets
export default function OfficeExamPage() {
  const { id } = useParams();
  return <ExamDetail id={id} basePath="/office/examinations" feesHref="/office/fees" canEditSubjects />;
}
