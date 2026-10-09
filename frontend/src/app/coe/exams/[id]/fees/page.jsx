"use client";

import { useParams } from "next/navigation";

import FeeDesk from "../../../../components/exams/FeeDesk";

export default function CoeExamFeesPage() {
  const { id } = useParams();
  return <FeeDesk examId={id} canEdit backHref={`/coe/exams/${id}`} />;
}
