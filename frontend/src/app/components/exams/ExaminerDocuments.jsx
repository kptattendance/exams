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
import { deptTint, tintRow } from "../ui/deptTint";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, deptShift, fmtDay, usePracticalExams } from "./practicalShared";

const DOCS = [
  ["intimation", "Intimation"],
  ["conducting", "Conducting certificate"],
  ["attendance", "Attendance certificate"],
];

// "25 Nov" (the exam and its year are in the page heading)
const shortDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Not set");

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
    <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-slate-950">Examiner certificates</h2>
          <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
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
          <div className="mt-2 flex flex-wrap items-center gap-2">
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

          <div className={`mt-2 ${T.wrap}`}>
            {data === null && <div className="h-48 animate-pulse" />}
            {data && shown.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">No examiner set has batches in the time table yet.</p>
            )}
            {shown.length > 0 && (
              <table className={T.table} style={{ fontFamily: '"Segoe UI", Arial, sans-serif' }}>
                <thead>
                  <tr className={T.headRow}>
                    <th className={T.thNum}>Sl.</th>
                    <th className={T.th}>Examiner set</th>
                    <th className={T.th}>Internal examiner</th>
                    <th className={T.th}>External examiner</th>
                    <th className={T.th}>Dates</th>
                    <th className={`${T.th} text-right`}>Batches</th>
                    <th className={`${T.th} text-right`}>Conducted</th>
                    <th className={`${T.th} text-right`}>Print</th>
                  </tr>
                </thead>
                <tbody className={T.body}>
                  {shown.map((d, i) => {
                    const batches = d.rows.reduce((n, r) => n + r.batches, 0);
                    const done = d.rows.reduce((n, r) => n + r.conducted, 0);
                    const tint = deptTint(d.panel.department);
                    return (
                      <tr key={d.panel._id} className={tintRow(d.panel.department, i)}>
                        <td className={T.tdNum}>{i + 1}</td>
                        <td className={`${T.td} whitespace-nowrap`} title={deptShift(d.panel.department, d.panel.shift)}>
                          <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${tint.chip}`}>{String(d.panel.department).toUpperCase()}</span>
                          {d.panel.shift === "EVENING" && <span className="ml-1 rounded-md bg-indigo-100 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-800">Evening</span>}
                          <span className="ml-1.5 text-xs text-slate-500">Set {d.panel.number}</span>
                        </td>
                        <td className={T.td}>
                          {d.internal.name ? <span className="block text-[13px] font-semibold uppercase text-slate-900">{d.internal.name}</span> : <span className="text-slate-400">Not allotted</span>}
                          {d.internal.designation && <span className="block text-xs text-slate-600">{d.internal.designation}</span>}
                        </td>
                        <td className={T.td}>
                          {d.external.name ? <span className="block text-[13px] font-semibold uppercase text-slate-900">{d.external.name}</span> : <span className="text-slate-400">Not allotted</span>}
                          {d.external.college && <span className="block text-xs text-slate-600">{d.external.college}</span>}
                        </td>
                        <td className={`${T.td} whitespace-nowrap text-xs`} title={d.to !== d.from ? `${fmtDay(d.from)} to ${fmtDay(d.to)}` : fmtDay(d.from)}>
                          {shortDay(d.from)}
                          {d.to !== d.from && ` – ${shortDay(d.to)}`}
                        </td>
                        <td className={`${T.td} text-right font-semibold tabular-nums`}>{batches}</td>
                        <td className={`${T.td} text-right font-semibold tabular-nums ${done === batches ? "text-emerald-700" : "text-slate-700"}`}>{done}</td>
                        <td className={`${T.td} min-w-[270px] text-right`}>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {DOCS.map(([doc, label]) => {
                              const p = d.panel.printed?.[doc];
                              return (
                                <span key={doc} className="flex items-center gap-1">
                                  <button
                                    onClick={() => open(doc, d.panel._id)}
                                    title={p ? `Printed ${new Date(p.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}${p.by ? ` by ${p.by}` : ""}` : "Not printed yet"}
                                    className={
                                      p
                                        ? "inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                                        : `${btn.small} whitespace-nowrap`
                                    }
                                  >
                                    {p && "✓ "}
                                    {label.replace(" certificate", "")}
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
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold text-slate-900">
                    <td className={T.td} colSpan={5}>
                      Total ({shown.length} examiner set{shown.length === 1 ? "" : "s"})
                    </td>
                    <td className={`${T.td} text-right tabular-nums`}>{shown.reduce((n, d) => n + d.rows.reduce((a, r) => a + r.batches, 0), 0)}</td>
                    <td className={`${T.td} text-right tabular-nums`}>{shown.reduce((n, d) => n + d.rows.reduce((a, r) => a + r.conducted, 0), 0)}</td>
                    <td className={T.td} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
