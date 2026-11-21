"use client";

// Session report of a written-exam session, after the absentees are marked
// (Print → Save as PDF; 25 mm left margin to punch and file):
//   ?date=2026-11-16&session=FN&per=8
// 1. Consolidated report – every packet (room diary) in bundles of `per` packets:
//    paper, ATS number, room, allotted / present / absent / malpractice / booklets,
//    with bundle and session totals and the signatures
// 2. Absentees and malpractice – paper by paper, ATS and register number
// 3. Bundle covers – two to a page, to the Controller of Examinations
// The ATS numbers are shown, so only the COE office / Chief Examiner (exam day).

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { popup } from "../../../components/ui/Feedback";
import usePrintTitle, { dmyOf } from "../../../components/print/usePrintTitle";

const SESSION = { FN: "Forenoon (FN)", AN: "Afternoon (AN)" };
const th = "border border-slate-500 px-1.5 py-1 text-center text-white";
const td = "border border-slate-400 px-1.5 py-1";
// a colour per paper, so the papers stand apart
const TINTS = [
  { head: "bg-[#1D1842]", soft: "bg-indigo-50", chip: "bg-indigo-100 text-indigo-900" },
  { head: "bg-[#8E0D3C]", soft: "bg-rose-50", chip: "bg-rose-100 text-rose-900" },
  { head: "bg-teal-700", soft: "bg-teal-50", chip: "bg-teal-100 text-teal-900" },
  { head: "bg-amber-700", soft: "bg-amber-50", chip: "bg-amber-100 text-amber-900" },
  { head: "bg-violet-700", soft: "bg-violet-50", chip: "bg-violet-100 text-violet-900" },
  { head: "bg-sky-700", soft: "bg-sky-50", chip: "bg-sky-100 text-sky-900" },
  { head: "bg-emerald-700", soft: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-900" },
  { head: "bg-fuchsia-700", soft: "bg-fuchsia-50", chip: "bg-fuchsia-100 text-fuchsia-900" },
];
const fmt = (a) => (a && a.length === 8 ? `${a.slice(0, 6)}-${a.slice(6)}` : a || "");
const day = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric", weekday: "long" });

function Head({ d, title, sub }) {
  return (
    <div className="border-b-2 border-[#1D1842] pb-1.5 text-center">
      <p className="text-[12px] font-bold uppercase">Karnataka (Govt.) Polytechnic (Autonomous), Mangaluru</p>
      <p className="text-[10.5px] text-slate-600">{d.exam.name}</p>
      <p className="mt-1 text-[14px] font-black tracking-[0.12em] text-[#1D1842]">{title}</p>
      <p className="text-[11px] font-semibold">
        {day(d.date)} · {SESSION[d.session]}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}

function Report() {
  const { examId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [d, setD] = useState(null);
  const [failed, setFailed] = useState(false);
  const date = search.get("date") || "";
  const session = search.get("session") || "";
  const per = Math.max(1, Math.min(30, Number(search.get("per")) || 8));

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    api("get", `/exam-sessions/${examId}/${date}/${session}`)
      .then((r) => {
        if (!r.data.seesAts) {
          setFailed(true);
          return popup("error", "The session report shows the ATS numbers – the COE office prints it (the Chief Examiner on the exam day).");
        }
        setD(r.data);
      })
      .catch((e) => {
        setFailed(true);
        popup("error", errMsg(e, "Could not load the session."));
      });
  }, [api, examId, date, session, isLoaded, isSignedIn]);

  usePrintTitle("Session report", dmyOf(date), session);

  if (failed) return <p className="p-8 text-sm text-slate-500">Nothing to print.</p>;
  if (!d) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;

  const paperName = new Map(d.papers.map((p) => [p.code, p.name]));
  const tint = new Map(d.papers.map((p, i) => [p.code, TINTS[i % TINTS.length]]));
  // one packet per room diary, with its counts
  const packets = d.diaries
    .map((x) => {
      const list = d.candidates.filter((c) => c.code === x.code && c.ats?.startsWith(x.base));
      const n = (a) => list.filter((c) => c.attendance === a).length;
      return { ...x, list, allotted: list.length, present: n("PRESENT"), absent: n("ABSENT"), malpractice: n("MALPRACTICE") };
    })
    .filter((x) => x.allotted)
    .sort((a, b) => a.code.localeCompare(b.code) || a.base.localeCompare(b.base));
  const bundles = [];
  for (let i = 0; i < packets.length; i += per) bundles.push(packets.slice(i, i + per));
  const sum = (list, k) => list.reduce((n, x) => n + x[k], 0);
  const total = { allotted: sum(packets, "allotted"), present: sum(packets, "present"), absent: sum(packets, "absent"), malpractice: sum(packets, "malpractice") };

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[10.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4 portrait;margin:10mm 10mm 10mm 25mm} @media print{body{background:#fff}} *{-webkit-print-color-adjust:exact;print-color-adjust:exact} tr{break-inside:avoid} thead{display:table-header-group}`}</style>
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          {packets.length} packets in {bundles.length} bundle{bundles.length === 1 ? "" : "s"} · Print → Save as PDF for a PDF.
        </p>
        <label className="text-sm text-slate-700">
          Packets in a bundle{" "}
          <select
            value={per}
            onChange={(e) => router.replace(`?date=${date}&session=${session}&per=${e.target.value}`)}
            className="ml-1 h-9 rounded-lg border border-slate-300 bg-white px-2"
          >
            {[4, 5, 6, 8, 10, 12, 15, 20].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      {packets.length === 0 && <p className="text-sm text-slate-500">No room diaries in this session yet.</p>}

      {packets.length > 0 && (
        <>
          {/* ---------------- 1. consolidated report ---------------- */}
          <section>
            <Head d={d} title="CONSOLIDATED SESSION REPORT" />
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                ["Papers", new Set(packets.map((x) => x.code)).size, "bg-slate-100 text-slate-900"],
                ["Packets (ATS)", packets.length, "bg-indigo-100 text-indigo-900"],
                ["Bundles", bundles.length, "bg-violet-100 text-violet-900"],
                ["Allotted", total.allotted, "bg-slate-100 text-slate-900"],
                ["Present", total.present, "bg-emerald-100 text-emerald-900"],
                ["Absent", total.absent, "bg-red-100 text-red-800"],
                ["Malpractice", total.malpractice, "bg-orange-100 text-orange-900"],
                ["Answer booklets", total.present + total.malpractice, "bg-sky-100 text-sky-900"],
              ].map(([label, n, c]) => (
                <div key={label} className={`rounded-lg px-2 py-1.5 ${c}`}>
                  <p className="text-[9px] font-semibold uppercase tracking-wide">{label}</p>
                  <p className="text-[18px] font-black leading-tight tabular-nums">{n}</p>
                </div>
              ))}
            </div>

            {bundles.map((b, bi) => (
              <div key={bi} className="mt-4 break-inside-avoid">
                <p className="rounded-t-md bg-[#1D1842] px-2 py-1 text-[11.5px] font-bold text-white">
                  Bundle {bi + 1} of {bundles.length} <span className="font-normal opacity-80">· {b.length} packets</span>
                </p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-700">
                      <th className={`${th} w-7`}>Sl.</th>
                      <th className={`${th} w-[30mm]`}>QP code</th>
                      <th className={`${th} w-[20mm]`}>ATS No.</th>
                      <th className={`${th} text-left`}>Room</th>
                      <th className={`${th} w-[13mm]`}>Allotted</th>
                      <th className={`${th} w-[13mm]`}>Present</th>
                      <th className={`${th} w-[13mm]`}>Absent</th>
                      <th className={`${th} w-[13mm]`}>Mal-practice</th>
                      <th className={`${th} w-[14mm]`}>Booklets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.map((x, i) => (
                      <tr key={x._id} className={tint.get(x.code)?.soft}>
                        <td className={`${td} text-center`}>{bi * per + i + 1}</td>
                        <td className={td}>
                          <span className={`rounded px-1 font-bold ${tint.get(x.code)?.chip}`}>{x.code}</span>
                        </td>
                        <td className={`${td} text-center font-bold tabular-nums tracking-wider`}>{x.base}</td>
                        <td className={`${td} text-[9.5px]`}>{x.room}</td>
                        <td className={`${td} text-center tabular-nums`}>{x.allotted}</td>
                        <td className={`${td} text-center font-semibold tabular-nums text-emerald-800`}>{x.present}</td>
                        <td className={`${td} text-center tabular-nums ${x.absent ? "font-bold text-red-700" : ""}`}>{x.absent}</td>
                        <td className={`${td} text-center tabular-nums ${x.malpractice ? "font-bold text-orange-700" : ""}`}>{x.malpractice}</td>
                        <td className={`${td} text-center font-bold tabular-nums`}>{x.present + x.malpractice}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-200 font-bold">
                      <td className={`${td} text-right`} colSpan={4}>
                        Bundle {bi + 1} total
                      </td>
                      <td className={`${td} text-center tabular-nums`}>{sum(b, "allotted")}</td>
                      <td className={`${td} text-center tabular-nums`}>{sum(b, "present")}</td>
                      <td className={`${td} text-center tabular-nums`}>{sum(b, "absent")}</td>
                      <td className={`${td} text-center tabular-nums`}>{sum(b, "malpractice")}</td>
                      <td className={`${td} text-center tabular-nums`}>{sum(b, "present") + sum(b, "malpractice")}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            <table className="mt-3 w-full border-collapse break-inside-avoid">
              <tbody>
                <tr className="bg-[#1D1842] font-bold text-white">
                  <td className="border border-slate-500 px-1.5 py-1.5 text-right" style={{ width: "62%" }}>
                    SESSION TOTAL – {packets.length} packets in {bundles.length} bundles · {packets.length} head-slip covers
                  </td>
                  <td className="border border-slate-500 px-1.5 py-1.5 text-center tabular-nums">Allotted {total.allotted}</td>
                  <td className="border border-slate-500 px-1.5 py-1.5 text-center tabular-nums">Present {total.present}</td>
                  <td className="border border-slate-500 px-1.5 py-1.5 text-center tabular-nums">Absent {total.absent}</td>
                  <td className="border border-slate-500 px-1.5 py-1.5 text-center tabular-nums">MP {total.malpractice}</td>
                </tr>
              </tbody>
            </table>

            {/* signatures */}
            <table className="mt-5 w-full border-collapse text-[10.5px] break-inside-avoid">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-400 px-2 py-1 text-left">Role</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Staff ID</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Name &amp; designation</th>
                  <th className="border border-slate-400 px-2 py-1 text-left">Signature</th>
                </tr>
              </thead>
              <tbody>
                {["Deputy Chief / Observer", "Deputy Chief / Observer", "Chief Superintendent"].map((r, i) => (
                  <tr key={i} className="h-10">
                    <td className="border border-slate-400 px-2 font-semibold">{r}</td>
                    <td className="w-[25mm] border border-slate-400" />
                    <td className="border border-slate-400" />
                    <td className="w-[40mm] border border-slate-400" />
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[9.5px] text-slate-600">
              Send the answer-script bundles with this report to the Controller of Examinations, Karnataka (Govt.) Polytechnic (Autonomous), Kadri Hills,
              Mangaluru – 575 004. Malpractice (MP) booklets are sent separately.
            </p>
          </section>

          {/* ---------------- 2. absentees and malpractice ---------------- */}
          <section className="break-before-page">
            <Head d={d} title="ABSENTEES AND MALPRACTICE – PAPER-WISE" sub="for the institution's use" />
            {[...new Set(packets.map((x) => x.code))].map((code) => {
              const t = tint.get(code);
              const mine = packets.filter((x) => x.code === code);
              const rows = mine.flatMap((x) => x.list.filter((c) => c.attendance !== "PRESENT").map((c) => ({ ...c, room: x.room })));
              rows.sort((a, b) => a.ats.localeCompare(b.ats));
              const ab = rows.filter((c) => c.attendance === "ABSENT").length;
              const mp = rows.filter((c) => c.attendance === "MALPRACTICE").length;
              return (
                <div key={code} className="mt-3 break-inside-avoid">
                  <p className={`flex flex-wrap items-center gap-2 rounded-t-md px-2 py-1 text-[11px] font-bold text-white ${t?.head}`}>
                    <span>
                      {code} – {paperName.get(code) || ""}
                    </span>
                    <span className="ml-auto font-normal">
                      {mine.length} packet{mine.length === 1 ? "" : "s"} · Absent {ab} · Malpractice {mp}
                    </span>
                  </p>
                  {rows.length === 0 ? (
                    <p className={`border border-t-0 border-slate-300 px-2 py-1.5 text-[10px] font-semibold text-emerald-800 ${t?.soft}`}>Nil – every candidate present.</p>
                  ) : (
                    <table className="w-full border-collapse">
                      <tbody>
                        {rows.map((c, i) => (
                          <tr key={c.registerNumber} className={i % 2 ? t?.soft : "bg-white"}>
                            <td className={`${td} w-7 text-center`}>{i + 1}</td>
                            <td className={`${td} w-[24mm] text-center font-bold tabular-nums tracking-wider`}>{fmt(c.ats)}</td>
                            <td className={`${td} w-[26mm] font-semibold tabular-nums`}>{c.registerNumber}</td>
                            <td className={`${td} text-[9.5px]`}>{c.name}</td>
                            <td className={`${td} w-[28mm] text-[9.5px]`}>{c.room}</td>
                            <td className={`${td} w-[24mm] text-center`}>
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold text-white ${c.attendance === "ABSENT" ? "bg-red-600" : "bg-orange-600"}`}>
                                {c.attendance === "ABSENT" ? "ABSENT" : "MALPRACTICE"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </section>

          {/* ---------------- 3. bundle covers, two to a page ---------------- */}
          <section className="break-before-page">
            {bundles.map((b, bi) => (
              <div
                key={bi}
                className={`flex h-[133mm] flex-col overflow-hidden border-dashed border-slate-500 p-4 [break-inside:avoid] ${bi % 2 ? "border-t-2" : ""}`}
              >
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase">Karnataka (Govt.) Polytechnic (Autonomous), Mangaluru</p>
                    <p className="text-[10.5px] text-slate-600">{d.exam.name}</p>
                    <p className="mt-1 text-[11.5px] font-semibold">
                      {day(d.date)} · {SESSION[d.session]}
                    </p>
                  </div>
                  <div className="rounded-lg border-[3px] border-[#1D1842] px-4 py-1 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-widest">Bundle</p>
                    <p className="text-[28px] font-black leading-tight">
                      {bi + 1} <span className="text-[14px] font-bold">of {bundles.length}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px]">
                  Packets: <b>{b.length}</b> in this bundle · <b>{packets.length}</b> in all the bundles of this session · Booklets:{" "}
                  <b>{sum(b, "present") + sum(b, "malpractice")}</b>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {b.map((x) => (
                    <span key={x._id} className={`rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${tint.get(x.code)?.chip}`}>
                      {x.code} · {x.base}
                    </span>
                  ))}
                </div>
                <div className="mt-auto rounded-lg bg-[#1D1842] px-4 py-3 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-widest opacity-80">To</p>
                  <p className="text-[17px] font-black">The Controller of Examinations</p>
                  <p className="text-[12px] font-semibold">Karnataka (Govt.) Polytechnic (Autonomous), Kadri Hills, Mangaluru – 575 004</p>
                </div>
                <p className="mt-2 text-right text-[10px]">From: Chief Superintendent · Signature ____________________</p>
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
      <Report />
    </Suspense>
  );
}
