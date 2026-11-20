"use client";

import ExamSessions from "../../components/exams/ExamSessions";

// Exam section office: rooms and seats of each written-exam session, the seating
// plan (notice board + door sheets) and a student's room / seat. No ATS numbers.
export default function OfficeExamSessionsPage() {
  return <ExamSessions qpHref="/office" />;
}
