"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import PracticalEntry from "../../components/exams/PracticalEntry";
import { useApi } from "../../components/exams/shared";

// Only when this staff member has a question paper to set (upload / correct):
// a small reminder above the practical marks – otherwise nothing is shown.
function PaperReminder() {
  const api = useApi();
  const [open, setOpen] = useState(0);
  useEffect(() => {
    api("get", "/paper-setting/my")
      .then((r) => setOpen((r.data?.data || []).filter((p) => ["ASSIGNED", "UPLOADED", "RETURNED"].includes(p.status)).length))
      .catch(() => {});
  }, [api]);
  if (!open) return null;
  return (
    <Link href="/faculty" className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 hover:bg-indigo-100">
      <span className="flex-1">
        You have <b>{open}</b> question paper{open === 1 ? "" : "s"} to set.
      </span>
      <span className="font-semibold">Open paper setting →</span>
    </Link>
  );
}

// The faculty layout already adds the page padding
export default function FacultyPracticalPage() {
  return (
    <>
      <PaperReminder />
      <PracticalEntry pad={false} />
    </>
  );
}
