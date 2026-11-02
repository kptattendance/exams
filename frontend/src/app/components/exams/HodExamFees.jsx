"use client";

// HOD: for one examination, every student of the department – the subjects he
// may write, his back papers, subjects not permitted (ANS / NE) and the exam
// fee to pay. Fee (DTE circular, set by the COE): for each semester exam he
// writes – 1 or 2 subjects or 3+ (full semester) – plus the marks card fee and
// the late fee by date; bridge courses are a separate exam.
// Download as a PDF and share it with the students.

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";

const rs = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN")}`;
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const today = () => new Date().toISOString().slice(0, 10);
const TYPE = { regular: "Regular", "lateral-puc": "Lateral (PUC)", "lateral-iti": "Lateral (ITI)", "lateral-iti-cross": "Lateral (ITI cross)" };
// "Sem 3 (4 subjects): 300 + 50 + 100 late = 450"
const examLine = (e) => `${e.label} (${e.count} subject${e.count === 1 ? "" : "s"}): ${e.fee} + ${e.marksCard}${e.late ? ` + ${e.late} late` : ""} = ${e.total}`;

export default function HodExamFees() {
  const api = useApi();
  const toast = useToast();
  const [examId, setExamId] = useState("");
  const [on, setOn] = useState(today());
  const [d, setD] = useState(null);
  const [q, setQ] = useState("");
  const [sem, setSem] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/exams/hod/fee-list", undefined, { params: { ...(examId ? { exam: examId } : {}), on } });
      setD(r.data);
      if (!examId && r.data.exam) setExamId(r.data.exam._id);
    } catch (e) {
      setD({ exams: [], rows: [] });
      toast.error(errMsg(e, "Could not load the exam fee list."));
    }
  }, [api, examId, on, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const t = q.trim().toUpperCase();
    return (d?.rows || []).filter((r) => (!sem || String(r.semester) === sem) && (!t || [r.registerNumber, r.rollNumber, r.name].some((v) => String(v || "").toUpperCase().includes(t))));
  }, [d, q, sem]);
  const semesters = [...new Set((d?.rows || []).map((r) => r.semester))].sort();
  const rules = d?.rules;
  const slabs = rules?.lateFees || [];
  const total = rows.reduce((a, r) => a + r.fee.total, 0);

  // the colourful PDF (print page) of the list shown – to share with the students
  const download = () => {
    try {
      localStorage.setItem(
        "kpt-exam-fees",
        JSON.stringify({ exam: d.exam, department: d.department, on: d.on, rules, semester: sem, rows })
      );
    } catch {
      toast.error("The browser blocked the PDF. Please allow site data and try again.");
      return;
    }
    window.open("/print/exam-fees?auto=1", "_blank");
  };

  return (
    <div className="mx-auto max-w-6xl p-3 md:p-5">
      <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Exam fee list</h1>
      <p className="text-sm text-gray-500">Each student&apos;s subjects for the exam and the fee to pay – download the PDF and share it with the students.</p>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Examination</span>
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-1 block h-10 rounded-lg border border-gray-300 px-3 text-sm">
            {(d?.exams || []).map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} · {e.academicYear}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Fee as on</span>
          <input type="date" value={on} onChange={(e) => setOn(e.target.value || today())} className="mt-1 block h-10 rounded-lg border border-gray-300 px-3 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-gray-600">Semester</span>
          <select value={sem} onChange={(e) => setSem(e.target.value)} className="mt-1 block h-10 rounded-lg border border-gray-300 px-3 text-sm">
            <option value="">All</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </label>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / reg no" className="h-10 w-52 rounded-lg border border-gray-300 px-3 text-sm" />
        <button onClick={download} disabled={!rows.length} className={`${btn.primary} ml-auto`}>
          <Icon name="download" className="h-4 w-4" />
          Download PDF
        </button>
      </div>

      {rules && (
        <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
          For each semester exam: 1–2 subjects <b>{rs(rules.upTo2)}</b>, 3+ / full semester <b>{rs(rules.threePlus)}</b>, + marks card <b>{rs(rules.marksCard)}</b>
          {slabs.length > 0 && <> · late fee {slabs.map((s) => `from ${day(s.from)} ${rs(s.amount)}`).join(", ")}</>} (set by the COE) · {rows.length} students · total {rs(total)}
        </p>
      )}

      {d && !d.exam && <p className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No examination has been created yet.</p>}
      {d?.exam && !d.rows.length && (
        <p className="mt-6 rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No students of your department are registered for this exam yet. The COE registers them (Refresh registration).</p>
      )}

      {rows.length > 0 && (
        <div className="mt-3 max-h-[65vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full min-w-[900px] border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-slate-800 text-left text-white">
              <tr>
                <th className="px-2 py-2">#</th>
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Subjects</th>
                <th className="px-2 py-2">Back papers / bridge</th>
                <th className="px-2 py-2">Not permitted / awaited</th>
                <th className="px-2 py-2 text-right">Fee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, i) => (
                <tr key={r.registerNumber} className="align-top">
                  <td className="px-2 py-2 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-2">
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    <p className="text-[11px] text-gray-500">
                      {r.registerNumber} · Sem {r.semester}
                      {r.admissionType !== "regular" && ` · ${TYPE[r.admissionType]}`}
                    </p>
                  </td>
                  <td className="px-2 py-2 text-gray-700">{r.eligible.join(", ") || "—"}</td>
                  <td className="px-2 py-2 text-gray-700">
                    {r.backPapers.length > 0 && <p>Back: {r.backPapers.join(", ")}</p>}
                    {r.bridge.length > 0 && <p className="text-violet-800">Bridge: {r.bridge.join(", ")}</p>}
                    {!r.backPapers.length && !r.bridge.length && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-2">
                    {r.notPermitted.length > 0 && <p className="font-semibold text-red-700">{r.notPermitted.join(", ")}</p>}
                    {r.pending.length > 0 && <p className="text-orange-700">Awaited: {r.pending.join(", ")}</p>}
                    {!r.notPermitted.length && !r.pending.length && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <p className="text-sm font-bold text-gray-900">{rs(r.fee.total)}</p>
                    {r.fee.exams.map((e) => (
                      <p key={e.label} className="text-[10px] text-gray-500">
                        {examLine(e)}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-500">
        Every registered subject is counted, including back papers – the fee is collected before eligibility (ANS / NE) is announced and is not refunded. ANS / NE and &quot;Awaited&quot; are shown for information only.
      </p>
    </div>
  );
}
