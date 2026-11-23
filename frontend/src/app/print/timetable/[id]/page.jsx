"use client";

// Printable timetable (opens in a new tab, no menus). Use the browser's
// Print → "Save as PDF" to get a PDF.
// Format: Sl No | Course Code | Sem | Course Name | Allied Program | Exam Date | Exam Time | Session

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import Letterhead from "../../../components/print/Letterhead";
import usePrintTitle, { deptCode, dmyOf } from "../../../components/print/usePrintTitle";

const DEPTS = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"];
// "09:00" -> "09.00" (09.00-12.00 Hrs)
const dot = (t) => String(t || "").replace(":", ".");
const t12 = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const SESSION_COLOUR = { FN: "bg-amber-400 text-amber-950", AN: "bg-indigo-600 text-white" };
// rows of one date share a tint; the next date gets the other one
const DATE_TINT = ["bg-sky-50", "bg-white"];

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
      // every branch writing the paper (back papers too)
      const branches = p.branches?.length ? p.branches : p.departments;
      if (dept && !branches.includes(dept)) continue;
      if (sem && !p.semesters.includes(Number(sem))) continue;
      out.push({ ...p, branches, date: e.date, session: e.session, drawing: Boolean(e.drawing) });
    }
    const rank = { FN: 0, AN: 1 };
    out.sort((a, b) => a.date.localeCompare(b.date) || rank[a.session] - rank[b.session] || a.code.localeCompare(b.code, undefined, { numeric: true }));
    // tint by date
    let tint = -1;
    let last = "";
    for (const r of out) {
      if (r.date !== last) {
        tint++;
        last = r.date;
        r.firstOfDate = true;
      }
      r.tint = DATE_TINT[tint % 2];
    }
    return out;
  }, [data, dept, sem]);

  usePrintTitle("Exam time table", data?.exam?.name, data?.exam?.academicYear);
  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const s = data.sessions;
  // drawing papers get one hour more (morning ends later, afternoon starts earlier)
  const addH = (hhmm, h) => {
    const [a, b] = hhmm.split(":").map(Number);
    return `${String(a + h).padStart(2, "0")}:${String(b).padStart(2, "0")}`;
  };
  const cell = "border border-slate-400 px-1.5 py-1";
  return (
    <div className="mx-auto max-w-4xl bg-white px-6 py-8 text-slate-900 print:max-w-none print:px-0 print:py-0">
      <style>{`
        @page { size: A4; margin: 10mm 15mm 10mm 25mm; } /* 25 mm left: to punch and file */
        @media print { body { background: #fff; } thead { display: table-header-group; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

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

      <Letterhead />

      {/* title */}
      <div className="mt-3 overflow-hidden rounded-lg border-2 border-[#1f4e79]">
        <div className="bg-gradient-to-r from-[#1f4e79] via-[#2e74b5] to-[#1f4e79] px-3 py-1.5 text-center text-[15px] font-extrabold tracking-[0.25em] text-white">
          EXAMINATION TIME TABLE
          {dept ? ` – ${dept.toUpperCase()}` : ""}
          {sem ? ` – SEMESTER ${sem}` : ""}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-[#fde3e4] px-3 py-1.5 text-[12px]">
          <span className="font-bold uppercase text-[#8e0d3c]">{data.exam.name}</span>
          <span className="text-slate-600">{data.exam.academicYear}</span>
          <span className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-px text-[10px] font-bold ${SESSION_COLOUR.FN}`}>FN</span>
            {t12(s.FN.start)} – {t12(s.FN.end)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`rounded px-1.5 py-px text-[10px] font-bold ${SESSION_COLOUR.AN}`}>AN</span>
            {t12(s.AN.start)} – {t12(s.AN.end)}
          </span>
        </div>
      </div>
      {!data.published && (
        <p className="mx-auto mt-2 w-fit border-2 border-red-600 px-3 py-0.5 text-sm font-bold tracking-widest text-red-600">DRAFT</p>
      )}

      <table className="mt-3 w-full border-collapse text-[11px] leading-snug">
        <thead>
          <tr className="bg-[#1f4e79] align-middle text-white">
            {["Sl No", "Course Code", "Sem", "Course Name", "Allied Program", "Exam Date", "Exam Time", "Session"].map((h) => (
              <th key={h} className="border border-[#1f4e79] px-1.5 py-1.5 text-center font-bold">
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
            const date = new Date(`${p.date}T00:00:00`);
            return (
              <tr key={p.code} className={`break-inside-avoid align-middle ${p.tint} ${p.firstOfDate && i ? "border-t-2 border-t-[#1f4e79]" : ""}`}>
                <td className={`${cell} text-center text-slate-600`}>{i + 1}</td>
                <td className={`${cell} whitespace-nowrap font-bold text-[#8e0d3c]`}>{p.code}</td>
                <td className={`${cell} text-center font-semibold`}>{p.semesters.join(", ") || "–"}</td>
                <td className={cell}>
                  {p.name}
                  {p.drawing && <span className="ml-1 rounded bg-teal-100 px-1 text-[9.5px] font-bold text-teal-800">Drawing</span>}
                </td>
                <td className={`${cell} w-[26mm] text-center text-[10.5px] font-semibold text-slate-700`}>
                  {p.branches.map((d) => d.toUpperCase()).join(", ")}
                </td>
                <td className={`${cell} whitespace-nowrap text-center`}>
                  <b>{date.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-")}</b>
                  <span className="block text-[9.5px] text-slate-500">{date.toLocaleDateString("en-IN", { weekday: "long" })}</span>
                </td>
                <td className={`${cell} whitespace-nowrap text-center`}>
                  {dot(from)}-{dot(to)} Hrs
                </td>
                <td className={`${cell} text-center`}>
                  <span className={`rounded px-1.5 py-px text-[10px] font-bold ${SESSION_COLOUR[p.session] || ""}`}>{p.session}</span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className={`${cell} py-6 text-center text-slate-500`}>
                No papers scheduled{dept || sem ? " for this selection" : ""}.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-4 rounded-r-lg border-l-4 border-[#2e74b5] bg-sky-50 px-3 py-2 text-[11px] text-slate-700">
        Back-paper candidates write their papers on the dates shown above. Students must carry the hall ticket and college ID card to
        every exam and be seated 15 minutes before the start.
      </div>
      <div className="mt-14 flex justify-between text-xs font-semibold">
        <span>Date: ____________</span>
        <span className="text-[#1f4e79]">Controller of Examinations</span>
      </div>
    </div>
  );
}
