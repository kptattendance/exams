"use client";

// Printable hall tickets, two per portrait A4 page (each exactly half a page). Opened in a new tab from
// "Hall tickets". Use Print → "Save as PDF" for a PDF.
// Only students whose hall ticket is ready are printed.

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, programmeName, useApi } from "../../../components/exams/shared";
import Letterhead from "../../../components/print/Letterhead";

const fmtDate = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const weekday = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }) : "");

function PrintHallTickets() {
  const { id } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print hall tickets.");
    const params = Object.fromEntries(search.entries());
    api("get", `/exams/${id}/hall-tickets`, undefined, { params: { ...params, state: "READY", limit: 400, print: "1" } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e, "Could not load hall tickets.")));
  }, [api, id, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const tickets = data.data;
  return (
    <div className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none">
      <style>{`
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print { body { background: #fff; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Two tickets per portrait A4: (297 - 16mm margins) / 2 = 140mm each */
        .ticket { height: 140mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
        .ticket:nth-child(2n) { break-after: page; page-break-after: always; }
        /* Long subject lists shrink so the ticket still fits its half page */
        .ticket.dense .subj td, .ticket.dense .subj th { padding-top: 1px; padding-bottom: 1px; font-size: 9.5px; }
      `}</style>

      <div className="flex items-center gap-3 border-b border-slate-200 p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{tickets.length}</b> hall ticket{tickets.length === 1 ? "" : "s"} · two per A4 page
          {data.total > tickets.length && ` (first ${tickets.length} of ${data.total})`}
        </p>
        <button
          onClick={() => window.print()}
          disabled={!tickets.length}
          className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Print / Save as PDF
        </button>
      </div>

      {tickets.length === 0 && (
        <p className="p-8 text-center text-sm text-slate-500">No hall ticket is ready for this selection.</p>
      )}

      <div>
        {tickets.map((t) => (
          <Ticket key={t._id} t={t} exam={data.exam} />
        ))}
      </div>
    </div>
  );
}

function Ticket({ t, exam }) {
  const dense = t.subjects.length > 8;
  return (
    <section
      className={`ticket ${dense ? "dense" : ""} flex flex-col border-b border-dashed border-slate-300 px-4 py-3 text-[10.5px] leading-snug print:border-0 print:px-0 print:py-[2mm]`}
    >
      <div className="flex min-h-0 flex-1 flex-col border-2 border-slate-900 px-3 pb-2 pt-1.5">
        <Letterhead compact />

        {/* heading */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold">{exam.name}</p>
          <p className="bg-slate-900 px-3 py-0.5 text-[11px] font-bold tracking-[0.2em] text-white">HALL TICKET</p>
        </div>

        {/* details + photo */}
        <div className="mt-1.5 flex gap-2">
          <table className="flex-1 border-collapse">
            <tbody>
              {[
                ["Register No.", <b key="r" className="text-[12px] tracking-wide">{t.registerNumber}</b>],
                ["Name", <b key="n">{t.name}</b>],
                ["Father’s name", t.fatherName || "—"],
                ["Programme", t.backPapersOnly ? `${programmeName(t.department)} (back papers)` : programmeName(t.department)],
                [
                  "Semester / Admission",
                  `${t.backPapersOnly ? "—" : t.semester}${t.admissionLabel ? ` · ${t.admissionLabel}` : ""}`,
                ],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="w-32 border border-slate-400 px-2 py-[2px] text-slate-600">{k}</td>
                  <td className="border border-slate-400 px-2 py-[2px]">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex h-[27mm] w-[22mm] shrink-0 items-center justify-center border border-slate-400 text-center text-[8.5px] text-slate-400">
            {t.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>Affix recent photo attested by HOD</span>
            )}
          </div>
        </div>

        {/* subjects */}
        <table className="subj mt-1.5 w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="w-6 border border-slate-400 px-1.5 py-[2px]">#</th>
              <th className="w-20 border border-slate-400 px-1.5 py-[2px]">Code</th>
              <th className="border border-slate-400 px-1.5 py-[2px]">Subject</th>
              <th className="w-28 border border-slate-400 px-1.5 py-[2px]">Date</th>
              <th className="w-32 border border-slate-400 px-1.5 py-[2px]">Time</th>
              <th className="w-20 border border-slate-400 px-1.5 py-[2px]">Invigilator</th>
            </tr>
          </thead>
          <tbody>
            {t.subjects.map((s, i) => (
              <tr key={s.code} className={s.permitted ? "" : "text-slate-500"}>
                <td className="border border-slate-400 px-1.5 py-[2px]">{i + 1}</td>
                <td className={`border border-slate-400 px-1.5 py-[2px] font-semibold ${s.permitted ? "" : "line-through"}`}>{s.code}</td>
                <td className="border border-slate-400 px-1.5 py-[2px]">
                  <span className={s.permitted ? "" : "line-through"}>{s.name}</span>
                  {s.kind === "BACKLOG" && <span className="ml-1 text-[9.5px] font-semibold">(Back paper)</span>}
                  {!s.permitted && <span className="ml-1 text-[9.5px] font-bold uppercase text-red-700">{s.note}</span>}
                </td>
                {s.permitted ? (
                  s.practicalOnly ? (
                    <td colSpan={2} className="border border-slate-400 px-1.5 py-[2px] text-[10px]">
                      Practical – as per department schedule
                    </td>
                  ) : (
                    <>
                      <td className="whitespace-nowrap border border-slate-400 px-1.5 py-[2px]">
                        {fmtDate(s.date)} <span className="text-[9.5px] text-slate-500">{weekday(s.date)}</span>
                      </td>
                      <td className="whitespace-nowrap border border-slate-400 px-1.5 py-[2px] text-[10px]">{s.time}</td>
                    </>
                  )
                ) : (
                  <td colSpan={2} className="border border-slate-400 px-1.5 py-[2px] text-center">—</td>
                )}
                <td className="border border-slate-400 px-1.5 py-[2px]" />
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-1 text-[8.5px] leading-snug text-slate-600">
          Bring this hall ticket and your college ID card to every exam. Be seated 15 minutes before the start. Mobile phones and
          other electronic devices are not allowed. Subjects marked “Not permitted” may not be written.
        </p>

        {/* signatures – pushed to the bottom of the half page */}
        <div className="mt-auto grid grid-cols-4 gap-2 pt-6 text-center text-[10px] font-semibold">
          {["Student", "HOD", "Principal / Dean", "COE"].map((who) => (
            <span key={who} className="border-t border-slate-500 pt-0.5">
              {who}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintHallTickets />
    </Suspense>
  );
}
