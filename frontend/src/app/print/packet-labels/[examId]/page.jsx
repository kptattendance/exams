"use client";

// Packet labels for the COE (Print → Save as PDF):
//   ?code=25CS31T0        one paper        ?date=2026-11-16&session=FN   one session
// Page 1: the matching list (ATS number -> packet number) – for the COE only.
// Then the labels, in the same order: packet number in large print, the paper and
// the number of scripts – NO ATS number. The COE sticks each label over the ATS
// number box of its envelope, so the valuer never sees the ATS number.

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { popup } from "../../../components/ui/Feedback";

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";
const SESSION = { FN: "Morning", AN: "Afternoon" };
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });

function PacketLabels() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const code = search.get("code") || "";
  const date = search.get("date") || "";
  const session = search.get("session") || "";

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api("get", `/exams/${examId}/packet-labels`, undefined, { params: { code, date, session } })
      .then((r) => setD(r.data))
      .catch((e) => {
        setFailed(true);
        popup("error", errMsg(e, "Could not load the packets."));
      });
  }, [api, examId, code, date, session, isLoaded, isSignedIn]);

  if (failed) return <p className="p-8 text-sm text-slate-500">Nothing to print.</p>;
  if (!d) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;
  const rows = d.data;

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:10mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          {rows.length} packet{rows.length === 1 ? "" : "s"} · page 1 is the COE&apos;s matching list (keep it confidential), then the labels in the same order.
        </p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      {rows.length === 0 && <p className="text-sm text-slate-500">No room diaries yet.</p>}

      {rows.length > 0 && (
        <>
          {/* ---------------- matching list (COE only) ---------------- */}
          <section>
            <p className="text-center text-[13px] font-bold uppercase">Karnataka (Govt.) Polytechnic, Mangaluru</p>
            <p className="text-center text-[11px]">{d.exam.name}</p>
            <p className="mt-1 text-center text-[13px] font-bold tracking-[0.15em]">PACKET NUMBERS – MATCHING LIST (CONFIDENTIAL)</p>
            <p className="mt-1 text-center text-[10px] text-slate-600">Stick the label of each packet number over the ATS number box of the envelope with that ATS number.</p>
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className={`${th} w-8`}>#</th>
                  <th className={`${th} w-28`}>ATS number</th>
                  <th className={`${th} w-24`}>Packet No.</th>
                  <th className={th}>Paper</th>
                  <th className={`${th} w-28`}>Date</th>
                  <th className={`${th} w-16 text-right`}>Scripts</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.number}>
                    <td className={td}>{i + 1}</td>
                    <td className={`${td} font-bold tracking-wider`}>{r.ats}</td>
                    <td className={`${td} font-bold`}>{r.number}</td>
                    <td className={td}>
                      {r.code} – {r.name}
                    </td>
                    <td className={td}>
                      {day(r.date)} {r.session}
                    </td>
                    <td className={`${td} text-right`}>{r.present ?? r.allotted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-10 text-right text-[11px] font-semibold">Controller of Examinations</div>
          </section>

          {/* ---------------- labels: 8 on a page, no ATS number ---------------- */}
          <section className="break-before-page grid grid-cols-2 gap-[6mm]">
            {rows.map((r) => (
              <div key={r.number} className="flex h-[62mm] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-500 p-3 text-center [break-inside:avoid]">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Packet</p>
                <p className="text-[40px] font-black leading-none tracking-wide">{r.number}</p>
                <p className="mt-2 text-[13px] font-bold">{r.code}</p>
                <p className="max-w-[80mm] truncate text-[10px]">{r.name}</p>
                <p className="mt-1 text-[11px]">
                  {day(r.date)} · {SESSION[r.session] || r.session} · Scripts: <b>{r.present ?? r.allotted}</b>
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PacketLabels />
    </Suspense>
  );
}
