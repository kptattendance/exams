"use client";

// Room diaries of a written-exam session (Print → Save as PDF):
//   ?date=2026-11-16&session=FN            every room, one after another
//   &room=Room%2012                        only that room
// One room diary = one paper in one room = one packet. The ATS is printed
// against each register number: the student copies it onto the answer booklet,
// writes the answer script number in the diary and signs; the invigilator
// writes "Absent" against a student who did not come.
// After each diary: the packet cover, twice on one page (answer-script envelope
// and head-slip envelope) – the 6-digit ATS number, paper and counts; no names, no
// packet number (the COE sticks the packet label over the ATS number later).

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { popup } from "../../../components/ui/Feedback";
import Letterhead from "../../../components/print/Letterhead";
import usePrintTitle, { deptCode, dmyOf } from "../../../components/print/usePrintTitle";

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";
const SESSION = { FN: "Morning (FN)", AN: "Afternoon (AN)" };
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" });
const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const fmt = (a) => (a && a.length === 8 ? `${a.slice(0, 6)}-${a.slice(6)}` : a || "");

function PrintRoomDiary() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const date = search.get("date") || "";
  const session = search.get("session") || "";
  const only = search.get("room") || "";

  usePrintTitle("Room diaries", only, dmyOf(date), session);
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    const path = `/exam-sessions/${examId}/${date}/${session}`;
    api("get", path)
      .then((r) => {
        if (!r.data.seesAts) {
          setFailed(true);
          return popup("error", "The room diaries (with the ATS numbers) can be printed by the Chief Examiner on the exam day, or by the COE office.");
        }
        setD(r.data);
        // opened for printing: the "print again" mark goes
        api("post", `${path}/printed`, { room: only }).catch(() => {});
      })
      .catch((e) => {
        setFailed(true);
        popup("error", errMsg(e, "Could not load the session."));
      });
  }, [api, examId, date, session, only, isLoaded, isSignedIn]);

  if (failed) return <p className="p-8 text-sm text-slate-500">Nothing to print.</p>;
  if (!d) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;

  const paperName = new Map(d.papers.map((p) => [p.code, p.name]));
  const roomOf = new Map(d.rooms.map((r) => [r.name, r]));
  const order = new Map(d.rooms.map((r, i) => [r.name, i])); // rooms in their own order, papers by code
  const diaries = d.diaries
    .filter((x) => !only || x.room === only)
    .sort((a, b) => (order.get(a.room) ?? 999) - (order.get(b.room) ?? 999) || a.code.localeCompare(b.code));

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:10mm 15mm 10mm 25mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          {diaries.length} room diar{diaries.length === 1 ? "y" : "ies"}, each followed by its packet cover (2 copies) · use Print → Save as PDF for a PDF.
        </p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      {diaries.length === 0 && <p className="text-sm text-slate-500">No room is allotted yet.</p>}

      {diaries.map((x, i) => {
        const room = roomOf.get(x.room);
        const students = d.candidates.filter((c) => c.code === x.code && c.room === x.room && c.ats?.startsWith(x.base)).sort((a, b) => a.registerNumber.localeCompare(b.registerNumber));
        return (
          <div key={x._id}>
            {/* ---------------- room diary ---------------- */}
            <section className={i ? "break-before-page pt-2" : ""}>
              <Letterhead />
              <div className="mt-2 text-center">
                <p className="text-[12px] font-semibold">{d.exam.name}</p>
                <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">THEORY EXAMINATION – ROOM DIARY</p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Confidential – goes to the COE in a sealed cover</p>
              </div>
              <table className="mt-3 w-full border-collapse">
                <tbody>
                  <tr>
                    <td className={`${td} w-24 font-semibold`}>Date</td>
                    <td className={td}>{day(d.date)}</td>
                    <td className={`${td} w-24 font-semibold`}>Session</td>
                    <td className={td}>
                      {SESSION[d.session]} · {time(d.times.startsAt)} – {time(d.times.endsAt)}
                    </td>
                  </tr>
                  <tr>
                    <td className={`${td} font-semibold`}>Room</td>
                    <td className={`${td} text-[13px] font-bold`}>{x.room}</td>
                    <td className={`${td} font-semibold`}>Invigilator</td>
                    <td className={td}>{room?.invigilator || ""}</td>
                  </tr>
                  {/* no packet number here – students see the diary; it is on the packet cover only */}
                  <tr>
                    <td className={`${td} font-semibold`}>Paper</td>
                    <td className={`${td} font-semibold`} colSpan={3}>
                      {x.code} – {paperName.get(x.code) || ""}
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
                    <th className={`${th} w-28`}>ATS No.</th>
                    <th className={`${th} w-28`}>Answer script No.</th>
                    <th className={`${th} w-24`}>Additional sheet No.</th>
                    <th className={`${th} w-28`}>Signature of candidate</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, k) => (
                    <tr key={s.registerNumber} className="h-[7.5mm]">
                      <td className={td}>{k + 1}</td>
                      <td className={`${td} font-semibold`}>{s.registerNumber}</td>
                      <td className={td}>{s.name}</td>
                      <td className={`${td} text-[13px] font-bold tracking-wider`}>{fmt(s.ats)}</td>
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
                Answer booklets – received: ______ &nbsp;·&nbsp; used: ______ &nbsp;·&nbsp; returned unused: ______ &nbsp;·&nbsp; additional sheets used: ______
                <br />
                Candidate: copy <b>your ATS number</b> into the ATS boxes of the answer booklet, write the answer script number here and sign.
                <br />
                Invigilator: write <b>“Absent”</b> against every candidate who did not come. Put the answer scripts in the packet whose cover shows ATS number <b>{x.base}</b>.
              </p>
              <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px] font-semibold">
                <span className="border-t border-slate-700 pt-1">Invigilator (name &amp; signature)</span>
                <span className="border-t border-slate-700 pt-1">Chief Superintendent</span>
              </div>
            </section>

            {/* ---------------- packet cover, 2 copies: ATS number, paper, counts – no packet
                 number (the COE sticks the packet label over the ATS number box later) */}
            <section className="break-before-page">
              {["Copy 1 – on the answer-script envelope", "Copy 2 – on the head-slip envelope"].map((copy, c) => (
                <div key={copy} className={`h-[132mm] overflow-hidden ${c ? "border-t-2 border-dashed border-slate-500 pt-4" : "pb-4"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-bold uppercase">Karnataka (Govt.) Polytechnic, Mangaluru</p>
                      <p className="text-[11px]">{d.exam.name}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-600">{copy}</p>
                    </div>
                    <div className="h-[30mm] w-[70mm] rounded-lg border-[3px] border-slate-900 px-4 py-2 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-widest">ATS number</p>
                      <p className="text-[34px] font-black leading-tight tracking-[0.12em]">{x.base}</p>
                      <p className="text-[8px] uppercase tracking-wide text-slate-500">COE: stick the packet label here</p>
                    </div>
                  </div>
                  <table className="mt-4 w-full border-collapse">
                    <tbody>
                      <tr>
                        <td className={`${td} w-36 font-semibold`}>Subject code</td>
                        <td className={`${td} text-[15px] font-bold`}>
                          {x.code} <span className="text-[11px] font-semibold">– {paperName.get(x.code) || ""}</span>
                        </td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold`}>Date &amp; session</td>
                        <td className={td}>
                          {day(d.date)} · {SESSION[d.session]}
                        </td>
                      </tr>
                      <tr>
                        <td className={`${td} font-semibold`}>Allotted</td>
                        <td className={`${td} font-bold`}>{students.length}</td>
                      </tr>
                      <tr className="h-[9mm]">
                        <td className={`${td} font-semibold`}>Present</td>
                        <td className={td} />
                      </tr>
                      <tr className="h-[9mm]">
                        <td className={`${td} font-semibold`}>Absent</td>
                        <td className={td} />
                      </tr>
                      <tr className="h-[9mm]">
                        <td className={`${td} font-semibold`}>Scripts enclosed</td>
                        <td className={td} />
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-10 grid grid-cols-2 gap-10 text-center text-[11px] font-semibold">
                    <span className="border-t border-slate-700 pt-1">Invigilator</span>
                    <span className="border-t border-slate-700 pt-1">Chief Superintendent</span>
                  </div>
                </div>
              ))}
            </section>
          </div>
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
