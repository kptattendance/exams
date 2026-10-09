"use client";

import { useParams } from "next/navigation";

import Timetable from "../../../../components/exams/Timetable";

export default function CoeExamTimetablePage() {
  const { id } = useParams();
  return <Timetable examId={id} canManage backHref={`/coe/exams/${id}`} />;
}
