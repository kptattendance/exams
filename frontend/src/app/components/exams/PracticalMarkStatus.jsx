"use client";

// HOD: track the practical marks entry of the batches his department conducts.
// Shows only whether the marks are entered or pending – never the marks
// (the server does not send them to a HOD).

import { useCallback, useEffect, useState } from "react";

import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, dept, fmtDay, sessionLabel, usePracticalExams } from "./practicalShared";

// ENTERED: submitted · PENDING: date fixed, waiting · NOT_FIXED: no date yet
const stateOf = (b) => (b.status === "SUBMITTED" ? "ENTERED" : b.date ? "PENDING" : "NOT_FIXED");
const STATES = {
  ENTERED: { label: "Marks entered", chip: "bg-emerald-100 text-emerald-800", row: "bg-emerald-50/50" },
  PENDING: { label: "Pending", chip: "bg-orange-100 text-orange-800", row: "bg-orange-50/50" },
  NOT_FIXED: { label: "Date not fixed", chip: "bg-slate-100 text-slate-600", row: "" },
};
const at = (d) => (d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");

export default function PracticalMarkStatus() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId, department } = usePracticalExams();
  const [batches, setBatches] = useState(null);
  const [show, setShow] = useState("ALL");

  const load = useCallback(async () => {
    if (!examId || !department) return;
    try {
      const r = await api("get", `/practicals/${examId}/batches`, undefined, { params: { department } });
      setBatches(r.data.data || []);
    } catch (e) {
      setBatches([]);
      toast.error(errMsg(e, "Could not load the practical batches."));
    }
  }, [api, examId, department, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = { ALL: batches?.length || 0, ENTERED: 0, PENDING: 0, NOT_FIXED: 0 };
  for (const b of batches || []) counts[stateOf(b)]++;
  const list = (batches || []).filter((b) => show === "ALL" || stateOf(b) === show);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Track practical marks</h2>
      <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
      {department && <p className="mt-1 text-sm text-slate-500">Whether the examiners have entered the marks of each batch ({dept(department)}). The marks themselves are not shown here.</p>}

      {exams && exams.length === 0 && <NoExam />}
      {examId && batches === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {batches && (
        <>
          {/* summary = filter */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["ALL", "All batches", "border-slate-200"],
              ["ENTERED", "Marks entered", "border-emerald-200"],
              ["PENDING", "Pending", "border-orange-200"],
              ["NOT_FIXED", "Date not fixed", "border-slate-200"],
            ].map(([k, label, border]) => (
              <button
                key={k}
                onClick={() => setShow(k)}
                className={`rounded-2xl border bg-white p-3 text-left ${border} ${show === k ? "ring-2 ring-slate-900" : "hover:border-slate-400"}`}
              >
                <p className="text-2xl font-bold text-slate-950">{counts[k]}</p>
                <p className="text-xs font-semibold text-slate-600">{label}</p>
              </button>
            ))}
          </div>

          {batches.length === 0 && (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              No batches yet. Make them on <a href="/hod/practical" className="font-semibold text-blue-700 underline">Practical batches &amp; time table</a>.
            </p>
          )}

          {/* phones: cards */}
          <ul className="mt-4 space-y-2 md:hidden">
            {list.map((b) => {
              const st = STATES[stateOf(b)];
              return (
                <li key={b._id} className={`rounded-2xl border border-slate-200 bg-white p-3 ${st.row}`}>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-slate-950">
                      {b.code} · Batch {b.number}
                      <span className="block truncate text-xs font-normal text-slate-600">{b.name}</span>
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>{st.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {b.date ? `${fmtDay(b.date)} · ${sessionLabel(b.session)}` : "Date not fixed"} · {b.count} students{b.lab ? ` · ${b.lab}` : ""}
                  </p>
                  <p className="text-xs text-slate-600">
                    {b.internal?.name || "–"} / {b.external?.name || "–"}
                  </p>
                  {b.status === "SUBMITTED" && <p className="text-xs text-emerald-700">Entered {at(b.submitted?.at)}</p>}
                </li>
              );
            })}
          </ul>

          {/* larger screens: table */}
          {list.length > 0 && (
            <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <tr>
                    <th className="px-3 py-2.5">Sl. No</th>
                    <th className="px-3 py-2.5">Subject / batch</th>
                    <th className="px-3 py-2.5">Date / time</th>
                    <th className="px-3 py-2.5">Lab</th>
                    <th className="px-3 py-2.5 text-right">Students</th>
                    <th className="px-3 py-2.5">Examiners</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((b, i) => {
                    const st = STATES[stateOf(b)];
                    return (
                      <tr key={b._id} className={`border-t border-slate-100 align-top ${st.row}`}>
                        <td className="px-3 py-2.5 tabular-nums text-slate-500">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-950">
                            {b.code} · Batch {b.number}
                          </p>
                          <p className="text-xs text-slate-600">{b.name}</p>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-700">
                          {b.date ? (
                            <>
                              {fmtDay(b.date)}
                              <br />
                              {sessionLabel(b.session)}
                            </>
                          ) : (
                            "Not fixed"
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-700">{b.lab || "–"}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{b.count}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-700">
                          Int: {b.internal?.name || "–"}
                          <br />
                          Ext: {b.external?.name || "–"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>{st.label}</span>
                          {b.status === "SUBMITTED" && <p className="mt-1 text-[11px] text-emerald-700">{at(b.submitted?.at)}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {batches.length > 0 && list.length === 0 && <p className="mt-4 text-center text-sm text-slate-500">No batch in this group.</p>}
        </>
      )}
    </div>
  );
}
