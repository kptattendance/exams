"use client";

// Results – what is still missing before the results can be processed.
// One row per course (code + name); one column per semester of the exam with
// the departments' counts; a "Back papers" column listing the students who
// write the course as a back paper (failed / NE / absent in an earlier exam).
// Filters: department, course code or name.

import { useMemo, useState } from "react";

import { DEPARTMENTS } from "./shared";

export default function MissingMarks({ issues = [], semesters = [] }) {
  const [dept, setDept] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(""); // row whose back-paper students are shown

  const sems = useMemo(() => {
    const set = new Set(semesters.map(String));
    for (const i of issues) Object.keys(i.bySemester || {}).forEach((s) => set.add(s));
    return [...set].sort((a, b) => Number(a) - Number(b));
  }, [issues, semesters]);

  // with a department chosen, only its students are counted
  const rows = useMemo(() => {
    const D = dept.toUpperCase();
    const text = q.trim().toLowerCase();
    return issues
      .filter((i) => !text || `${i.code} ${i.name}`.toLowerCase().includes(text))
      .map((i) => {
        const bySemester = {};
        for (const [s, counts] of Object.entries(i.bySemester || {})) {
          const c = D ? (counts[D] ? { [D]: counts[D] } : {}) : counts;
          if (Object.keys(c).length) bySemester[s] = c;
        }
        const backPapers = D ? i.backPapers.filter((b) => b.department === D) : i.backPapers;
        const students = Object.values(bySemester).reduce((a, c) => a + Object.values(c).reduce((x, n) => x + n, 0), 0) + backPapers.length;
        return { ...i, bySemester, backPapers, students };
      })
      .filter((i) => i.students > 0);
  }, [issues, dept, q]);

  const total = rows.reduce((a, r) => a + r.students, 0);
  const key = (i) => `${i.code}|${i.name}|${i.note}`;

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Course code or name" className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-2.5 text-sm" />
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm">
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {rows.length} course{rows.length === 1 ? "" : "s"} · {total} entries
        </span>
      </div>

      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="w-10 px-3 py-2 text-right">Sl.</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">What is missing</th>
              <th className="px-3 py-2 text-right">Total</th>
              {sems.map((s) => (
                <th key={s} className="px-3 py-2">
                  Sem {s}
                </th>
              ))}
              <th className="px-3 py-2">Back papers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6 + sems.length} className="px-3 py-8 text-center text-slate-500">
                  Nothing missing for this selection.
                </td>
              </tr>
            )}
            {rows.map((i, n) => (
              <tr key={key(i)} className="align-top">
                <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-400">{n + 1}</td>
                <td className="whitespace-nowrap px-3 py-2 font-semibold text-slate-950">{i.code}</td>
                <td className="px-3 py-2 text-slate-700">
                  {i.name}
                  {i.semester ? <span className="block text-[11px] text-slate-400">Sem {i.semester} course</span> : null}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600">{i.note}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{i.students}</td>
                {sems.map((s) => (
                  <td key={s} className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(i.bySemester[s] || {})
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([d, c]) => (
                          <span key={d} className="whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700">
                            {d} <b className="tabular-nums text-slate-950">{c}</b>
                          </span>
                        ))}
                      {!i.bySemester[s] && <span className="text-xs text-slate-300">—</span>}
                    </div>
                  </td>
                ))}
                <td className="px-3 py-2">
                  {i.backPapers.length ? (
                    <>
                      <button onClick={() => setOpen(open === key(i) ? "" : key(i))} className="whitespace-nowrap rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
                        {i.backPapers.length} student{i.backPapers.length === 1 ? "" : "s"} {open === key(i) ? "▲" : "▼"}
                      </button>
                      {open === key(i) && (
                        <ul className="mt-1 space-y-0.5 text-[11px] text-slate-700">
                          {i.backPapers.map((b) => (
                            <li key={b.registerNumber} className="whitespace-nowrap">
                              <b className="tabular-nums">{b.registerNumber}</b> {b.name}
                              <span className="text-slate-400">
                                {" "}
                                · {b.department} {b.backPapersOnly ? "· back papers only" : `· now Sem ${b.semester}`}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        Sem columns: students writing the course in their own class. Back papers: students writing it again because they failed it, had NE or were absent in an earlier
        exam – click to see who.
      </p>
    </>
  );
}
