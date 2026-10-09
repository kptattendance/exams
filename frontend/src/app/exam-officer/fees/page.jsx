"use client";

import FeeDesk from "../../components/exams/FeeDesk";

// Exam Officer: view only, starts with students who have not fully paid
export default function ExamOfficerFeesPage() {
  return <FeeDesk initialStatus="PENDING" />;
}
