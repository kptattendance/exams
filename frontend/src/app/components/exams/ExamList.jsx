"use client";

// List of examinations + "New examination" form.
// Used by COE (canManage) and Exam Officer (view only).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { ACADEMIC_YEARS, errMsg, useApi } from "./shared";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "");

export default function ExamList({ basePath, canManage = false }) {
  const api = useApi();
  const toast = useToast();
  const [exams, setExams] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/exams");
      setExams(Array.isArray(r.data?.data) ? r.data.data : []);
    } catch (e) {
      setExams([]);
      toast.error(errMsg(e, "Could not load examinations."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Examinations</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            {canManage
              ? "Create an exam and the software registers every student for his subjects and back papers, and checks IA and attendance for each subject."
              : "Registered students and their eligibility for each exam."}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setCreating(true)} className={btn.primary}>
            <Icon name="plus" className="h-4 w-4" strokeWidth={2.25} />
            New examination
          </button>
        )}
      </div>

      {exams === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Icon name="paper" className="h-6 w-6" />
          </span>
          <p className="mt-4 font-semibold text-slate-900">No examinations yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            {canManage ? "Create the first one, e.g. “Nov/Dec 2026 Semester End Exam”." : "The COE has not created an exam yet."}
          </p>
          {canManage && (
            <button onClick={() => setCreating(true)} className={`${btn.primary} mt-5`}>
              <Icon name="plus" className="h-4 w-4" strokeWidth={2.25} />
              New examination
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {exams.map((e) => (
            <ExamCard key={e._id} exam={e} href={`${basePath}/${e._id}`} />
          ))}
        </div>
      )}

      {canManage && (
        <CreateExam open={creating} onClose={() => setCreating(false)} basePath={basePath} />
      )}
    </div>
  );
}

function ExamCard({ exam, href }) {
  const s = exam.stats || {};
  const notYet = !s.students;
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold tracking-tight text-slate-950">{exam.name}</p>
          <p className="mt-0.5 text-sm text-slate-500">
            {exam.academicYear} · Semester {exam.semesters.join(", ")} · Created {fmt(exam.createdAt)}
          </p>
        </div>
        <Icon name="chevronRight" className="mt-1 h-5 w-5 text-slate-300 group-hover:text-slate-600" />
      </div>

      {notYet ? (
        <p className="mt-5 rounded-xl bg-orange-50 px-3 py-2.5 text-sm font-medium text-orange-800">
          Students not registered yet – open to start.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-4 gap-2 text-center">
          <Stat n={s.students} label="Students" />
          <Stat n={s.ALL_CLEAR || 0} label="All clear" tone="text-emerald-700" />
          <Stat n={(s.PARTIAL || 0) + (s.BLOCKED || 0)} label="Not permitted" tone="text-red-600" />
          <Stat n={s.PENDING || 0} label="Waiting" tone="text-slate-500" />
        </div>
      )}
    </Link>
  );
}

const Stat = ({ n, label, tone = "text-slate-950" }) => (
  <div className="rounded-xl bg-slate-50 px-1 py-2.5">
    <p className={`text-lg font-bold tabular-nums ${tone}`}>{n}</p>
    <p className="text-[11px] font-medium text-slate-500">{label}</p>
  </div>
);

// ------------------------------------------------------------ create form

export function suggestName() {
  const d = new Date();
  const m = d.getMonth(); // 0-based
  const y = d.getFullYear();
  return m >= 7 || m <= 0 ? `Nov/Dec ${m === 0 ? y - 1 : y} Semester End Exam` : `May/June ${y} Semester End Exam`;
}

export function currentAcademicYear() {
  const d = new Date();
  const start = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export function ExamForm({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const toggleSem = (s) =>
    set("semesters", value.semesters.includes(s) ? value.semesters.filter((x) => x !== s) : [...value.semesters, s].sort());
  const years = [...new Set([...ACADEMIC_YEARS, value.academicYear])].sort();

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Exam name</span>
        <input value={value.name} onChange={(e) => set("name", e.target.value)} className={`${field} mt-1.5`} />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Academic year</span>
        <span className="block text-xs text-slate-500">IA and attendance of this year are used.</span>
        <select value={value.academicYear} onChange={(e) => set("academicYear", e.target.value)} className={`${field} mt-1.5`}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </label>

      <div>
        <span className="text-sm font-semibold text-slate-800">Semesters writing this exam</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((s) => {
            const on = value.semesters.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleSem(s)}
                className={`h-10 w-12 rounded-xl border text-sm font-bold transition ${
                  on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                }`}
                aria-pressed={on}
              >
                {s}
              </button>
            );
          })}
          <button type="button" onClick={() => set("semesters", [1, 3, 5])} className={btn.small}>
            Odd
          </button>
          <button type="button" onClick={() => set("semesters", [2, 4, 6])} className={btn.small}>
            Even
          </button>
        </div>
      </div>

      <div>
        <span className="text-sm font-semibold text-slate-800">Back papers</span>
        <div className="mt-2 space-y-2">
          {[
            ["SAME_PARITY", "Only odd- or even-semester back papers, matching this exam", "Usual choice"],
            ["ALL", "Back papers of every semester", ""],
            ["NONE", "No back papers in this exam", ""],
          ].map(([v, label, hint]) => (
            <label
              key={v}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                value.backPapers === v ? "border-blue-600 bg-blue-50/60" : "border-slate-200"
              }`}
            >
              <input
                type="radio"
                name="backPapers"
                checked={value.backPapers === v}
                onChange={() => set("backPapers", v)}
                className="mt-0.5 accent-blue-600"
              />
              <span className="text-slate-800">
                {label}
                {hint && <span className="ml-2 text-xs font-semibold text-blue-700">{hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Minimum attendance (%)</span>
        <span className="block text-xs text-slate-500">Below this a subject is marked ANS (not permitted).</span>
        <input
          type="number"
          min={0}
          max={100}
          value={value.minAttendance}
          onChange={(e) => set("minAttendance", e.target.value)}
          className={`${field} mt-1.5 max-w-[8rem]`}
        />
      </label>
    </div>
  );
}

function CreateExam({ open, onClose, basePath }) {
  const api = useApi();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(() => ({
    name: suggestName(),
    academicYear: currentAcademicYear(),
    semesters: new Date().getMonth() >= 5 ? [1, 3, 5] : [2, 4, 6],
    backPapers: "SAME_PARITY",
    minAttendance: 75,
  }));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", "/exams", { ...form, minAttendance: Number(form.minAttendance) });
      toast.success("Examination created. Now register the students.");
      router.push(`${basePath}/${r.data.data._id}`);
    } catch (e) {
      toast.error(errMsg(e, "Could not create the examination."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      title="New examination"
      subtitle="You can change these later."
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !form.semesters.length} className={btn.primary}>
            {busy ? "Creating…" : "Create examination"}
          </button>
        </>
      }
    >
      <ExamForm value={form} onChange={setForm} />
    </Modal>
  );
}
