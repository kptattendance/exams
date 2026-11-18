"use client";

// Printable hall tickets, two per portrait A4 page (each exactly half a page). A hall ticket whose
// content does not fit half a page (many back papers) gets a full page of its own – measured in the
// browser, so nothing is ever cut off. Opened in a new tab from "Hall tickets". Use Print → "Save as PDF".
// Only students whose hall ticket is ready are printed.

import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, programmeName, useApi } from "../../../components/exams/shared";
import Letterhead from "../../../components/print/Letterhead";
import { useSignatures } from "../../../components/print/useSignatures";

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
  const sig = useSignatures(); // COE and Principal, private (Admin → Settings)
  const [skipPrinted, setSkipPrinted] = useState(false);
  const [full, setFull] = useState(() => new Set()); // hall tickets that need a full page

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print hall tickets.");
    const params = Object.fromEntries(search.entries());
    api("get", `/exams/${id}/hall-tickets`, undefined, { params: { ...params, state: "READY", limit: 400, print: "1" } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e, "Could not load hall tickets.")));
  }, [api, id, isLoaded, isSignedIn, search]);

  // After drawing: a half-page hall ticket whose content overflows, or leaves less than
  // about 5 mm above the signatures (printing is a little narrower than the screen),
  // is given a full page instead.
  useLayoutEffect(() => {
    if (!data) return;
    const over = [];
    document.querySelectorAll(".ticket[data-id]:not(.full) .ticket-body").forEach((el) => {
      const signs = el.lastElementChild;
      const before = signs?.previousElementSibling;
      const gap = signs && before ? signs.offsetTop - (before.offsetTop + before.offsetHeight) : 99;
      if (el.scrollHeight > el.clientHeight + 1 || gap < 20) over.push(el.closest(".ticket").dataset.id);
    });
    if (over.length) setFull((f) => new Set([...f, ...over]));
  }, [data, skipPrinted, full, sig]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const all = data.data;
  const before = all.filter((t) => t.printedAt).length; // printed earlier
  const tickets = skipPrinted ? all.filter((t) => !t.printedAt) : all;
  // sheets of paper, in the same order: two half-page hall tickets, or one full-page one
  const sheets = [];
  let pair = [];
  for (const t of tickets) {
    if (full.has(t._id)) {
      if (pair.length) sheets.push(pair);
      pair = [];
      sheets.push([t]);
    } else {
      pair.push(t);
      if (pair.length === 2) {
        sheets.push(pair);
        pair = [];
      }
    }
  }
  if (pair.length) sheets.push(pair);
  // record them as printed, then open the browser's print window
  const doPrint = async () => {
    try {
      await api("post", `/exams/${id}/hall-tickets/printed`, { ids: tickets.map((t) => t._id), printed: true });
    } catch {
      // printing is not stopped if this fails
    }
    window.print();
  };
  return (
    <div className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none">
      <style>{`
        @page { size: A4 portrait; margin: 8mm 10mm; }
        @media print { body { background: #fff; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Two tickets per portrait A4: (297 - 16mm margins) / 2 = 140mm each */
        .ticket { height: 140mm; overflow: hidden; break-inside: avoid; page-break-inside: avoid; }
        /* many back papers: the whole page (297 - 16mm margins) */
        /* many courses: as tall as its content (up to the whole page); the rest of the sheet stays blank */
        .ticket.full { height: auto; max-height: 281mm; }
        .sheet { break-after: page; page-break-after: always; }
        .sheet:last-child { break-after: auto; page-break-after: auto; }
        /* Long subject lists shrink so the ticket still fits its half page */
        .ticket.dense .subj td, .ticket.dense .subj th { padding-top: 1px; padding-bottom: 1px; font-size: 9.5px; }
      `}</style>

      <div className="flex items-center gap-3 border-b border-slate-200 p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{tickets.length}</b> hall ticket{tickets.length === 1 ? "" : "s"} · two per A4 page
          {full.size > 0 && ` (${tickets.filter((t) => full.has(t._id)).length} with many courses on a page of their own)`}
          {data.total > all.length && ` (first ${all.length} of ${data.total})`}
          {before > 0 && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
              {before} already printed before
            </span>
          )}
        </p>
        {before > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={skipPrinted} onChange={(e) => setSkipPrinted(e.target.checked)} />
            Leave out already printed
          </label>
        )}
        <button
          onClick={doPrint}
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
        {sheets.map((sheet) => (
          <div key={sheet[0]._id} className="sheet">
            {sheet.map((t) => (
              <Ticket key={t._id} t={t} exam={data.exam} sig={sig} full={full.has(t._id)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// a signature (if uploaded) above the line, with the name below the title
function Signed({ title, s }) {
  return (
    <span className="flex flex-col items-center">
      {s?.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.src} alt="" className="mb-0.5 h-[8mm] w-auto max-w-full object-contain" />
      ) : null}
      <span className="w-full border-t border-slate-500 pt-0.5">
        {title}
        {s?.name && <span className="block text-[8.5px] font-medium text-slate-700">{s.name}</span>}
      </span>
    </span>
  );
}

function Ticket({ t, exam, sig, full = false }) {
  const dense = !full && t.subjects.length > 8;
  return (
    <section
      data-id={t._id}
      className={`ticket ${full ? "full" : ""} ${dense ? "dense" : ""} flex flex-col border-b border-dashed border-slate-300 px-4 py-3 text-[10.5px] leading-snug print:border-0 print:px-0 print:py-[2mm]`}
    >
      <div className="ticket-body flex min-h-0 flex-1 flex-col border-2 border-slate-900 px-3 pb-2 pt-1.5">
        <Letterhead compact evening={String(t.registerNumber || "").startsWith("186")} />

        {/* heading */}
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="rounded border border-[#8e0d3c] bg-[#fde3e4] px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-[#8e0d3c]">
            {exam.name}
          </p>
          <p className="bg-slate-900 px-3 py-0.5 text-[11px] font-bold tracking-[0.2em] text-white">HALL TICKET</p>
        </div>

        {/* details + photo */}
        <div className="mt-1.5 flex gap-2">
          <table className="flex-1 border-collapse">
            <tbody>
              {[
                ["Register No.", <b key="r" className="text-[12px] tracking-wide">{t.registerNumber}</b>],
                ["Name", <b key="n">{t.name}</b>],
                // father and mother share one row
                ["Father’s name", t.fatherName?.trim() || "-", "Mother’s name", t.motherName?.trim() || "-"],
                ["Programme", t.backPapersOnly ? `${programmeName(t.department)} (back papers)` : programmeName(t.department)],
                [
                  "Semester / Admission",
                  `${t.backPapersOnly ? "—" : t.semester}${t.admissionLabel ? ` · ${t.admissionLabel}` : ""}`,
                ],
              ].map(([k, v, k2, v2]) => (
                <tr key={k}>
                  <td className="w-32 border border-slate-400 px-2 py-[2px] text-slate-600">{k}</td>
                  <td colSpan={k2 ? 1 : 3} className="border border-slate-400 px-2 py-[2px]">{v}</td>
                  {k2 && (
                    <>
                      <td className="w-24 whitespace-nowrap border border-slate-400 px-2 py-[2px] text-slate-600">{k2}</td>
                      <td className="border border-slate-400 px-2 py-[2px]">{v2}</td>
                    </>
                  )}
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
              {/* the semester the subject belongs to (back papers: their own semester) */}
              <th className="w-10 border border-slate-400 px-1.5 py-[2px] text-center">Sem</th>
              <th className="border border-slate-400 px-1.5 py-[2px]">Course</th>
              <th className="w-28 border border-slate-400 px-1.5 py-[2px]">Date</th>
              <th className="w-32 border border-slate-400 px-1.5 py-[2px]">Time</th>
              <th className="w-20 border border-slate-400 px-1.5 py-[2px]">Invigilator</th>
            </tr>
          </thead>
          <tbody>
            {t.subjects.map((s, i) => {
              // an audit course is printed normally ("no end exam"); struck out only when NE / ANS in it
              const auditOk = s.audit && !s.blocked;
              const struck = !s.permitted && !auditOk;
              return (
              <tr key={s.code} className={struck ? "text-slate-500" : ""}>
                <td className="border border-slate-400 px-1.5 py-[2px]">{i + 1}</td>
                <td className={`border border-slate-400 px-1.5 py-[2px] font-semibold ${struck ? "line-through" : ""}`}>{s.code}</td>
                <td className="border border-slate-400 px-1.5 py-[2px] text-center">{s.semester ?? "–"}</td>
                <td className="border border-slate-400 px-1.5 py-[2px]">
                  <span className={struck ? "line-through" : ""}>{s.name}</span>
                  {struck && <span className="ml-1 text-[9.5px] font-bold uppercase text-red-700">{s.note}</span>}
                </td>
                {auditOk ? (
                  <td colSpan={2} className="border border-slate-400 px-1.5 py-[2px] text-[10px] italic">
                    No end exam (audit course)
                  </td>
                ) : s.permitted ? (
                  s.practicalOnly ? (
                    s.practicalDate ? (
                      // the HOD has fixed his practical batch
                      <>
                        <td className="whitespace-nowrap border border-slate-400 px-1.5 py-[2px]">
                          {fmtDate(s.practicalDate)} <span className="text-[9.5px] text-slate-500">{weekday(s.practicalDate)}</span>
                        </td>
                        <td className="whitespace-nowrap border border-slate-400 px-1.5 py-[2px] text-[10px]">
                          {s.practicalTime} <span className="text-[9px] font-semibold text-slate-500">(Practical)</span>
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="border border-slate-400 px-1.5 py-[2px] text-[10px]">
                        Practical – as per department schedule
                      </td>
                    )
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
              );
            })}
          </tbody>
        </table>

        <p className="mt-1 text-[8.5px] leading-snug text-slate-600">
          Bring this hall ticket and your college ID card to every exam. Be seated 15 minutes before the start. Mobile phones and
          other electronic devices are not allowed. Courses marked “Not permitted” may not be written. Audit courses have no semester-end exam.
        </p>

        {/* signatures – pushed to the bottom of the half page */}
        <div className={`${full ? "mt-10" : "mt-auto"} grid grid-cols-4 items-end gap-2 pt-1 text-center text-[10px] font-semibold`}>
          {["Student", "HOD"].map((who) => (
            <span key={who} className="border-t border-slate-500 pt-0.5">
              {who}
            </span>
          ))}
          {/* the Principal's and the COE's signatures (private, Admin → Settings) */}
          <Signed title="Principal / Dean" s={sig?.principal} />
          {/* the COE asked for no name on the hall ticket: signature only */}
          <Signed title="COE" s={sig?.coe ? { ...sig.coe, name: "" } : null} />
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
