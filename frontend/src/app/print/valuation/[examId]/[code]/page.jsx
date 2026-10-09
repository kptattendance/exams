"use client";

// Valuation printouts for one paper (new tab, Print → Save as PDF):
//   ?sheet=attendance        exam-day attendance sheet (register numbers)
//   ?sheet=coding            COE's confidential coding sheet
//   ?sheet=award&round=1     award lists, one packet per page (dummy numbers only)

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../../components/exams/shared";

const ROUND = { 1: "FIRST VALUATION", 2: "SECOND VALUATION", 3: "THIRD VALUATION" };
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
  const sheet = search.get("sheet") || "attendance";
  const round = search.get("round");
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in.");
    const c = encodeURIComponent(decodeURIComponent(code));
    const path =
      sheet === "coding" ? `/exams/${examId}/valuation/${c}/coding-sheet` : sheet === "award" ? `/exams/${examId}/valuation/${c}/slips` : `/exams/${examId}/valuation/${c}`;
    api("get", path, undefined, { params: sheet === "award" && round ? { round } : {} })
      .then((r) => setData(r.data.data))
      .catch((e) => setError(errMsg(e, "Could not load.")));
  }, [api, examId, code, sheet, round, isLoaded, isSignedIn]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:12mm} @media print{body{background:#fff}} .page{break-after:page;page-break-after:always} .page:last-child{break-after:auto}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          {sheet === "coding" && "Confidential – keep with the COE. "}
          Use Print → Save as PDF for a PDF.
        </p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>

      {sheet === "attendance" && <AttendanceSheet d={data} />}
      {sheet === "coding" && <CodingSheet d={data} />}
      {sheet === "award" && <AwardLists d={data} />}
    </div>
  );
}

function AttendanceSheet({ d }) {
  const p = d.paper;
  const date = p.date ? new Date(`${p.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "__________";
  return (
    <div>
      <Head exam={d.exam.name} title="ATTENDANCE SHEET" sub={`${p.code} – ${p.name}`} />
      <p className="mt-2 flex justify-between text-[11px]">
        <span>Date: {date}</span>
        <span>Session: {p.session === "FN" ? "Morning" : p.session === "AN" ? "Afternoon" : "______"}</span>
        <span>Room: __________</span>
      </p>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-28`}>Register No.</th>
            <th className={th}>Name</th>
            <th className={`${th} w-28`}>Answer booklet No.</th>
            <th className={`${th} w-32`}>Signature</th>
          </tr>
        </thead>
        <tbody>
          {d.candidates.map((c, i) => (
            <tr key={c._id} className="h-[8mm]">
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{c.registerNumber}</td>
              <td className={td}>
                {c.name}
                {c.kind === "BACKLOG" && <span className="ml-1 text-[9px]">(B)</span>}
              </td>
              <td className={td} />
              <td className={td} />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex justify-between text-[11px]">
        <span>Present: ______ &nbsp; Absent: ______</span>
        <span>Absentees’ register numbers: ______________________________</span>
      </div>
      <div className="mt-10 flex justify-between text-[11px] font-semibold">
        <span>Signature of invigilator</span>
        <span>Room superintendent</span>
      </div>
    </div>
  );
}

function CodingSheet({ d }) {
  return (
    <div>
      <Head exam={d.exam.name} title="CODING SHEET – CONFIDENTIAL" sub={`${d.paper.code} – ${d.paper.name}`} />
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-28`}>Register No.</th>
            <th className={th}>Name</th>
            <th className={`${th} w-24`}>Dummy No.</th>
            <th className={`${th} w-32`}>Packet</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={r.registerNumber}>
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{r.registerNumber}</td>
              <td className={td}>{r.name}</td>
              <td className={`${td} font-bold tracking-wider`}>{r.dummy || (r.attendance === "ABSENT" ? "AB" : "MP")}</td>
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
          <Head exam={d.exam.name} title={`AWARD LIST – ${ROUND[p.round]}`} sub={`${d.paper.code} – ${d.paper.name}`} />
          <div className="mt-3 flex items-end justify-between">
            <p className="text-[11px]">
              Valuer: <span className="inline-block min-w-[60mm] border-b border-slate-700">{p.valuer || ""}</span>
            </p>
            <p className="border-2 border-slate-900 px-3 py-1 text-[15px] font-bold tracking-wide">{p.number}</p>
          </div>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className={`${th} w-8`}>#</th>
                <th className={`${th} w-28`}>Dummy No.</th>
                <th className={`${th} w-32`}>Marks (out of {d.paper.rawMax})</th>
                <th className={th}>Marks in words</th>
              </tr>
            </thead>
            <tbody>
              {p.dummies.map((dm, i) => (
                <tr key={dm} className="h-[6mm]">
                  <td className={td}>{i + 1}</td>
                  <td className={`${td} font-bold tracking-wider`}>{dm}</td>
                  <td className={td} />
                  <td className={td} />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px]">Number of scripts: {p.dummies.length}</p>
          <div className="mt-10 flex justify-between text-[11px] font-semibold">
            <span>Signature of valuer &amp; date</span>
            <span>Signature of scrutiniser</span>
          </div>
        </section>
      ))}
      {d.packets.length === 0 && <p className="text-sm text-slate-500">No packets for this round.</p>}
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
