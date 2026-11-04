"use client";

import FeeDesk from "../../../components/exams/FeeDesk";

// Admin: tick students and delete their fee records (e.g. entries made while testing)
export default function AdminFeesDeletePage() {
  return <FeeDesk canEdit mode="delete" initialStatus="ANY_PAID" />;
}
