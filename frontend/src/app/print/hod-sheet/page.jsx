"use client";

// Submitted Final IA marks / Final attendance (new tab, Print → Save as PDF).
// Opened from the HOD's Final IA / Final attendance page or the Exam Officer's
// review, which hand over the sheet they show (components/HodSheetPanel.jsx).
//   copy "students"     – a column for each student's signature
//   copy "verification" – for the officer who visits to verify the entries:
//                         remarks column, certificate and the signatures of
//                         the verifying officer, HOD, Academic Dean, Principal
// &auto=1 opens the print dialog by itself.

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import Letterhead from "../../components/print/Letterhead";
import { readSignatureSheetRaw } from "../../components/HodSheetPanel";
import { isEveningNo } from "../../components/ui/CollegeFilter";
import usePrintTitle, { deptCode, dmyOf } from "../../components/print/usePrintTitle";

const SHORTAGE_BELOW = 75;
const th = "border border-slate-700 bg-[#1D1842] px-1 py-1 text-center text-white";
const td = "border border-slate-700 px-1 py-1";
const isNum = (v) => v !== "" && v !== null && v !== undefined && !Number.isNaN(Number(v));
// attendance always with 2 decimals (82.5 -> 82.50)
const pct = (v) => (isNum(v) ? Number(v).toFixed(2) : v);
// NE: IA below the subject's minimum; shortage: attendance below 75 %
const flagOf = (ia, s, v) => {
  if (!isNum(v)) return "";
  if (ia) return s.iaMin !== null && s.iaMin !== undefined && Number(v) < Number(s.iaMin) ? "NE" : "";
  return Number(v) < SHORTAGE_BELOW ? "SHORT" : "";
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
// its own (date, address). Verification copy: the verifying officer signs at the
// foot of EVERY page (and the HOD initials it).
function pageMargins(verify) {
  const blank = '"\\00a0"';
  const font = "font-size: 8.5pt; color: #1e293b; font-family: sans-serif;";
  const left = verify ? '"Signature of the verifying officer: ______________________"' : blank;
  const right = `"${verify ? "HOD initials: ________    " : ""}Page " counter(page)`;
  return `@page {
    @top-left { content: ${blank}; } @top-center { content: ${blank}; } @top-right { content: ${blank}; }
    @bottom-left { content: ${left}; ${font} }
    @bottom-center { content: ${blank}; }
    @bottom-right { content: ${right}; ${font} }
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

  // the PDF's file name, e.g. "EC Sem 1 IA 2026-27"
  usePrintTitle(
    deptCode(sheet?.department),
    sheet?.semester ? `Sem ${sheet.semester}` : "",
    sheet ? (sheet.kind === "ia" ? "IA" : "Attendance") : "",
    sheet?.copy === "verification" ? "verification copy" : "",
    sheet?.academicYear
  );
  if (raw === undefined) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (!sheet) return <p className="p-8 text-sm text-slate-600">Nothing to print. Open this from the Final IA or Final attendance page (PDF for student signatures).</p>;

  const ia = sheet.kind === "ia";
  const verify = sheet.copy === "verification";
  const subjects = sheet.subjects || [];
  const students = sheet.students || [];
  // bridge courses (only the lateral-entry students take them) go into a table of
  // their own with only those students – otherwise "NA" fills the whole sheet.
  // Older sheets without the flag: a course that fewer than half the students take.
  const takes = (st, s) => st.values?.[s.subjectId] !== "NA";
  const isBridge = (s) => (s.bridge !== undefined ? Boolean(s.bridge) : students.filter((st) => takes(st, s)).length < students.length / 2);
  const regular = subjects.filter((s) => !isBridge(s));
  const bridge = subjects.filter(isBridge);
  const bridgeStudents = students.filter((st) => bridge.some((s) => takes(st, s)));
  const dept = DEPT[String(sheet.department || "").toLowerCase()] || String(sheet.department || "").toUpperCase();
  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[10px] text-slate-900 print:max-w-none print:p-0">
      {/* portrait; 25 mm on the left to punch and file */}
      <style>{`@page{size:A4 portrait;margin:10mm 10mm 14mm 25mm} @media print{body{background:#fff}} thead{display:table-header-group} tr{break-inside:avoid} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
      {/* The page margins are filled by us, so the browser prints no header / footer of its own
          (date, address). The verification copy: the verifying officer signs at the foot of EVERY page. */}
      <style>{pageMargins(verify)}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">Use Print → Save as PDF for a PDF.</p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      <Letterhead compact evening={students.length > 0 && students.every((st) => isEveningNo(st.registerNumber))} />
      <p className="mt-2 text-center text-[13px] font-bold tracking-[0.12em] text-[#1D1842]">{ia ? "FINAL INTERNAL ASSESSMENT (IA) MARKS" : "FINAL ATTENDANCE (%)"}</p>
      {verify && (
        <p className="mx-auto mt-1 w-fit rounded bg-[#8E0D3C] px-3 py-0.5 text-center text-[10.5px] font-semibold tracking-[0.2em] text-white">VERIFICATION COPY</p>
      )}
      <div className="mt-2 grid grid-cols-2 gap-y-0.5 text-[11.5px]">
        <p>
          Department: <b>{dept || "—"}</b>
        </p>
        <p className="text-right">
          Semester: <b>{sheet.semester}</b>
        </p>
        <p>
          Batch: <b>{sheet.batch}</b>
        </p>
        <p className="text-right">
          Academic year: <b>{sheet.academicYear}</b>
        </p>
      </div>

      <MarksTable ia={ia} verify={verify} subjects={regular} students={students} />

      {bridge.length > 0 && bridgeStudents.length > 0 && (
        <>
          <p className="mt-4 text-[11.5px] font-bold text-[#1D1842]">
            Bridge courses <span className="font-normal text-slate-600">– only the {bridgeStudents.length} students who take them</span>
          </p>
          <MarksTable ia={ia} verify={verify} subjects={bridge} students={bridgeStudents} />
        </>
      )}

      <div className="mt-2 text-[10px] text-slate-600">
        <p className="flex flex-wrap items-center gap-2">
          <span className="inline-block h-3 w-5 rounded-sm border border-red-300 bg-red-100" />
          {ia ? "NE – Not eligible: IA marks below the subject's minimum." : `Shortage of attendance: below ${SHORTAGE_BELOW}% (attendance shown to 2 decimals).`}
        </p>
      </div>

      {/* the subjects of the sheet */}
      <table className="mt-2 w-full border-collapse text-[10px] break-inside-avoid">
        <thead>
          <tr>
            <th className={`${th} w-8`}>Sl.</th>
            <th className={`${th} w-24`}>Course code</th>
            <th className={`${th} text-left`}>Course name</th>
            {ia && <th className={`${th} w-20`}>IA max / min</th>}
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.subjectId} className={i % 2 ? "bg-slate-50" : "bg-white"}>
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={`${td} text-center font-semibold`}>{s.code}</td>
              <td className={td}>
                {s.name}
                {isBridge(s) && <span className="ml-1 text-[9px] font-semibold text-violet-700">(bridge course)</span>}
              </td>
              {ia && (
                <td className={`${td} text-center tabular-nums`}>
                  {s.iaMax ?? "–"} / {s.iaMin ?? "–"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {verify ? (
        <Verification ia={ia} count={students.length} dept={dept} sheet={sheet} />
      ) : (
        <div className="mt-14 flex justify-between text-[11px] break-inside-avoid">
          <p className="w-56 border-t border-slate-700 pt-1 text-center">Class teacher / Coordinator</p>
          <p className="w-56 border-t border-slate-700 pt-1 text-center">Head of the Department</p>
        </div>
      )}
    </div>
  );
}

// One table of marks / attendance: the given courses for the given students, with
// NE / shortage in red, a count row and the signature (or remarks) column
function MarksTable({ ia, verify, subjects, students }) {
  const show = (v) => (v === "" || v === null || v === undefined ? "–" : v);
  return (
    <table className="mt-3 w-full table-fixed border-collapse">
      <thead>
        <tr>
          <th className={`${th} w-7`}>Sl.</th>
          <th className={`${th} w-[21mm]`}>Register No.</th>
          {/* a fixed, narrow name column: long names wrap, the marks get the room */}
          <th className={`${th} w-[38mm] text-left`}>Name of the student</th>
          {subjects.map((s) => (
            <th key={s.subjectId} className={th}>
              <div className="font-bold">{s.code}</div>
              {ia && (
                <div className="text-[8px] font-normal opacity-90">
                  Max {s.iaMax ?? "–"}
                  {s.iaMin !== null && s.iaMin !== undefined ? ` · Min ${s.iaMin}` : ""}
                </div>
              )}
            </th>
          ))}
          <th className={`${th} ${verify ? "w-[20mm]" : "w-[26mm]"}`}>{verify ? "Remarks" : "Student signature"}</th>
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
              const flag = flagOf(ia, s, v);
              return (
                <td key={s.subjectId} className={`${td} text-center tabular-nums ${flag ? "bg-red-100 font-bold text-red-800" : ""}`}>
                  {show(ia ? v : pct(v))}
                  {flag && <span className="block text-[7.5px] font-bold leading-none">{flag === "NE" ? "NE" : "SHORTAGE"}</span>}
                </td>
              );
            })}
            <td className={`${td} h-8`} />
          </tr>
        ))}
      </tbody>
      {/* how many NE / shortage in each course */}
      <tfoot>
        <tr className="bg-red-50 font-semibold text-red-900">
          <td className={`${td} text-right text-[9px]`} colSpan={3}>
            {ia ? "Not eligible (NE) – below the IA minimum" : `Shortage – below ${SHORTAGE_BELOW}%`}
          </td>
          {subjects.map((s) => (
            <td key={s.subjectId} className={`${td} text-center tabular-nums`}>
              {students.filter((st) => flagOf(ia, s, st.values?.[s.subjectId])).length}
            </td>
          ))}
          <td className={td} />
        </tr>
      </tfoot>
    </table>
  );
}

// Certificate and sign-off of the verification copy
function Verification({ ia, count, dept, sheet }) {
  const what = ia ? "Final Internal Assessment (IA) marks" : "Final attendance";
  const records = ia ? "IA test answer scripts, assignments and the IA register" : "attendance registers";
  const line = "mt-1 h-6 border-b border-dotted border-slate-500";
  const box = "rounded border border-slate-700 p-2";
  return (
    <div className="mt-5 text-[10.5px] leading-5 break-inside-avoid">
      <p className="font-bold">VERIFICATION CERTIFICATE</p>
      <p className="mt-1 text-justify">
        Certified that the {what} of the above <b>{count}</b> students of {dept || "the department"}, Semester {sheet.semester} (Batch {sheet.batch},
        academic year {sheet.academicYear}) have been verified with the {records}, and are found
        <span className="mx-1 inline-block w-4 border border-slate-700 align-middle" style={{ height: "10px" }} /> correct
        <span className="mx-1 ml-3 inline-block w-4 border border-slate-700 align-middle" style={{ height: "10px" }} /> correct except as noted in
        the Remarks column / below.
      </p>
      <p className="mt-1">Observations, if any:</p>
      <div className={line} />
      <div className={line} />

      <div className={`mt-3 ${box}`}>
        <p className="font-bold">Verified by</p>
        <div className="mt-1 grid grid-cols-2 gap-x-6">
          <p>
            Name: <span className="inline-block w-[60mm] border-b border-dotted border-slate-500" />
          </p>
          <p>
            Designation: <span className="inline-block w-[50mm] border-b border-dotted border-slate-500" />
          </p>
          <p className="mt-2">
            Institution: <span className="inline-block w-[55mm] border-b border-dotted border-slate-500" />
          </p>
          <p className="mt-2">
            Date of verification: <span className="inline-block w-[38mm] border-b border-dotted border-slate-500" />
          </p>
        </div>
        <p className="mt-8 text-right">Signature of the verifying officer</p>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-6 text-center">
        <p className="border-t border-slate-700 pt-1">
          Head of the Department
          <br />
          <span className="text-[9.5px] text-slate-600">{dept}</span>
        </p>
        <p className="border-t border-slate-700 pt-1">Academic Dean</p>
        <p className="border-t border-slate-700 pt-1">
          Principal
          <br />
          <span className="text-[9.5px] text-slate-600">(Seal)</span>
        </p>
      </div>
      <p className="mt-4 text-[9.5px] text-slate-500">The verifying officer and the HOD initial every page of this copy.</p>
    </div>
  );
}

export default function HodSheetPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <Sheet />
    </Suspense>
  );
}
