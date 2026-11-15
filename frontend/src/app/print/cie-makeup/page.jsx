"use client";

// CIE make-up list to print / save as PDF – for the HODs to cross-verify.
// Opened from "CIE make-up" with the filters on that page:
//   ?department=&semester=&show=&q=&college=&branch= (branch: evening, the X-Department)
// One section per department (a new page each), college letterhead, a box
// for the make-up CIE (filled in when entered) and the HOD's signature.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, programmeName, useApi } from "../../components/exams/shared";
import { matchesCollege } from "../../components/ui/CollegeFilter";
import Letterhead from "../../components/print/Letterhead";

const cell = "border border-slate-400 px-1.5 py-[3px]";

function PrintMakeup() {
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const department = search.get("department") || "";
  const semester = search.get("semester") || "";
  const show = search.get("show") || "";
  const q = (search.get("q") || "").trim().toLowerCase();
  const college = search.get("college") || "";
  const branch = search.get("branch") || "";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print.");
    api("get", "/cie-makeup/sheet", undefined, {
      params: department ? { department } : {},
      ...(branch ? { headers: { "X-Department": branch } } : {}),
    })
      .then((r) => setRows(r.data.data))
      .catch((e) => setError(errMsg(e, "Could not load the list.")));
  }, [api, isLoaded, isSignedIn, department, branch]);

  const groups = useMemo(() => {
    const list = (rows || []).filter(
      (r) =>
        (!semester || String(r.subjectSemester) === semester) &&
        matchesCollege(college, r.registerNumber) &&
        (!show || (show === "DONE" ? r.passed : r.marks === null)) &&
        (!q || `${r.registerNumber} ${r.name} ${r.code} ${r.subjectName}`.toLowerCase().includes(q))
    );
    const by = new Map();
    for (const r of list) {
      const k = String(r.department || "").toLowerCase();
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(r);
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [rows, semester, college, show, q]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!rows) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;
  const total = groups.reduce((a, [, l]) => a + l.length, 0);
  const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print { body { background: #fff; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .dept { break-after: page; page-break-after: always; }
        .dept:last-child { break-after: auto; page-break-after: auto; }
        tr { break-inside: avoid; }
      `}</style>
      <div className="flex items-center gap-3 border-b border-slate-200 p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{total}</b> NE course{total === 1 ? "" : "s"} · {groups.length} department{groups.length === 1 ? "" : "s"} (each on its own page). Choose “Save as PDF” to share.
        </p>
        <button onClick={() => window.print()} disabled={!total} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
          Print / Save as PDF
        </button>
      </div>
      {total === 0 && <p className="p-8 text-center text-sm text-slate-500">No one for this selection.</p>}

      {groups.map(([dept, list]) => {
        const evening = list.every((r) => String(r.registerNumber).startsWith("186"));
        return (
          <section key={dept} className="dept p-4 text-[11px] print:p-0">
            <Letterhead compact evening={evening} />
            <p className="mt-2 text-center text-[13px] font-bold uppercase tracking-wide">CIE make-up – students with NE (KPT 5.5)</p>
            <p className="text-center text-[11.5px] font-semibold">
              {programmeName(dept)}
              {semester ? ` · Semester ${semester} courses` : ""}
            </p>
            <p className="mt-0.5 text-center text-[9.5px] text-slate-600">
              For the HOD to verify. Make-up CIE at or above the minimum: an eligible back paper in the next exam. Blank: did not write.
            </p>
            <table className="mt-2 w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  {["Sl.", "Register No.", "Name", "Course", "Sem", "CIE before", "Min.", "Make-up CIE", "Result"].map((h) => (
                    <th key={h} className={`${cell} ${["Sl.", "Sem", "CIE before", "Min.", "Make-up CIE"].includes(h) ? "text-center" : ""}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={`${r.student}|${r.subject}`}>
                    <td className={`${cell} text-center`}>{i + 1}</td>
                    <td className={`${cell} whitespace-nowrap font-semibold`}>{r.registerNumber}</td>
                    <td className={cell}>{r.name}</td>
                    <td className={cell}>
                      <b>{r.code}</b> <span className="text-slate-600">{r.subjectName}</span>
                    </td>
                    <td className={`${cell} text-center`}>{r.subjectSemester}</td>
                    <td className={`${cell} text-center tabular-nums`}>
                      {r.originalCie ?? "—"}/{r.cieMax}
                    </td>
                    <td className={`${cell} text-center tabular-nums`}>{r.cieMin}</td>
                    <td className={`${cell} w-20 text-center font-semibold tabular-nums`}>{r.marks ?? ""}</td>
                    <td className={`${cell} w-24`}>{r.marks === null ? "" : r.passed ? "Made up" : "NE"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[9.5px] text-slate-600">
              Printed on {today} · {list.length} course{list.length === 1 ? "" : "s"}. Corrections: write in the “Make-up CIE” column and return to the exam section.
            </p>
            <div className="mt-12 grid grid-cols-2 gap-16 text-center text-[11px] font-semibold">
              <span className="border-t border-slate-500 pt-0.5">{evening ? "Evening Principal" : "HOD"} – signature and date</span>
              <span className="border-t border-slate-500 pt-0.5">Exam section</span>
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintMakeup />
    </Suspense>
  );
}
