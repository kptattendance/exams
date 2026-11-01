"use client";

// HOD: for one examination, every student of the department – the subjects he
// may write, his back papers, subjects not permitted (ANS / NE) and the exam
// fee to pay (per subject, per back paper, late fee by date, set by the COE).
// Download as Excel and share it with the students.

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";

const rs = (n) => `Rs ${Number(n || 0).toLocaleString("en-IN")}`;
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
const today = () => new Date().toISOString().slice(0, 10);
const TYPE = { regular: "Regular", "lateral-puc": "Lateral (PUC)", "lateral-iti": "Lateral (ITI)", "lateral-iti-cross": "Lateral (ITI cross)" };

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
  const slabs = d?.rules?.lateFees || [];
  const total = rows.reduce((a, r) => a + r.fee.total, 0);

  const download = () => {
    const rules = d.rules;
    const head = [
      "Sl",
      "Register No.",
      "Roll No.",
      "Name",
      "Sem",
      "Admission",
      "Subjects (may write)",
      "No.",
      "Back papers",
      "No.",
      "Not permitted",
      "Decision awaited",
      `Subject fee (${rules.perSubject} each)`,
      `Back paper fee (${rules.backPaper} each)`,
      `Late fee (on ${day(d.on)})`,
      `TOTAL (on ${day(d.on)})`,
      ...slabs.map((s) => `Total if paid from ${day(s.from)}`),
    ];
    const body = rows.map((r, i) => [
      i + 1,
      r.registerNumber,
      r.rollNumber,
      r.name,
      r.semester,
      TYPE[r.admissionType] || r.admissionType,
      r.eligible.join(", "),
      r.fee.current,
      r.backPapers.join(", "),
      r.fee.backPapers,
      r.notPermitted.join(", "),
      r.pending.join(", "),
      r.fee.currentFee,
      r.fee.backPaperFee,
      r.fee.late,
      r.fee.total,
      ...slabs.map((s) => (r.fee.current + r.fee.backPapers ? r.fee.base + (Number(s.amount) || 0) : 0)),
    ]);
    const title = [
      [`${d.exam.name} – exam fee`],
      [`Department: ${deptLabel(d.department)} · Fee per subject Rs ${rules.perSubject} · per back paper Rs ${rules.backPaper}${slabs.length ? ` · late fee: ${slabs.map((s) => `from ${day(s.from)} Rs ${s.amount}`).join(", ")}` : ""}`],
      ["Only subjects the student may write are charged. Not permitted = attendance shortage (ANS) or IA below minimum (NE)."],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...title, head, ...body]);
    ws["!cols"] = head.map((h, i) => ({ wch: [4, 13, 10, 26, 5, 14, 34, 5, 20, 5, 22, 18][i] || Math.max(12, String(h).length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Exam fee");
    XLSX.writeFile(wb, `Exam_fee_${String(d.department).toUpperCase()}${sem ? `_Sem${sem}` : ""}_${d.on}.xlsx`);
  };

  return (
    <div className="mx-auto max-w-6xl p-3 md:p-5">
      <h1 className="text-xl font-bold text-gray-800 md:text-2xl">Exam fee list</h1>
      <p className="text-sm text-gray-500">Each student&apos;s subjects for the exam and the fee to pay – download the Excel and share it with the students.</p>

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
          Download Excel
        </button>
      </div>

      {d?.rules && (
        <p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Fee per subject <b>{rs(d.rules.perSubject)}</b> · per back paper <b>{rs(d.rules.backPaper)}</b>
          {slabs.length > 0 && <> · late fee {slabs.map((s) => `from ${day(s.from)} ${rs(s.amount)}`).join(", ")}</>}
          {" "}(set by the COE) · {rows.length} students · total {rs(total)}
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
                <th className="px-2 py-2">Subjects (may write)</th>
                <th className="px-2 py-2">Back papers</th>
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
                  <td className="px-2 py-2 text-gray-700">
                    {r.eligible.join(", ") || "—"} <span className="text-gray-400">({r.fee.current})</span>
                  </td>
                  <td className="px-2 py-2 text-gray-700">{r.backPapers.length ? `${r.backPapers.join(", ")} (${r.fee.backPapers})` : "—"}</td>
                  <td className="px-2 py-2">
                    {r.notPermitted.length > 0 && <p className="font-semibold text-red-700">{r.notPermitted.join(", ")}</p>}
                    {r.pending.length > 0 && <p className="text-orange-700">Awaited: {r.pending.join(", ")}</p>}
                    {!r.notPermitted.length && !r.pending.length && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <p className="text-sm font-bold text-gray-900">{rs(r.fee.total)}</p>
                    <p className="text-[10px] text-gray-500">
                      {r.fee.currentFee}
                      {r.fee.backPaperFee ? ` + ${r.fee.backPaperFee}` : ""}
                      {r.fee.late ? ` + ${r.fee.late} late` : ""}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-gray-500">
        Only subjects the student may write are charged. &quot;Awaited&quot; = IA / attendance not confirmed yet – not charged until decided.
      </p>
    </div>
  );
}
