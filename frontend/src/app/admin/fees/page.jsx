"use client";

import FeeDesk from "../../components/exams/FeeDesk";

// Admin: the fee page, with "Delete fee records" (e.g. entries made while testing)
export default function AdminFeesPage() {
  return <FeeDesk canEdit />;
}
