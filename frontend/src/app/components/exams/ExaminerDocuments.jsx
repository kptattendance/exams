"use client";

// Office → Examiner certificates
// For every examiner set with batches in the HOD's time table: the intimation
// for setting & conducting, the setting / conducting certificate and the
// attendance certificate (internal and external examiner) – to print and hand over.

import { useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { T } from "../ui/table";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, deptShift, fmtDay, usePracticalExams } from "./practicalShared";

const DOCS = [
  ["intimation", "Intimation"],
  ["conducting", "Conducting certificate"],
  ["attendance", "Attendance certificate"],
];

// every department's rows in their own light colour
const TINTS = [
  { row: "bg-sky-50/60", edge: "border-sky-400", text: "text-sky-900" },
  { row: "bg-emerald-50/60", edge: "border-emerald-400", text: "text-emerald-900" },
  { row: "bg-violet-50/60", edge: "border-violet-400", text: "text-violet-900" },
  { row: "bg-teal-50/60", edge: "border-teal-400", text: "text-teal-900" },
  { row: "bg-indigo-50/60", edge: "border-indigo-400", text: "text-indigo-900" },
  { row: "bg-fuchsia-50/60", edge: "border-fuchsia-400", text: "text-fuchsia-900" },
  { row: "bg-cyan-50/60", edge: "border-cyan-400", text: "text-cyan-900" },
  { row: "bg-lime-50/60", edge: "border-lime-500", text: "text-lime-900" },
  { row: "bg-rose-50/60", edge: "border-rose-400", text: "text-rose-900" },
];
const tintIndex = new Map();
const tintOf = (key) => {
  if (!tintIndex.has(key)) tintIndex.set(key, tintIndex.size % TINTS.length);
  return TINTS[tintIndex.get(key)];
};

export default function ExaminerDocuments() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId } = usePracticalExams();
  const [data, setData] = useState(null);
  const [department, setDepartment] = useState("");

  const [tick, setTick] = useState(0); // reload after printing / undoing
  useEffect(() => {
    if (!examId) return;
    let alive = true;
    api("get", `/practicals/${examId}/examiner-documents`)
      .then((r) => alive && setData(r.data.data || []))
      .catch((e) => {
        if (!alive) return;
        setData([]);
        toast.error(errMsg(e, "Could not load the examiner sets."));
      });
    return () => {
      alive = false;
    };
  }, [api, examId, toast, tick]);

  // back on this tab after printing: show the new ticks
  useEffect(() => {
    const on = () => document.visibilityState === "visible" && setTick((t) => t + 1);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const unmark = async (doc, panel) => {
    try {
      await api("post", `/practicals/${examId}/examiner-documents/printed`, { doc, panels: [panel], printed: false });
      setTick((t) => t + 1);
    } catch (e) {
      toast.error(errMsg(e, "Could not change it."));
    }
  };

  // "DAY|ee" and "EVENING|ee" are different: the evening college's sets stand apart
  const keyOf = (p) => `${p.shift === "EVENING" ? "EVENING" : "DAY"}|${p.department}`;
  const departments = useMemo(() => [...new Set((data || []).map((d) => keyOf(d.panel)))].sort(), [data]);
  const shown = (data || []).filter((d) => !department || keyOf(d.panel) === department);

  const open = (doc, panel = "") => {
    const q = new URLSearchParams({ doc });
    if (panel) q.set("panel", panel);
    else if (department) {
      const [shift, d] = department.split("|");
      q.set("department", d);
      q.set("shift", shift);
    }
    window.open(`/print/examiner-documents/${examId}?${q}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Examiner certificates</h2>
          <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            For every examiner set, from the HOD&apos;s practical time table: the intimation for setting &amp; conducting, the setting / conducting
            certificate and the attendance certificate for the internal and the external examiner. Dates can be corrected on the print page.
          </p>
        </div>
        {examId && shown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {DOCS.map(([doc, label]) => (
              <button key={doc} onClick={() => open(doc)} className={btn.primary}>
                <Icon name="download" className="h-4 w-4" />
                All – {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {exams && exams.length === 0 && <NoExam />}

      {examId && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={T.field} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {deptShift(d.split("|")[1], d.split("|")[0])}
                </option>
              ))}
            </select>
            {/* how many sets have each document printed */}
            {shown.length > 0 &&
              DOCS.map(([doc, label]) => {
                const n = shown.filter((d) => d.panel.printed?.[doc]).length;
                return (
                  <span
                    key={doc}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${n === shown.length ? "bg-emerald-100 text-emerald-800" : n ? "bg-sky-100 text-sky-800" : "bg-slate-100 text-slate-600"}`}
                  >
                    {label}: {n} / {shown.length} printed
                  </span>
                );
              })}
          </div>

          <div className={`mt-4 ${T.wrap}`}>
            {data === null && <div className="h-48 animate-pulse" />}
            {data && shown.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No examiner set has batches in the time table yet.</p>
            )}
            {shown.length > 0 && (
              <table className={T.table}>
                <thead>
                  <tr className={T.headRow}>
                    <th className={T.thNum}>Sl.</th>
                    <th className={T.th}>Examiner set</th>
                    <th className={T.th}>Internal examiner</th>
                    <th className={T.th}>External examiner</th>
                    <th className={T.th}>Dates</th>
                    <th className={`${T.th} text-right`}>Batches</th>
                    <th className={`${T.th} text-right`}>Print</th>
                  </tr>
                </thead>
                <tbody className={T.body}>
                  {shown.map((d, i) => {
                    const batches = d.rows.reduce((n, r) => n + r.batches, 0);
                    const done = d.rows.reduce((n, r) => n + r.conducted, 0);
                    const tint = tintOf(keyOf(d.panel));
                    return (
                      <tr key={d.panel._id} className={`${tint.row} border-l-4 ${tint.edge}`}>
                        <td className={T.tdNum}>{i + 1}</td>
                        <td className={T.td}>
                          <b className={tint.text}>{deptShift(d.panel.department, d.panel.shift)}</b>
                          <span className="block text-xs text-slate-500">Set {d.panel.number}</span>
                        </td>
                        <td className={T.td}>
                          {d.internal.name || <span className="text-slate-400">Not allotted</span>}
                          {d.internal.designation && <span className="block text-xs text-slate-500">{d.internal.designation}</span>}
                        </td>
                        <td className={T.td}>
                          {d.external.name || <span className="text-slate-400">Not allotted</span>}
                          {d.external.college && <span className="block text-xs text-slate-500">{d.external.college}</span>}
                        </td>
                        <td className={`${T.td} whitespace-nowrap text-xs`}>
                          {fmtDay(d.from)}
                          {d.to !== d.from && <span className="block text-slate-500">to {fmtDay(d.to)}</span>}
                        </td>
                        <td className={`${T.td} text-right tabular-nums`}>
                          {batches}
                          <span className="block text-xs text-slate-500">{done} conducted</span>
                        </td>
                        <td className={`${T.td} text-right`}>
                          <div className="flex flex-col items-end gap-1.5">
                            {DOCS.map(([doc, label]) => {
                              const p = d.panel.printed?.[doc];
                              return (
                                <span key={doc} className="flex items-center gap-1">
                                  <button
                                    onClick={() => open(doc, d.panel._id)}
                                    title={p ? `Printed ${new Date(p.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${p.by ? ` by ${p.by}` : ""}` : "Not printed yet"}
                                    className={
                                      p
                                        ? "inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                        : btn.small
                                    }
                                  >
                                    {p && "✓ "}
                                    {label}
                                    {p && <span className="font-normal text-emerald-700">· {new Date(p.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                                  </button>
                                  {p && (
                                    <button onClick={() => unmark(doc, d.panel._id)} title="Mark as not printed" aria-label="Mark as not printed" className="h-6 w-6 rounded text-slate-400 hover:bg-slate-100 hover:text-red-600">
                                      ×
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
