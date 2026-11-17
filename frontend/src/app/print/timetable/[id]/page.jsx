"use client";

// Printable timetable (opens in a new tab, no menus). Use the browser's
// Print → "Save as PDF" to get a PDF.

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";

const DEPTS = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"];
// "09:00" -> "09.00" (as on the board's time table: 09.00-12.00 Hrs)
const dot = (t) => String(t || "").replace(":", ".");
// the board is in the course code: 25SC21I -> SC, 25EE330P -> EE
const boardOf = (code) => String(code || "").slice(2, 4).toUpperCase();
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

  // one row per course, in date order (morning before afternoon), then by code
  const rows = useMemo(() => {
    if (!data) return [];
    const paper = new Map(data.papers.map((p) => [p.code, p]));
    const out = [];
    for (const e of data.entries) {
      const p = paper.get(e.code);
      if (!p) continue;
      if (dept && !p.departments.includes(dept)) continue;
      if (sem && !p.semesters.includes(Number(sem))) continue;
      out.push({ ...p, date: e.date, session: e.session, drawing: Boolean(e.drawing) });
    }
    const rank = { FN: 0, AN: 1 };
    return out.sort((a, b) => a.date.localeCompare(b.date) || rank[a.session] - rank[b.session] || a.code.localeCompare(b.code, undefined, { numeric: true }));
  }, [data, dept, sem]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const s = data.sessions;
  // drawing papers get one hour more (morning ends later, afternoon starts earlier)
  const addH = (hhmm, h) => {
    const [a, b] = hhmm.split(":").map(Number);
    return `${String(a + h).padStart(2, "0")}:${String(b).padStart(2, "0")}`;
  };
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

      {/* the board's format: Sl No | Course Code | Sem | Course Name | Board | Allied Program | Date | Time | Session */}
      <table className="mt-5 w-full border-collapse text-[11px] leading-snug">
        <thead>
          <tr className="bg-[#c6d9f1] align-middle">
            {["Sl No", "Course Code", "Sem", "Course Name", "Board", "Allied Program", "Exam Date", "Exam Time", "Session"].map((h) => (
              <th key={h} className="border border-slate-800 px-1.5 py-1 text-center font-bold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const [from, to] =
              p.session === "AN"
                ? [p.drawing ? addH(s.AN.start, -1) : s.AN.start, s.AN.end]
                : [s.FN.start, p.drawing ? addH(s.FN.end, 1) : s.FN.end];
            return (
              <tr key={p.code} className="break-inside-avoid align-middle">
                <td className="border border-slate-800 px-1.5 py-1 text-center">{i + 1}</td>
                <td className="whitespace-nowrap border border-slate-800 px-1.5 py-1">{p.code}</td>
                <td className="border border-slate-800 px-1.5 py-1 text-center">{p.semesters.join(", ") || "–"}</td>
                <td className="border border-slate-800 px-1.5 py-1">
                  {p.name}
                  {p.drawing && <span className="font-semibold"> (Drawing)</span>}
                </td>
                <td className="border border-slate-800 px-1.5 py-1 text-center">{boardOf(p.code)}</td>
                <td className={`border border-slate-800 px-1.5 py-1 ${p.departments.length > 3 ? "text-left" : "text-center"}`}>
                  {p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "Back paper"}
                </td>
                <td className="whitespace-nowrap border border-slate-800 px-1.5 py-1 text-center">
                  {new Date(`${p.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}
                </td>
                <td className="whitespace-nowrap border border-slate-800 px-1.5 py-1 text-center">
                  {dot(from)}-{dot(to)} Hrs
                </td>
                <td className="border border-slate-800 px-1.5 py-1 text-center">{p.session}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="border border-slate-800 px-2 py-6 text-center text-slate-500">
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
