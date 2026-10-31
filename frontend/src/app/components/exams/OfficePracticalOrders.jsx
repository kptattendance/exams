"use client";

// Exam section: print the office orders of the practical examiners – internal
// and external – to keep on file. The same orders the COE allots and emails;
// nothing can be changed here.

import { useEffect, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, dept, usePracticalExams } from "./practicalShared";

const link = (examId, params) => `/print/practical-orders/${examId}?${new URLSearchParams(params)}`;

export default function OfficePracticalOrders() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId } = usePracticalExams();
  const [rows, setRows] = useState(null);
  const [department, setDepartment] = useState("");

  useEffect(() => {
    if (!examId) return;
    let alive = true;
    api("get", `/practicals/${examId}/panels`)
      .then((r) => alive && setRows((r.data?.data || []).filter((d) => d.panels.length)))
      .catch((e) => {
        if (!alive) return;
        setRows([]);
        toast.error(errMsg(e, "Could not load the examiners."));
      });
    return () => {
      alive = false;
    };
  }, [api, examId, toast]);

  const shown = (rows || []).filter((d) => !department || d.department === department);
  const sets = shown.reduce((a, d) => a + d.panels.length, 0);
  const scope = department ? { department } : {};

  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical examiner orders</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-500">
        The office orders of the internal and external practical examiners allotted by the COE – print them and keep them on file.
      </p>
      <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />

      {rows && rows.length === 0 && <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No examiners have been allotted for this examination yet.</p>}

      {rows && rows.length > 0 && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All departments</option>
              {rows.map((d) => (
                <option key={d.department} value={d.department}>
                  {dept(d.department)}
                </option>
              ))}
            </select>
            <span className="mr-auto text-xs text-slate-500">{sets} examiner set{sets === 1 ? "" : "s"}</span>
            <a href={link(examId, { ...scope, who: "both" })} target="_blank" rel="noreferrer" className={btn.primary}>
              <Icon name="download" className="h-4 w-4" />
              All orders (internal + external)
            </a>
            <a href={link(examId, { ...scope, who: "external" })} target="_blank" rel="noreferrer" className={btn.secondary}>
              External only
            </a>
            <a href={link(examId, { ...scope, who: "internal" })} target="_blank" rel="noreferrer" className={btn.secondary}>
              Internal only
            </a>
          </div>

          <div className="mt-4 space-y-4">
            {shown.map((d) => (
              <section key={d.department} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <p className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-900">{dept(d.department)}</p>
                <ul className="divide-y divide-slate-100">
                  {d.panels.map((p) => (
                    <li key={p._id} className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center">
                      <span className="w-14 shrink-0 text-xs font-semibold text-slate-500">Set {p.number}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-slate-800">
                          <span className="text-xs text-slate-500">Internal:</span> <b>{p.internal.name || "—"}</b>
                        </p>
                        <p className="text-slate-800">
                          <span className="text-xs text-slate-500">External:</span> <b>{p.external.name || "—"}</b>
                          {p.external.college && <span className="text-xs text-slate-500"> · {p.external.college}</span>}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.internal.name && (
                          <a href={link(examId, { panel: p._id, who: "internal" })} target="_blank" rel="noreferrer" className={btn.small}>
                            Internal order
                          </a>
                        )}
                        {p.external.name && (
                          <a href={link(examId, { panel: p._id, who: "external" })} target="_blank" rel="noreferrer" className={btn.small}>
                            External order
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
