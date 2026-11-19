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

export default function ExaminerDocuments() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId } = usePracticalExams();
  const [data, setData] = useState(null);
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (!examId) return;
    let alive = true;
    setData(null);
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
  }, [api, examId, toast]);

  const departments = useMemo(() => [...new Set((data || []).map((d) => d.panel.department))].sort(), [data]);
  const shown = (data || []).filter((d) => !department || d.panel.department === department);

  const open = (doc, panel = "") => {
    const q = new URLSearchParams({ doc });
    if (panel) q.set("panel", panel);
    else if (department) q.set("department", department);
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
          <div className="mt-5 flex flex-wrap gap-2">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={T.field} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {deptShift(d)}
                </option>
              ))}
            </select>
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
                    return (
                      <tr key={d.panel._id} className={T.row}>
                        <td className={T.tdNum}>{i + 1}</td>
                        <td className={T.td}>
                          <b>{deptShift(d.panel.department, d.panel.shift)}</b>
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
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {DOCS.map(([doc, label]) => (
                              <button key={doc} onClick={() => open(doc, d.panel._id)} className={btn.small}>
                                {label}
                              </button>
                            ))}
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
