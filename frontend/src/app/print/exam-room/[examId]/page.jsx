"use client";

// Room diary of a written-exam session (Print → Save as PDF):
//   ?date=2026-11-16&session=FN            every room, one after another
//   &room=Room%2012                        only that room
// Students write their answer script number and sign; the invigilator writes
// "Absent" against a student who did not come.

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import Letterhead from "../../../components/print/Letterhead";

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";
const SESSION = { FN: "Morning (FN)", AN: "Afternoon (AN)" };
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" });
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

function PrintRoomDiary() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [d, setD] = useState(null);
  const [error, setError] = useState("");
  const date = search.get("date") || "";
  const session = search.get("session") || "";
  const only = search.get("room") || "";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in.");
    api("get", `/exam-sessions/${examId}/${date}/${session}`)
      .then((r) => setD(r.data))
      .catch((e) => setError(errMsg(e, "Could not load the session.")));
  }, [api, examId, date, session, isLoaded, isSignedIn]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!d) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;

  const byReg = new Map(d.candidates.map((c) => [c.registerNumber, c]));
  const paperName = new Map(d.papers.map((p) => [p.code, p.name]));
  const rooms = d.rooms.filter((r) => r.students.length && (!only || r.name === only));

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:10mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          {rooms.length} room diar{rooms.length === 1 ? "y" : "ies"} · use Print → Save as PDF for a PDF.
        </p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      {rooms.length === 0 && <p className="text-sm text-slate-500">No room is allotted yet.</p>}

      {rooms.map((r, i) => {
        const students = r.students.map((n) => byReg.get(n)).filter(Boolean);
        const codes = [...new Set(students.map((s) => s.code))].sort();
        return (
          <section key={r.name} className={i ? "break-before-page pt-2" : ""}>
            <Letterhead />
            <div className="mt-2 text-center">
              <p className="text-[12px] font-semibold">{d.exam.name}</p>
              <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">THEORY EXAMINATION – ROOM DIARY</p>
            </div>
            <table className="mt-3 w-full border-collapse">
              <tbody>
                <tr>
                  <td className={`${td} w-24 font-semibold`}>Date</td>
                  <td className={td}>{day(d.date)}</td>
                  <td className={`${td} w-20 font-semibold`}>Session</td>
                  <td className={td}>
                    {SESSION[d.session]} · {time(d.times.startsAt)} – {time(d.times.endsAt)}
                  </td>
                </tr>
                <tr>
                  <td className={`${td} font-semibold`}>Room</td>
                  <td className={`${td} text-[13px] font-bold`}>{r.name}</td>
                  <td className={`${td} font-semibold`}>Invigilator</td>
                  <td className={td}>{r.invigilator || ""}</td>
                </tr>
                <tr>
                  <td className={`${td} font-semibold`}>Papers</td>
                  <td className={td} colSpan={3}>
                    {codes.map((c) => `${c} – ${paperName.get(c) || ""} (${students.filter((s) => s.code === c).length})`).join(";  ")}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="mt-3 w-full border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className={`${th} w-8`}>#</th>
                  <th className={`${th} w-28`}>Register No.</th>
                  <th className={th}>Name</th>
                  <th className={`${th} w-20`}>Paper</th>
                  <th className={`${th} w-32`}>Answer script No.</th>
                  <th className={`${th} w-32`}>Signature of candidate</th>
                  <th className={`${th} w-20`}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, k) => (
                  <tr key={s.registerNumber} className="h-[8mm]">
                    <td className={td}>{k + 1}</td>
                    <td className={`${td} font-semibold`}>{s.registerNumber}</td>
                    <td className={td}>{s.name}</td>
                    <td className={td}>{s.code}</td>
                    <td className={td} />
                    <td className={td} />
                    <td className={td} />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] leading-6">
              Allotted: {students.length} &nbsp;·&nbsp; Present: ______ &nbsp;·&nbsp; Absent: ______
              <br />
              Invigilator: write <b>“Absent”</b> in Remarks against every candidate who did not come.
              <br />
              Absentees (register numbers): ____________________________________________________________
            </p>
            <div className="mt-12 grid grid-cols-2 gap-10 text-center text-[11px] font-semibold">
              <span className="border-t border-slate-700 pt-1">Invigilator (name &amp; signature)</span>
              <span className="border-t border-slate-700 pt-1">Chief Examiner</span>
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
      <PrintRoomDiary />
    </Suspense>
  );
}
