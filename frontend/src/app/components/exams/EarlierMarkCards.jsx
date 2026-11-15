"use client";

// Results – earlier mark cards, from the results imported from the old
// results software (25S = Nov/Dec 2025, 26A = Apr/May 2026 …). Printed on the
// same page as the grade cards: a class, or one student by register number.

import { useEffect, useState } from "react";

import { btn } from "../ui/Modal";
import CollegeSelect from "../ui/CollegeFilter";
import { DEPARTMENTS, useApi } from "./shared";

export default function EarlierMarkCards() {
  const api = useApi();
  const [exams, setExams] = useState(null);
  const [code, setCode] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [college, setCollege] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    api("get", "/mark-cards/exams")
      .then((r) => {
        setExams(r.data.data);
        if (r.data.data[0]) setCode(r.data.data[0].code);
      })
      .catch(() => setExams([])); // not allowed / nothing on record: the box is not shown
  }, [api]);

  if (!exams || exams.length === 0) return null;

  const url = () =>
    `/print/grade-cards/old-${code}?${new URLSearchParams({
      ...(q.trim() ? { q: q.trim().toUpperCase() } : {}),
      ...(!q.trim() && department ? { department } : {}),
      ...(!q.trim() && semester ? { semester } : {}),
      ...(college ? { college } : {}),
    })}`;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-950">
        Earlier mark cards <span className="font-normal text-slate-500">· from the results of the earlier results software</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={code} onChange={(e) => setCode(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {exams.map((x) => (
            <option key={x.code} value={x.code}>
              {x.name} ({x.code}) · {x.students} students
            </option>
          ))}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="One student: register no." className="h-10 w-52 rounded-xl border border-slate-200 bg-white px-3 text-sm uppercase" />
        {!q.trim() && (
          <>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <select value={semester} onChange={(e) => setSemester(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All semesters</option>
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
            <CollegeSelect value={college} onChange={setCollege} />
          </>
        )}
        <a href={code ? url() : undefined} target="_blank" rel="noreferrer" className={`${btn.primary} ml-auto`}>
          Print mark cards
        </a>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        Marks, grades and credits as in the old software; SGPA and CGPA worked out from them (CGPA up to that exam). Students not in the website are not printed.
      </p>
    </div>
  );
}
