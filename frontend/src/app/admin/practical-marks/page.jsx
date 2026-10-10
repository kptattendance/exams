"use client";

import PracticalAllotment from "../../components/exams/PracticalAllotment";

// Only the Admin can correct a practical mark after the examiners submit it
export default function AdminPracticalMarksPage() {
  return <PracticalAllotment mode="admin" />;
}
