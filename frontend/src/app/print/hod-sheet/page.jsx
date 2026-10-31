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

const SHORTAGE_BELOW = 75;
const th = "border border-slate-700 px-1 py-1 text-center";
const td = "border border-slate-700 px-1 py-1";

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

  if (raw === undefined) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (!sheet) return <p className="p-8 text-sm text-slate-600">Nothing to print. Open this from the Final IA or Final attendance page (PDF for student signatures).</p>;

  const ia = sheet.kind === "ia";
  const verify = sheet.copy === "verification";
  const subjects = sheet.subjects || [];
  const students = sheet.students || [];
  const dept = DEPT[String(sheet.department || "").toLowerCase()] || String(sheet.department || "").toUpperCase();
  const show = (v) => (v === "" || v === null || v === undefined ? "–" : v);

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[10px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4 portrait;margin:10mm} @media print{body{background:#fff}} thead{display:table-header-group} tr{break-inside:avoid}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">Use Print → Save as PDF for a PDF.</p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      <Letterhead compact />
      <p className="mt-2 text-center text-[13px] font-bold tracking-[0.12em]">{ia ? "FINAL INTERNAL ASSESSMENT (IA) MARKS" : "FINAL ATTENDANCE (%)"}</p>
      {verify && <p className="text-center text-[11px] font-semibold tracking-[0.2em]">VERIFICATION COPY</p>}
      <p className="mt-1 text-center text-[11.5px]">
        Department: <b>{dept || "—"}</b> &nbsp;·&nbsp; Semester: <b>{sheet.semester}</b> &nbsp;·&nbsp; Batch: <b>{sheet.batch}</b> &nbsp;·&nbsp; Academic year:{" "}
        <b>{sheet.academicYear}</b>
      </p>

      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-7`}>Sl.</th>
            <th className={`${th} w-[22mm]`}>Register No.</th>
            <th className={`${th} text-left`}>Name of the student</th>
            {subjects.map((s) => (
              <th key={s.subjectId} className={`${th} w-[12mm]`}>
                <div className="font-bold">{s.code}</div>
                {ia && <div className="text-[9px] font-normal">Max {s.iaMax ?? "–"}</div>}
              </th>
            ))}
            <th className={`${th} ${verify ? "w-[24mm]" : "w-[30mm]"}`}>{verify ? "Remarks" : "Student signature"}</th>
          </tr>
        </thead>
        <tbody>
          {students.map((st, i) => (
            <tr key={st.registerNumber || i}>
              <td className={`${td} text-center`}>{i + 1}</td>
              <td className={`${td} whitespace-nowrap tabular-nums`}>{st.registerNumber || "—"}</td>
              <td className={td}>{st.studentName}</td>
              {subjects.map((s) => {
                const v = st.values?.[s.subjectId];
                const low = !ia && v !== "" && v !== null && v !== undefined && Number(v) < SHORTAGE_BELOW;
                return (
                  <td key={s.subjectId} className={`${td} text-center tabular-nums ${low ? "font-bold" : ""}`}>
                    {show(v)}
                    {low ? "*" : ""}
                  </td>
                );
              })}
              <td className={`${td} h-8`} />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 text-[10px] text-slate-600">
        {subjects.map((s) => `${s.code} – ${s.name}`).join(" · ")}
        {!ia && <p className="mt-1">* below {SHORTAGE_BELOW}% – shortage of attendance.</p>}
      </div>

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
