"use client";

import ExamSessions from "../../components/exams/ExamSessions";

// COE: the same exam-session screen as the Chief Examiner (to watch and help)
export default function COEExamSessionsPage() {
  return <ExamSessions qpHref="/coe/paper-setting" codingHref="/coe/valuation" />;
}
