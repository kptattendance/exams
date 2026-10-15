"use client";

import FeeDesk from "../../components/exams/FeeDesk";

// Office verifies the fees; starts with students who have not fully paid
export default function OfficeFeesPage() {
  return <FeeDesk canEdit initialStatus="PENDING" />;
}
