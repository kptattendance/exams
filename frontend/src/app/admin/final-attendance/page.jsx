"use client";

import SheetReview from "../../components/exams/SheetReview";

// Admin: every Final attendance sheet; may delete one of the running year (even frozen)
export default function AdminFinalAttendancePage() {
  return <SheetReview type="attendance" admin />;
}
