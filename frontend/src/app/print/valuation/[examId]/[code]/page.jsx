"use client";

// Valuation printouts for one paper (new tab, Print → Save as PDF):
//   ?sheet=coding            COE's confidential ATS sheet (ATS ↔ register number)
//   ?sheet=award             award lists, one packet per page: the packet number and
//                            the last 2 digits of each ATS only (as on the scripts);
//                            absent / malpractice printed AB / MP, not valued
// (The room diary is printed from the exam session.)

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../../components/exams/shared";
import { popup } from "../../../../components/ui/Feedback";
import usePrintTitle, { deptCode, dmyOf } from "../../../../components/print/usePrintTitle";

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";

function Head({ exam, title, sub }) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-bold uppercase tracking-wide">Karnataka Government Polytechnic, Mangaluru</p>
      <p className="text-[10px]">(Autonomous)</p>
      <p className="mt-1 text-[12px] font-semibold">{exam}</p>
      <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">{title}</p>
      {sub && <p className="text-[12px]">{sub}</p>}
    </div>
  );
}

function PrintValuation() {
  const { examId, code } = useParams();
  const search = useSearchParams();
  const sheet = search.get("sheet") === "coding" ? "coding" : "award";
  const round = search.get("round");
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  usePrintTitle(decodeURIComponent(String(code || "")), sheet === "coding" ? "ATS sheet (confidential)" : "Award lists");
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const c = encodeURIComponent(decodeURIComponent(code));
    const path = sheet === "coding" ? `/exams/${examId}/valuation/${c}/coding-sheet` : `/exams/${examId}/valuation/${c}/slips`;
    api("get", path, undefined, { params: sheet === "award" && round ? { round } : {} })
      .then((r) => setData(r.data.data))
      .catch((e) => {
        setFailed(true);
        popup("error", errMsg(e, "Could not load."));
      });
  }, [api, examId, code, sheet, round, isLoaded, isSignedIn]);

  if (failed) return <p className="p-8 text-sm text-slate-500">Nothing to print.</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:12mm 12mm 12mm 25mm} @media print{body{background:#fff}} .page{break-after:page;page-break-after:always} .page:last-child{break-after:auto}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          {sheet === "coding" && "Confidential – keep with the COE. "}
          Use Print → Save as PDF for a PDF.
        </p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      {sheet === "coding" && <CodingSheet d={data} />}
      {sheet === "award" && <AwardLists d={data} />}
    </div>
  );
}

function CodingSheet({ d }) {
  return (
    <div>
      <Head exam={d.exam.name} title="ATS SHEET – CONFIDENTIAL" sub={`${d.paper.code} – ${d.paper.name}`} />
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-28`}>Register No.</th>
            <th className={th}>Name</th>
            <th className={`${th} w-28`}>ATS No.</th>
            <th className={`${th} w-24`}>Room</th>
            <th className={`${th} w-20`}>Packet</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={r.registerNumber}>
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{r.registerNumber}</td>
              <td className={td}>{r.name}</td>
              <td className={`${td} font-bold tracking-wider`}>
                {r.ats || "–"}
                {r.attendance !== "PRESENT" && <span className="ml-2 text-[10px] font-semibold">{r.attendance === "ABSENT" ? "AB" : "MP"}</span>}
              </td>
              <td className={td}>{r.room}</td>
              <td className={td}>{r.packet}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-10 text-right text-[11px] font-semibold">Controller of Examinations</div>
    </div>
  );
}

function AwardLists({ d }) {
  return (
    <div>
      {d.packets.map((p) => (
        <section key={p._id} className="page pb-6">
          <Head exam={d.exam.name} title="AWARD LIST" sub={`${d.paper.code} – ${d.paper.name}`} />
          <div className="mt-3 flex items-end justify-between">
            <p className="text-[11px]">
              Valuer: <span className="inline-block min-w-[60mm] border-b border-slate-700">{p.valuer || ""}</span>
            </p>
            <div className="rounded-md border-[3px] border-slate-900 px-4 py-1 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-widest">Packet</p>
              <p className="text-[22px] font-black leading-tight tracking-wide">{p.number}</p>
            </div>
          </div>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className={`${th} w-8`}>#</th>
                <th className={`${th} w-32`}>Script No. (last 2 digits)</th>
                <th className={`${th} w-32`}>Marks (out of {d.paper.rawMax})</th>
                <th className={th}>Marks in words</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((r, i) => (
                <tr key={r.serial} className="h-[6mm]">
                  <td className={td}>{i + 1}</td>
                  <td className={`${td} text-[13px] font-bold tracking-wider`}>{r.serial}</td>
                  <td className={`${td} ${r.mark ? "text-center font-bold" : ""}`}>{r.mark}</td>
                  <td className={td}>{r.mark === "AB" ? "Absent" : r.mark === "MP" ? "Malpractice" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px]">
            Scripts to value: <b>{p.present}</b>
            {p.rows.length > p.present && ` · ${p.rows.length - p.present} absent / malpractice (printed, not valued)`}
          </p>
          <div className="mt-10 flex justify-between text-[11px] font-semibold">
            <span>Signature of valuer &amp; date</span>
            <span>Signature of scrutiniser</span>
          </div>
        </section>
      ))}
      {d.packets.length === 0 && <p className="text-sm text-slate-500">No packets yet.</p>}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintValuation />
    </Suspense>
  );
}
