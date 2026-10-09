"use client";

import { useParams } from "next/navigation";

import ExamDetail from "../../../components/exams/ExamDetail";

export default function CoeExamPage() {
  const { id } = useParams();
  return <ExamDetail id={id} basePath="/coe/exams" bridgeHref="/coe/bridge-courses" canManage />;
}
