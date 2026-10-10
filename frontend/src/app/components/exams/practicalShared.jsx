"use client";

// Small pieces shared by the practical exam screens.

import { useEffect, useState } from "react";

import { useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";

export const fmtDay = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" }) : "Date not set";

export const sessionLabel = (s) => (s === "FN" ? "Morning" : s === "AN" ? "Afternoon" : "");

export const when = (b) => [fmtDay(b.date), sessionLabel(b.session), b.lab].filter(Boolean).join(" · ");

// The department that conducts a practical exam (includes Science & English)
export const dept = (d) => (String(d).toLowerCase() === "sc" ? "Science & English" : deptLabel(d));
export const branches = (list) => (list || []).map((d) => String(d).toUpperCase()).join(", ");

// Where a batch stands
export function batchState(b) {
  if (b.status === "SUBMITTED") return { label: "Marks submitted", chip: "bg-emerald-50 text-emerald-700" };
  if (!b.allotted) return { label: "No examiners", chip: "bg-orange-50 text-orange-700" };
  if (!b.date) return { label: "Date not fixed", chip: "bg-orange-50 text-orange-700" };
  if (b.codeLocked) return { label: "Code locked", chip: "bg-red-50 text-red-700" };
  return { label: "Waiting for marks", chip: "bg-blue-50 text-blue-700" };
}

// "Set 1 – Internal: A · External: B, College"
export const examinersOf = (p) => `Internal: ${p.internal.name} · External: ${p.external.name}${p.external.college ? `, ${p.external.college}` : ""}`;

export const ATTENDANCE_SHORT = { PRESENT: "", ABSENT: "AB", MALPRACTICE: "MP" };

// Examinations that are still running + the HOD's own department
export function usePracticalExams() {
  const api = useApi();
  const toast = useToast();
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [department, setDepartment] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api("get", "/practicals/exams");
        const list = Array.isArray(r.data?.data) ? r.data.data : [];
        setExams(list);
        setDepartment(r.data?.department || "");
        if (list[0]) setExamId(list[0]._id);
      } catch (e) {
        setExams([]);
        toast.error(errMsg(e, "Could not load examinations."));
      }
    })();
  }, [api, toast]);

  return { exams, examId, setExamId, department };
}

export function ExamSelect({ exams, examId, setExamId }) {
  if (exams && exams.length > 1)
    return (
      <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-2 h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
        {exams.map((e) => (
          <option key={e._id} value={e._id}>
            {e.name} · {e.academicYear}
          </option>
        ))}
      </select>
    );
  return <p className="mt-1 text-sm text-slate-500">{exams?.[0] ? `${exams[0].name} · ${exams[0].academicYear}` : " "}</p>;
}

export const NoExam = () => (
  <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No examination is running right now.</p>
);
