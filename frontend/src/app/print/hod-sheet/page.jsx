"use client";

// Final IA marks / Final attendance (new tab, Print → Save as PDF; 25 mm left
// margin to punch and file). Opened from the HOD's pages, the office's review or
// the COE's verification page, which hand over the sheet (components/HodSheetPanel.jsx).
//   copy "students"     – a column for each student's signature
//   copy "verification" – BEFORE verification: the values as frozen, for the verifier
//                         to mark on. Signed by Class In-charge, HOD, Principal / Dean
//   copy "after"        – AFTER verification: the final values, corrections in yellow
//                         and listed. Signed by the Verifier, HOD, Principal / Dean
// Below the minimum is shown by colour only. &auto=1 opens the print dialog by itself.

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import Letterhead from "../../components/print/Letterhead";
import { readSignatureSheetRaw } from "../../components/HodSheetPanel";
import { isEveningNo } from "../../components/ui/CollegeFilter";
import usePrintTitle, { deptCode } from "../../components/print/usePrintTitle";

const SHORTAGE_BELOW = 75;
const th = "border border-slate-500 bg-[#1D1842] px-1 py-1 text-center font-semibold text-white";
const td = "border border-slate-400 px-1 py-[3px]";
const isNum = (v) => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v));
// attendance always with 2 decimals (82.5 -> 82.50)
const pct = (v) => (isNum(v) ? Number(v).toFixed(2) : v);
const isLow = (ia, s, v) => {
  if (!isNum(v)) return false;
  if (ia) return s.iaMin !== null && s.iaMin !== undefined && Number(v) < Number(s.iaMin);
  return Number(v) < SHORTAGE_BELOW;
};

const DEPT = {
  at: "Automobile Engineering",
  ch: "Chemical Engineering",
  ce: "Civil Engineering",
  cs: "Computer Science and Engineering",
  ec: "Electronics and Communication Engineering",
  ee: "Electrical and Electronics Engineering",
  me: "Mechanical Engineering",
  ps: "Polymer Technology",
};

const noSubscribe = () => () => {};

// The page margins carry our own text, so the browser prints no header / footer of
// its own (date, address). Verification copies: the verifying officer signs at the
// foot of EVERY page.
function pageMargins(verifier) {
  const blank = '"\\00a0"';
  const font = "font-size: 8.5pt; color: #1e293b; font-family: sans-serif;";
  const left = verifier ? '"Signature of the verifier: ______________________"' : blank;
  return `@page {
    size: A4 portrait; margin: 10mm 15mm 14mm 25mm;
    @top-left { content: ${blank}; } @top-center { content: ${blank}; } @top-right { content: ${blank}; }
    @bottom-left { content: ${left}; ${font} }
    @bottom-center { content: ${blank}; }
    @bottom-right { content: "Page " counter(page); ${font} }
  }`;
}

function Sheet() {
  const auto = useSearchParams().get("auto") === "1";
  // undefined while the page is drawn on the server, then the stored sheet
  const raw = useSyncExternalStore(noSubscribe, readSignatureSheetRaw, () => undefined);
  const sheet = useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [raw]);

  useEffect(() => {
    if (!auto || !sheet) return;
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, [auto, sheet]);

  // the PDF's file name, e.g. "EC Sem 1 IA before verification 2026-27"
  usePrintTitle(
    deptCode(sheet?.department),
    sheet?.semester ? `Sem ${sheet.semester}` : "",
    sheet ? (sheet.kind === "ia" ? "IA" : "Attendance") : "",
    sheet?.copy === "verification" ? "before verification" : sheet?.copy === "after" ? "after verification" : "",
    sheet?.academicYear
  );
  if (raw === undefined) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (!sheet) return <p className="p-8 text-sm text-slate-600">Nothing to print. Open this from the Final IA or Final attendance page.</p>;

  const ia = sheet.kind === "ia";
  const before = sheet.copy === "verification";
  const after = sheet.copy === "after";
  const subjects = sheet.subjects || [];
  const corrections = sheet.verification?.corrections || [];
  const fixOf = new Map(corrections.map((c) => [`${c.registerNumber}|${c.subjectId}`, c]));
  // before verification: always the values as they were frozen
  const students = (sheet.students || []).map((st) => {
    if (!before) return st;
    const values = { ...st.values };
    for (const s of subjects) {
      const fix = fixOf.get(`${st.registerNumber}|${s.subjectId}`);
      if (fix) values[s.subjectId] = fix.from;
    }
    return { ...st, values };
  });

  // bridge courses (only the lateral-entry students take them) go into a table of
  // their own with only those students – otherwise "NA" fills the whole sheet.
  // Older sheets without the flag: a course that fewer than half the students take.
  const takes = (st, s) => st.values?.[s.subjectId] !== "NA";
  const isBridge = (s) => (s.bridge !== undefined ? Boolean(s.bridge) : students.filter((st) => takes(st, s)).length < students.length / 2);
  // an elective option nobody in this class took is left out of the sheet
  const printed = subjects.filter((s) => s.bridge !== false || students.some((st) => takes(st, s)));
  const regular = printed.filter((s) => !isBridge(s));
  const bridge = subjects.filter(isBridge);
  const bridgeStudents = students.filter((st) => bridge.some((s) => takes(st, s)));
  const dept = DEPT[String(sheet.department || "").toLowerCase()] || String(sheet.department || "").toUpperCase();
  const nameOf = new Map(subjects.map((s) => [String(s.subjectId), s.name]));
  const show = (v) => (ia ? v : pct(v));
  const signs = after ? ["Verifier", "Head of the Department", "Principal / Dean"] : before ? ["Class In-charge", "Head of the Department", "Principal / Dean"] : ["Class In-charge", "Head of the Department"];

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[10px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@media print{body{background:#fff}} thead{display:table-header-group} tfoot{display:table-row-group} tr{break-inside:avoid} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
      <style>{pageMargins(before || after)}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">Use Print → Save as PDF for a PDF.</p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      <Letterhead compact evening={students.length > 0 && students.every((st) => isEveningNo(st.registerNumber))} />
      <p className="mt-2 text-center text-[13px] font-bold tracking-[0.1em] text-[#1D1842]">{ia ? "FINAL INTERNAL ASSESSMENT (IA) MARKS" : "FINAL ATTENDANCE (%)"}</p>
      {before && <p className="mx-auto mt-1 w-fit rounded bg-[#8E0D3C] px-3 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-white">BEFORE VERIFICATION</p>}
      {after && <p className="mx-auto mt-1 w-fit rounded bg-emerald-700 px-3 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-white">AFTER VERIFICATION</p>}

      <div className="mt-2 grid grid-cols-2 gap-y-0.5 border-y border-slate-400 py-1 text-[11px]">
        <p>
          Department: <b>{dept || "—"}</b>
        </p>
        <p className="text-right">
          Semester: <b>{sheet.semester}</b> &nbsp;·&nbsp; Academic year: <b>{sheet.academicYear}</b>
        </p>
      </div>

      <MarksTable ia={ia} remarks={before || after} after={after} subjects={regular} students={students} fixOf={fixOf} show={show} />

      {bridge.length > 0 && bridgeStudents.length > 0 && (
        <>
          <p className="mt-4 text-[11px] font-bold text-[#1D1842]">
            Bridge courses <span className="font-normal text-slate-600">– {bridgeStudents.length} students</span>
          </p>
          <MarksTable ia={ia} remarks={before || after} after={after} subjects={bridge} students={bridgeStudents} fixOf={fixOf} show={show} />
        </>
      )}

      {/* the courses */}
      <table className="mt-3 w-full table-fixed border-collapse text-[9.5px] break-inside-avoid">
        <thead>
          <tr>
            <th className={`${th} w-8`}>Sl.</th>
            <th className={`${th} w-[23mm]`}>Course code</th>
            <th className={`${th} text-left`}>Course name</th>
            {ia && <th className={`${th} w-[18mm]`}>Max / Min</th>}
            <th className={`${th} w-[17mm]`}>Shortage</th>
          </tr>
        </thead>
        <tbody>
          {printed.map((s, i) => (
            <tr key={s.subjectId} className={i % 2 ? "bg-slate-50" : "bg-white"}>
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={`${td} text-center font-semibold`}>{s.code}</td>
              <td className={td}>
                {s.name}
                {isBridge(s) && <span className="ml-1 text-[8.5px] font-semibold text-violet-700">(bridge)</span>}
              </td>
              {ia && (
                <td className={`${td} text-center tabular-nums`}>
                  {s.iaMax ?? "–"} / {s.iaMin ?? "–"}
                </td>
              )}
              <td className={`${td} text-center font-semibold tabular-nums`}>{students.filter((st) => isLow(ia, s, st.values?.[s.subjectId])).length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* what the verification changed */}
      {after && (
        <div className="mt-3 break-inside-avoid">
          <p className="text-[11px] font-bold text-[#1D1842]">Corrections after verification ({corrections.length})</p>
          {corrections.length === 0 ? (
            <p className="mt-1 border border-slate-400 px-2 py-1 text-[9.5px]">No correction – the entries were found correct.</p>
          ) : (
            <table className="mt-1 w-full table-fixed border-collapse text-[9.5px]">
              <thead>
                <tr>
                  <th className={`${th} w-8`}>Sl.</th>
                  <th className={`${th} w-[23mm]`}>Register No.</th>
                  <th className={`${th} w-[42mm] text-left`}>Name</th>
                  <th className={`${th} text-left`}>Course</th>
                  <th className={`${th} w-[14mm]`}>Before</th>
                  <th className={`${th} w-[14mm]`}>After</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((c, i) => (
                  <tr key={`${c.registerNumber}|${c.subjectId}`} className={i % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className={`${td} text-center`}>{i + 1}</td>
                    <td className={`${td} tabular-nums`}>{c.registerNumber}</td>
                    <td className={`${td} break-words`}>{c.studentName}</td>
                    <td className={`${td} break-words`}>
                      <b>{c.code}</b> {nameOf.get(String(c.subjectId)) || ""}
                    </td>
                    <td className={`${td} text-center tabular-nums`}>{c.from === null || c.from === undefined ? "–" : show(c.from)}</td>
                    <td className={`${td} bg-yellow-200 text-center font-bold tabular-nums`}>{show(c.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* signatures */}
      <div className={`mt-16 grid gap-8 text-center text-[10.5px] font-semibold break-inside-avoid ${signs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {signs.map((x) => (
          <p key={x} className="border-t border-slate-700 pt-1">
            {x}
          </p>
        ))}
      </div>
    </div>
  );
}

// One table of marks / attendance: the given courses for the given students.
// Below the minimum: red cell. Corrected (after verification): yellow cell.
function MarksTable({ ia, remarks, after, subjects, students, fixOf, show }) {
  return (
    <table className="mt-3 w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th className={`${th} w-7`}>Sl.</th>
          <th className={`${th} w-[21mm]`}>Register No.</th>
          <th className={`${th} w-[38mm] text-left`}>Name of the student</th>
          {subjects.map((s) => (
            <th key={s.subjectId} className={`${th} text-[9px]`}>
              {s.code}
              {ia && <span className="block text-[8px] font-normal opacity-90">Max {s.iaMax ?? "–"}</span>}
            </th>
          ))}
          <th className={`${th} ${remarks ? "w-[18mm]" : "w-[26mm]"}`}>{remarks ? "Remarks" : "Student signature"}</th>
        </tr>
      </thead>
      <tbody>
        {students.map((st, i) => (
          <tr key={st.registerNumber || i} className={i % 2 ? "bg-slate-50" : "bg-white"}>
            <td className={`${td} text-center`}>{i + 1}</td>
            <td className={`${td} whitespace-nowrap text-[9px] tabular-nums`}>{st.registerNumber || "—"}</td>
            <td className={`${td} break-words text-[9px] leading-tight`}>{st.studentName}</td>
            {subjects.map((s) => {
              const v = st.values?.[s.subjectId];
              const na = v === "NA";
              const low = !na && isLow(ia, s, v);
              const fixed = after && fixOf.has(`${st.registerNumber}|${s.subjectId}`);
              const colour = fixed ? `bg-yellow-200 font-bold ${low ? "text-red-700" : ""}` : low ? "bg-red-100 font-semibold text-red-800" : na ? "text-slate-400" : "";
              return (
                <td key={s.subjectId} className={`${td} text-center tabular-nums ${colour}`}>
                  {na || v === "" || v === null || v === undefined ? "–" : show(v)}
                </td>
              );
            })}
            <td className={`${td} ${remarks ? "h-6" : "h-8"}`} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function HodSheetPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <Sheet />
    </Suspense>
  );
}
