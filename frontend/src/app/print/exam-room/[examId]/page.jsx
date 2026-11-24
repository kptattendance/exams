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
const tdr = "border border-slate-700 px-1.5 py-0 leading-tight";
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
  const deputies = (d.officials?.deputies || []).filter((o) => o.staffId || o.name);
  const chief = d.officials?.chief || { staffId: "", name: "" };
  // "AT – Semester 1", or "AT, CE – Semester 1" for a common paper
  const courseOf = (list) => {
    const depts = [...new Set(list.map((c) => String(c.department || "").toUpperCase()).filter(Boolean))].sort();
    const sems = [...new Set(list.map((c) => c.semester).filter(Boolean))].sort((m, n) => m - n);
    return `${depts.join(", ") || "–"}${sems.length ? ` – Semester ${sems.join(", ")}` : ""}`;
  };
  const diaries = d.diaries
    .filter((x) => !only || x.room === only)
    .sort((a, b) => (order.get(a.room) ?? 999) - (order.get(b.room) ?? 999) || a.code.localeCompare(b.code) || (a.part || 1) - (b.part || 1));

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
        const parts = d.diaries.filter((y) => y.room === x.room && y.code === x.code).length;
        const students = d.candidates.filter((c) => c.code === x.code && c.room === x.room && c.ats?.startsWith(x.base)).sort((a, b) => a.registerNumber.localeCompare(b.registerNumber));
        return (
          <div key={x._id}>
            {/* ---------------- room diary (appearance tag sheet) ---------------- */}
            <section className={i ? "break-before-page pt-1" : ""}>
              <Letterhead compact />
              <div className="mt-1 text-center">
                <p className="text-[14px] font-extrabold tracking-wide">APPEARANCE TAG SHEET – DIPLOMA EXAMINATION</p>
                <p className="text-[11px] font-semibold">({d.exam.name})</p>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-y-2 border-slate-800 py-1">
                <p className="text-[17px] font-black tracking-wide">
                  ATS No: <span className="tabular-nums">{x.base}</span>
                </p>
                <p className="text-[10.5px]">
                  [ Totals: Sl. Nos = <b>{students.length}</b>
                  {parts > 1 && (
                    <>
                      {" "}
                      · ATS <b>{x.part || 1}</b> of {parts}
                    </>
                  )}{" "}
                  ]
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Confidential</p>
              </div>
              <div className="mt-1 flex items-start gap-3">
              <div className="grid flex-1 grid-cols-[auto_1fr] gap-x-3 text-[11.5px] leading-[1.45]">
                <span>Course</span>
                <b>
                  {courseOf(students)}
                </b>
                <span>Exam paper</span>
                <b>
                  {x.code} – [ {paperName.get(x.code) || ""} ]
                </b>
                <span>Exam date &amp; time</span>
                <b>
                  {day(d.date)} · {time(d.times.startsAt)} – {time(d.times.endsAt)} ({SESSION[d.session]})
                </b>
                <span>Room / Hall No.</span>
                <b className="text-[13px]">{x.room}</b>
              </div>
                <table className="w-[78mm] shrink-0 border-collapse text-[10px]">
                  <thead>
                    <tr>
                      <th className={`${th} px-1 py-0.5`}>Booklets</th>
                      <th className={`${th} px-1 py-0.5 text-center`}>Received</th>
                      <th className={`${th} px-1 py-0.5 text-center`}>Issued</th>
                      <th className={`${th} px-1 py-0.5 text-center`}>Returned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["Main", "Additional"].map((r) => (
                      <tr key={r} className="h-[6.5mm]">
                        <td className={`${tdr} font-semibold`}>{r}</td>
                        <td className={tdr} />
                        <td className={tdr} />
                        <td className={tdr} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <table className="mt-1.5 w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-100">
                    <th className={`${th} w-9 py-0.5 leading-tight`}>Sl. No.</th>
                    <th className={`${th} w-24 py-0.5`}>Reg. No.</th>
                    <th className={`${th} w-28 py-0.5`}>Full ATS No.</th>
                    <th className={`${th} py-0.5`}>Student name</th>
                    <th className={`${th} w-24 py-0.5 leading-tight`}>Main booklet No.</th>
                    <th className={`${th} w-24 py-0.5`}>Sig. of student</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, k) => (
                    <tr key={s.registerNumber} className="h-[5.5mm]">
                      <td className={`${tdr}`}>{String(k + 1).padStart(2, "0")}</td>
                      <td className={`${tdr} font-semibold`}>{s.registerNumber}</td>
                      <td className={`${tdr} text-[12.5px] font-bold tracking-wider`}>{fmt(s.ats).replace("-", " - ")}</td>
                      <td className={`${tdr} text-[10px] leading-[1.15]`}>{s.name}</td>
                      <td className={`${tdr}`} />
                      <td className={`${tdr}`} />
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-0.5 text-[9.5px] text-slate-600">
                Invigilator: write <b>“ABSENT”</b> across the row of a student who did not come. Answer scripts go into the packet whose cover shows ATS No. <b>{x.base}</b>.
              </p>

              <div className="mt-2 break-inside-avoid">
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className={`${th} w-36 py-0.5`} />
                      <th className={`${th} w-20 py-0.5`}>Staff ID</th>
                      <th className={`${th} py-0.5`}>Name &amp; designation</th>
                      <th className={`${th} w-36 py-0.5`}>Signature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Invigilator", { staffId: "", name: room?.invigilator || "" }],
                      ...(deputies.length ? deputies : [{ staffId: "", name: "" }]).map((o, k) => [k ? "" : "Deputy Chief / Observer", o]),
                      ["Chief Superintendent", chief],
                    ].map(([label, o], k) => (
                      <tr key={k} className="h-[6.8mm]">
                        <td className={`${tdr} font-semibold`}>{label}</td>
                        <td className={`${tdr} tabular-nums`}>{o.staffId}</td>
                        <td className={tdr}>{o.name}</td>
                        <td className={tdr} />
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                        <td className={`${td} w-36 font-semibold`}>Course code</td>
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
