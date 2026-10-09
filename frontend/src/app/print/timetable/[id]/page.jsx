"use client";

// Printable timetable (opens in a new tab, no menus). Use the browser's
// Print → "Save as PDF" to get a PDF.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";

const DEPTS = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"];
const t12 = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

export default function PrintTimetable() {
  const { id } = useParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [dept, setDept] = useState("");
  const [sem, setSem] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to view the timetable.");
    api("get", `/exams/${id}/timetable`)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(errMsg(e, "Could not load the timetable.")));
  }, [api, id, isLoaded, isSignedIn]);

  const days = useMemo(() => {
    if (!data) return [];
    const paper = new Map(data.papers.map((p) => [p.code, p]));
    const map = new Map();
    for (const e of data.entries) {
      const p = paper.get(e.code);
      if (!p) continue;
      if (dept && !p.departments.includes(dept)) continue;
      if (sem && !p.semesters.includes(Number(sem))) continue;
      if (!map.has(e.date)) map.set(e.date, { FN: [], AN: [] });
      map.get(e.date)[e.session].push(p);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, dept, sem]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const s = data.sessions;
  return (
    <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-slate-900 print:max-w-none print:px-0 print:py-0">
      <style>{`@page{size:A4;margin:14mm} @media print{body{background:#fff}}`}</style>

      {/* screen-only controls */}
      <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-100 p-3 print:hidden">
        <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">All departments</option>
          {DEPTS.map((d) => (
            <option key={d} value={d}>
              {d.toUpperCase()}
            </option>
          ))}
        </select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
          <option value="">All semesters</option>
          {data.exam.semesters.map((x) => (
            <option key={x} value={x}>
              Semester {x}
            </option>
          ))}
        </select>
        <button onClick={() => window.print()} className="ml-auto h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print / Save as PDF
        </button>
      </div>

      <header className="text-center">
        <p className="text-lg font-bold uppercase tracking-wide">Karnataka Government Polytechnic, Mangaluru</p>
        <p className="text-xs">(Autonomous)</p>
        <p className="mt-2 text-base font-bold">{data.exam.name}</p>
        <p className="text-sm font-semibold">
          TIME TABLE{dept ? ` – ${dept.toUpperCase()}` : ""}
          {sem ? ` – Semester ${sem}` : ""}
        </p>
        <p className="mt-1 text-xs">
          Morning: {t12(s.FN.start)} – {t12(s.FN.end)} &nbsp;|&nbsp; Afternoon: {t12(s.AN.start)} – {t12(s.AN.end)}
        </p>
        {!data.published && (
          <p className="mt-2 inline-block border-2 border-red-600 px-3 py-0.5 text-sm font-bold tracking-widest text-red-600">DRAFT</p>
        )}
      </header>

      <table className="mt-5 w-full border-collapse text-[12px] leading-snug">
        <thead>
          <tr>
            <th className="w-28 border border-slate-800 px-2 py-1.5 text-left">Date</th>
            <th className="border border-slate-800 px-2 py-1.5 text-left">Morning</th>
            <th className="border border-slate-800 px-2 py-1.5 text-left">Afternoon</th>
          </tr>
        </thead>
        <tbody>
          {days.map(([date, slot]) => (
            <tr key={date} className="break-inside-avoid align-top">
              <td className="border border-slate-800 px-2 py-1.5 font-semibold">
                {new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
                <span className="block font-normal">{new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" })}</span>
              </td>
              {["FN", "AN"].map((k) => (
                <td key={k} className="border border-slate-800 px-2 py-1.5">
                  {slot[k].map((p) => (
                    <p key={p.code} className="py-0.5">
                      <b>{p.code}</b> – {p.name}
                      <span className="text-slate-600">
                        {" "}
                        ({p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "back paper"}
                        {p.semesters.length ? ` · Sem ${p.semesters.join("/")}` : ""})
                      </span>
                    </p>
                  ))}
                  {slot[k].length === 0 && <span className="text-slate-400">—</span>}
                </td>
              ))}
            </tr>
          ))}
          {days.length === 0 && (
            <tr>
              <td colSpan={3} className="border border-slate-800 px-2 py-6 text-center text-slate-500">
                No papers scheduled{dept || sem ? " for this selection" : ""}.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="mt-4 text-[11px]">
        Back-paper candidates write their papers on the dates shown above. Students must carry the hall ticket to every exam.
      </p>
      <div className="mt-14 flex justify-between text-xs font-semibold">
        <span>Date: ____________</span>
        <span>Controller of Examinations</span>
      </div>
    </div>
  );
}
