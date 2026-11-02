"use client";

import SheetReview from "../../components/exams/SheetReview";

// Admin: every Final IA sheet; may delete one of the running year (even frozen)
export default function AdminFinalIAPage() {
  return <SheetReview type="ia" admin />;
}
