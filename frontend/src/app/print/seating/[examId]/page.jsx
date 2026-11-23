"use client";

// Seating plan of a written-exam session (Print → Save as PDF), for the exam
// section office – no ATS numbers:
//   ?date=2026-11-16&session=FN
// 1. Notice board: every candidate in register-number order – room and seat
// 2. Door sheets: one per room, drawn like the room – 3 rows of benches (9, 7, 9);
//    bench k = desk k (left) and desk k + 25 (right), desk k + 50 in the middle when used

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { popup } from "../../../components/ui/Feedback";
import usePrintTitle, { deptCode, dmyOf } from "../../../components/print/usePrintTitle";

// 25 benches in 3 rows: 9, 7, 9 (as in services/exams/seating.js)
const benchRows = (capacity) => {
  const benches = Math.floor((Number(capacity) || 50) / 2);
  if (benches === 25) return [9, 7, 9];
  if (benches < 3) return [benches];
  const side = Math.ceil(benches / 3);
  const middle = benches - 2 * side;
  return middle > 0 ? [side, middle, side] : [Math.ceil(benches / 2), Math.floor(benches / 2)];
};

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";
const SESSION = { FN: "Morning (FN)", AN: "Afternoon (AN)" };
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" });
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Head({ d, title, sub }) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-bold uppercase">Karnataka (Govt.) Polytechnic, Mangaluru</p>
      <p className="text-[11px]">{d.exam.name}</p>
      <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">{title}</p>
      <p className="text-[11px]">
        {day(d.date)} · {SESSION[d.session]} · {time(d.times.startsAt)} – {time(d.times.endsAt)}
      </p>
      {sub && <p className="mt-1 text-[18px] font-black">{sub}</p>}
    </div>
  );
}

function Seating() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const date = search.get("date") || "";
  const session = search.get("session") || "";

  usePrintTitle("Seating plan", dmyOf(date), session);
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api("get", `/exam-sessions/${examId}/${date}/${session}`)
      .then((r) => setD(r.data))
      .catch((e) => {
        setFailed(true);
        popup("error", errMsg(e, "Could not load the session."));
      });
  }, [api, examId, date, session, isLoaded, isSignedIn]);

  if (failed) return <p className="p-8 text-sm text-slate-500">Nothing to print.</p>;
  if (!d) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;

  const seated = d.candidates.filter((c) => c.seat);
  const byReg = [...seated].sort((a, b) => a.registerNumber.localeCompare(b.registerNumber, undefined, { numeric: true }));
  const rooms = d.rooms.filter((r) => r.students.length);
  const byRegCode = new Map(d.candidates.map((c) => [c.registerNumber, c]));

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:10mm 15mm 10mm 25mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          Notice-board list ({seated.length} candidates) and {rooms.length} door sheet{rooms.length === 1 ? "" : "s"} (bench by bench) · use Print → Save as PDF for a PDF.
        </p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      {seated.length === 0 && <p className="text-sm text-slate-500">No room is allotted yet.</p>}

      {seated.length > 0 && (
        <>
          {/* ---------------- 1. notice board ---------------- */}
          <section>
            <Head d={d} title="SEATING ARRANGEMENT" />
            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className={`${th} w-8`}>#</th>
                  <th className={`${th} w-28`}>Register No.</th>
                  <th className={th}>Name</th>
                  <th className={`${th} w-24`}>Paper</th>
                  <th className={`${th} w-24`}>Room</th>
                  <th className={`${th} w-14 text-center`}>Desk</th>
                </tr>
              </thead>
              <tbody>
                {byReg.map((c, i) => (
                  <tr key={`${c.registerNumber}|${c.code}`}>
                    <td className={td}>{i + 1}</td>
                    <td className={`${td} font-semibold`}>{c.registerNumber}</td>
                    <td className={td}>{c.name}</td>
                    <td className={td}>{c.code}</td>
                    <td className={`${td} font-semibold`}>{c.room}</td>
                    <td className={`${td} bg-yellow-100 text-center text-[17px] font-black leading-none`}>{c.seat}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ---------------- 2. one sheet per room door: drawn like the room ---------------- */}
          {rooms.map((r) => {
            const half = Math.floor((r.capacity || 50) / 2);
            const rows = benchRows(r.capacity || 50);
            const at = new Map(Object.entries(r.seats || {}).map(([reg, desk]) => [Number(desk), byRegCode.get(reg)]));
            const third = [...at.keys()].some((k) => k > 2 * half);
            const desk = (c, n) =>
              c ? (
                <div className="leading-tight">
                  <span className="mr-1 inline-block min-w-[6.5mm] rounded-sm bg-[#1D1842] px-0.5 text-center text-[14px] font-black leading-[1.3] text-white">{n}</span>
                  <b className="text-[9px] tabular-nums">{c.registerNumber}</b>
                  <span className="block truncate text-[8.5px]">{c.name}</span>
                  <span className="block text-[8.5px] font-semibold text-slate-600">{c.code}</span>
                </div>
              ) : (
                <span className="text-[13px] font-bold text-slate-400">{n} –</span>
              );
            let first = 1;
            const columns = rows.map((count) => {
              const list = Array.from({ length: count }, (_, i) => first + i);
              first += count;
              return list;
            });
            return (
              <section key={r.name} className="break-before-page">
                <Head d={d} title="SEATING – ROOM" sub={`${r.name} · ${r.students.length} students`} />
                <p className="mt-1 text-center text-[10px] text-slate-600">
                  Front of the room (board) at the top. Each bench: left desk · {third ? "middle desk · " : ""}right desk.
                </p>
                <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` }}>
                  {columns.map((benches, ci) => (
                    <div key={ci}>
                      <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide">Row {ci + 1}</p>
                      {benches.map((k) => (
                        <div key={k} className={`mb-1 grid gap-0 border border-slate-700 ${third ? "grid-cols-3" : "grid-cols-2"}`}>
                          <div className="border-r border-slate-400 p-1 text-[9.5px]">{desk(at.get(k), k)}</div>
                          {third && <div className="border-r border-slate-400 p-1 text-[9.5px]">{desk(at.get(k + 2 * half), k + 2 * half)}</div>}
                          <div className="p-1 text-[9.5px]">{desk(at.get(k + half), k + half)}</div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <Seating />
    </Suspense>
  );
}
