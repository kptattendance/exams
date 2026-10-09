"use client";

// Printable hall tickets, two per A4 page. Opened in a new tab from
// "Hall tickets". Use Print → "Save as PDF" for a PDF.
// Only students whose hall ticket is ready are printed.

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { deptLabel, errMsg, useApi } from "../../../components/exams/shared";

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
        @page { size: A4; margin: 10mm; }
        @media print { body { background: #fff; } }
        .ticket { break-inside: avoid; page-break-inside: avoid; }
        .ticket:nth-child(2n) { break-after: page; page-break-after: always; }
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
  return (
    <section className="ticket border-b-2 border-dashed border-slate-300 px-4 py-5 text-[11px] leading-snug print:px-0 print:py-[3mm]">
      <div className="border-2 border-slate-900 p-3">
        {/* heading */}
        <div className="text-center">
          <p className="text-[14px] font-bold uppercase tracking-wide">Karnataka Government Polytechnic, Mangaluru</p>
          <p className="text-[10px]">(Autonomous)</p>
          <p className="mt-1 text-[12px] font-semibold">{exam.name}</p>
          <p className="mt-1 inline-block bg-slate-900 px-3 py-0.5 text-[12px] font-bold tracking-[0.2em] text-white">HALL TICKET</p>
        </div>

        {/* details + photo */}
        <div className="mt-3 flex gap-3">
          <table className="flex-1 border-collapse">
            <tbody>
              {[
                ["Register No.", <b key="r" className="text-[13px] tracking-wide">{t.registerNumber}</b>],
                ["Name", <b key="n">{t.name}</b>],
                ["Father’s name", t.fatherName || "—"],
                ["Programme", t.backPapersOnly ? `${deptLabel(t.department)} (back papers)` : deptLabel(t.department)],
                ["Semester", t.backPapersOnly ? "—" : t.semester],
                ["Admission", t.admissionLabel],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="w-28 border border-slate-400 px-2 py-[3px] text-slate-600">{k}</td>
                  <td className="border border-slate-400 px-2 py-[3px]">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex h-[36mm] w-[28mm] shrink-0 items-center justify-center border border-slate-400 text-center text-[9px] text-slate-400">
            {t.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>Affix recent photo attested by HOD</span>
            )}
          </div>
        </div>

        {/* subjects */}
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="w-6 border border-slate-400 px-1.5 py-1">#</th>
              <th className="w-20 border border-slate-400 px-1.5 py-1">Code</th>
              <th className="border border-slate-400 px-1.5 py-1">Subject</th>
              <th className="w-28 border border-slate-400 px-1.5 py-1">Date</th>
              <th className="w-32 border border-slate-400 px-1.5 py-1">Time</th>
              <th className="w-20 border border-slate-400 px-1.5 py-1">Invigilator</th>
            </tr>
          </thead>
          <tbody>
            {t.subjects.map((s, i) => (
              <tr key={s.code} className={s.permitted ? "" : "text-slate-500"}>
                <td className="border border-slate-400 px-1.5 py-1">{i + 1}</td>
                <td className={`border border-slate-400 px-1.5 py-1 font-semibold ${s.permitted ? "" : "line-through"}`}>{s.code}</td>
                <td className="border border-slate-400 px-1.5 py-1">
                  <span className={s.permitted ? "" : "line-through"}>{s.name}</span>
                  {s.kind === "BACKLOG" && <span className="ml-1 text-[10px] font-semibold">(Back paper)</span>}
                  {!s.permitted && <span className="block text-[10px] font-bold uppercase text-red-700">{s.note}</span>}
                </td>
                {s.permitted ? (
                  s.practicalOnly ? (
                    <td colSpan={2} className="border border-slate-400 px-1.5 py-1 text-[10.5px]">
                      Practical – as per department schedule
                    </td>
                  ) : (
                    <>
                      <td className="whitespace-nowrap border border-slate-400 px-1.5 py-1">
                        {fmtDate(s.date)} <span className="text-[10px] text-slate-500">{weekday(s.date)}</span>
                      </td>
                      <td className="whitespace-nowrap border border-slate-400 px-1.5 py-1 text-[10.5px]">{s.time}</td>
                    </>
                  )
                ) : (
                  <td colSpan={2} className="border border-slate-400 px-1.5 py-1 text-center">—</td>
                )}
                <td className="border border-slate-400 px-1.5 py-1" />
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-2 text-[9.5px] leading-snug text-slate-600">
          Bring this hall ticket and your college ID card to every exam. Be seated 15 minutes before the start. Mobile phones and
          other electronic devices are not allowed. Subjects marked “Not permitted” may not be written.
        </p>

        <div className="mt-6 flex justify-between text-[10.5px] font-semibold">
          <span>Signature of candidate</span>
          <span>Principal</span>
          <span>Controller of Examinations</span>
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
