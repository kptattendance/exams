"use client";

import FeeDesk from "../../components/exams/FeeDesk";

// Admin: the fee page – mark as paid (deleting is on /admin/fees/delete)
export default function AdminFeesPage() {
  return <FeeDesk canEdit />;
}
