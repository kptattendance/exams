"use client";

// Small pieces shared by the practical exam screens.

import { useEffect, useState } from "react";

import { useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";

export const fmtDay = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", weekday: "short" }) : "Date not set";

// The HOD time table's four slots (S1–S4). FN / AN: older morning / afternoon batches.
export const SLOTS = [
  { code: "S1", label: "8:30 AM – 11:30 AM" },
  { code: "S2", label: "11:30 AM – 2:30 PM" },
  { code: "S3", label: "2:30 PM – 5:30 PM" },
  { code: "S4", label: "5:00 PM – 8:00 PM" },
];

export const sessionLabel = (s) => (s === "FN" ? "Morning" : s === "AN" ? "Afternoon" : SLOTS.find((x) => x.code === s)?.label || "");

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
  if (exams === null) return <p className="mt-1 text-sm font-semibold text-slate-500">Loading… please wait</p>;
  return <p className="mt-1 text-sm text-slate-500">{exams?.[0] ? `${exams[0].name} · ${exams[0].academicYear}` : " "}</p>;
}

// HOD: the three steps of the practical exams, with where he is now.
//   done: { batches: bool, timetable: bool }   here: 1 | 2 (the page he is on)
const STEPS = [
  { n: 1, title: "Make batches", text: "Open each subject, choose how many batches, Save.", href: "/hod/practical" },
  { n: 2, title: "Fix the time table", text: "Put each batch on a date and time, choose lab and examiners, Save.", href: "/hod/practical-timetable" },
  { n: 3, title: "Print and share", text: "Download the PDF for students and the PDF of examiners.", href: "/hod/practical-timetable" },
];
export function PracticalSteps({ done = {}, here }) {
  const ok = [Boolean(done.batches), Boolean(done.batches && done.timetable), false];
  const next = ok.indexOf(false) + 1; // the step to do now
  return (
    <ol className="mt-4 grid gap-2 sm:grid-cols-3">
      {STEPS.map((s, i) => {
        const isDone = ok[i];
        const isNext = s.n === next;
        const body = (
          <>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                isDone ? "bg-emerald-600 text-white" : isNext ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
              }`}
            >
              {isDone ? "✓" : s.n}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-900">
                Step {s.n}: {s.title}
                {isNext && <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-800">Do this now</span>}
              </span>
              <span className="block text-xs leading-5 text-slate-600">{s.text}</span>
            </span>
          </>
        );
        const cls = `flex gap-2.5 rounded-xl border p-3 ${isDone ? "border-emerald-200 bg-emerald-50/60" : isNext ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white"}`;
        return (
          <li key={s.n}>
            {s.n === here || (s.n === 3 && here === 2) ? (
              <div className={cls}>{body}</div>
            ) : (
              <a href={s.href} className={`${cls} hover:border-slate-400`}>
                {body}
              </a>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const NoExam = () => (
  <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No examination is running right now.</p>
);
