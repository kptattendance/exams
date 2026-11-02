"use client";

// HOD: the exam fee list as a colourful PDF (new tab, Print → Save as PDF) to
// share with the students – name, register number, subjects and the fee with
// how it is made up. Opened from the HOD's Exam fee list, which hands over the
// list it shows. &auto=1 opens the print dialog by itself.

import { Suspense, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import Letterhead from "../../components/print/Letterhead";

const FEE_STORE = "kpt-exam-fees"; // written by components/exams/HodExamFees.jsx
const noSubscribe = () => () => {};
const readRaw = () => {
  try {
    return localStorage.getItem(FEE_STORE);
  } catch {
    return null;
  }
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
const rs = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");
// colour of each semester exam chip
const CHIP = (label) =>
  label === "Bridge" ? "bg-violet-100 text-violet-900 border-violet-300" : /Sem/.test(label) && label !== "Sem ?" ? "bg-sky-100 text-sky-900 border-sky-300" : "bg-slate-100 text-slate-800 border-slate-300";

function Sheet() {
  const auto = useSearchParams().get("auto") === "1";
  const raw = useSyncExternalStore(noSubscribe, readRaw, () => undefined);
  const d = useMemo(() => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [raw]);

  useEffect(() => {
    if (!auto || !d) return;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [auto, d]);

  if (raw === undefined) return <p className="p-8 text-sm text-slate-500">Loading…</p>;
  if (!d) return <p className="p-8 text-sm text-slate-600">Nothing to print. Open this from the HOD&apos;s Exam fee list (Download PDF).</p>;

  const rules = d.rules || {};
  const slabs = rules.lateFees || [];
  const dept = DEPT[String(d.department || "").toLowerCase()] || String(d.department || "").toUpperCase();
  const total = d.rows.reduce((a, r) => a + r.fee.total, 0);

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[10.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4 portrait;margin:9mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact} thead{display:table-header-group} tr{break-inside:avoid}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">Use Print → Save as PDF for a PDF (keep “Background graphics” on for the colours).</p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      <Letterhead compact evening={d.rows.length > 0 && d.rows.every((r) => String(r.registerNumber || "").startsWith("186"))} />
      <div className="mt-2 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2 text-center text-white">
        <p className="text-[14px] font-bold tracking-wide">EXAM FEE – {d.exam?.name}</p>
        <p className="text-[11px]">
          {dept}
          {d.semester ? ` · Semester ${d.semester}` : ""} · Fee as on {day(d.on)}
        </p>
      </div>

      {/* how the fee is made up */}
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5">
          <p className="text-[9.5px] font-semibold uppercase text-sky-700">1 or 2 subjects of a semester</p>
          <p className="text-[13px] font-bold text-sky-900">{rs(rules.upTo2)}</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5">
          <p className="text-[9.5px] font-semibold uppercase text-indigo-700">3+ subjects / full semester</p>
          <p className="text-[13px] font-bold text-indigo-900">{rs(rules.threePlus)}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5">
          <p className="text-[9.5px] font-semibold uppercase text-emerald-700">Marks card (each semester exam)</p>
          <p className="text-[13px] font-bold text-emerald-900">{rs(rules.marksCard)}</p>
        </div>
      </div>
      <p className="mt-1.5 text-[9.5px] leading-4 text-slate-600">
        The fee is for each semester exam (current semester, each back-paper semester, bridge courses separately). Every registered subject is counted; the fee is not refundable.
        {slabs.length > 0 && (
          <>
            {" "}
            <b className="text-rose-700">Late fee for each semester exam:</b> {slabs.map((s) => `from ${day(s.from)} ${rs(s.amount)}`).join(" · ")}.
          </>
        )}
      </p>

      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr className="bg-indigo-700 text-white">
            <th className="border border-indigo-800 px-1.5 py-1 text-center">Sl.</th>
            <th className="border border-indigo-800 px-1.5 py-1 text-left">Student</th>
            <th className="border border-indigo-800 px-1.5 py-1 text-left">Subjects</th>
            <th className="border border-indigo-800 px-1.5 py-1 text-left">How it is made up</th>
            <th className="border border-indigo-800 px-1.5 py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={r.registerNumber} className={i % 2 ? "bg-slate-50" : "bg-white"}>
              <td className="border border-slate-300 px-1.5 py-1 text-center align-top text-slate-500">{i + 1}</td>
              <td className="border border-slate-300 px-1.5 py-1 align-top">
                <p className="font-bold">{r.name}</p>
                <p className="tabular-nums text-slate-600">{r.registerNumber}</p>
              </td>
              <td className="border border-slate-300 px-1.5 py-1 align-top leading-4">
                {r.eligible.length > 0 && <p>{r.eligible.join(", ")}</p>}
                {r.backPapers.length > 0 && (
                  <p className="text-amber-800">
                    <b>Back:</b> {r.backPapers.join(", ")}
                  </p>
                )}
                {r.bridge.length > 0 && (
                  <p className="text-violet-800">
                    <b>Bridge:</b> {r.bridge.join(", ")}
                  </p>
                )}
                {r.notPermitted.length > 0 && (
                  <p className="text-rose-700">
                    <b>Not permitted:</b> {r.notPermitted.join(", ")}
                  </p>
                )}
                {r.pending.length > 0 && <p className="text-orange-700">Awaited: {r.pending.join(", ")}</p>}
              </td>
              <td className="border border-slate-300 px-1.5 py-1 align-top">
                {r.fee.exams.length ? (
                  r.fee.exams.map((e) => (
                    <p key={e.label} className={`mb-0.5 inline-block w-full rounded border px-1.5 py-0.5 ${CHIP(e.label)}`}>
                      <b>{e.label}</b> ({e.count} sub.): {e.fee} + {e.marksCard} card{e.late ? <span className="text-rose-700"> + {e.late} late</span> : ""} = <b>{e.total}</b>
                    </p>
                  ))
                ) : (
                  <span className="text-slate-400">No subject to pay for</span>
                )}
              </td>
              <td className="border border-slate-300 px-1.5 py-1 text-right align-top">
                <span className="inline-block rounded-md bg-emerald-600 px-2 py-0.5 text-[12px] font-bold text-white">{rs(r.fee.total)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 flex justify-between text-[10px] text-slate-600">
        <span>
          {d.rows.length} students · total {rs(total)}
        </span>
        <span>Fee set by the COE as per the DTE circular.</span>
      </div>
      <div className="mt-12 flex justify-end text-[11px]">
        <p className="w-56 border-t border-slate-700 pt-1 text-center">Head of the Department</p>
      </div>
    </div>
  );
}

export default function ExamFeesPrintPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <Sheet />
    </Suspense>
  );
}
