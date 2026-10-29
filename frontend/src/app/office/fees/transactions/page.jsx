"use client";

import FeeDesk from "../../../components/exams/FeeDesk";

// Office: students already marked paid – add their transaction details later
export default function OfficeFeeTransactionsPage() {
  return <FeeDesk canEdit mode="transactions" initialStatus="ANY_PAID" />;
}
