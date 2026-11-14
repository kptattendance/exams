"use client";

// Printouts of the Diploma award (opened from "Diploma award, class and ranks"):
//   ?mode=list          list of successful candidates (KPT 11.2.1 – to the AC / GB / DTE)
//   ?mode=ranks         rank list (KPT 14.9)
//   ?mode=certificates  provisional diploma certificates, one per A4 page (KPT 14.6.1)
// ?department=&startYear=&college= choose the batch; only awarded students are printed.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, programmeName, useApi } from "../../components/exams/shared";
import Letterhead from "../../components/print/Letterhead";

const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "");
const MEDAL = { 1: "Gold Medal", 2: "Silver Medal", 3: "Bronze Medal" };
const cell = "border border-slate-400 px-2 py-1";

function PrintDiploma() {
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [list, setList] = useState(null);
  const [error, setError] = useState("");
  const mode = search.get("mode") || "list";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print.");
    const params = Object.fromEntries([...search.entries()].filter(([k]) => k !== "mode"));
    api("get", "/diploma/awards", undefined, { params })
      .then((r) => setList(r.data.data))
      .catch((e) => setError(errMsg(e, "Could not load the awards.")));
  }, [api, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!list) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;
  const rows = mode === "ranks" ? list.filter((a) => a.rank).sort((a, b) => a.rank - b.rank) : list;
  const first = list[0];
  const evening = String(first?.registerNumber || "").startsWith("186");

  return (
    <div className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print { body { background: #fff; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .cert { min-height: 277mm; break-after: page; page-break-after: always; }
        .cert:last-child { break-after: auto; page-break-after: auto; }
      `}</style>
      <div className="flex items-center gap-3 border-b border-slate-200 p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{rows.length}</b> {mode === "certificates" ? "provisional certificates (one per page)" : mode === "ranks" ? "rank holders" : "successful candidates"}
        </p>
        <button onClick={() => window.print()} disabled={!rows.length} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
          Print / Save as PDF
        </button>
      </div>
      {rows.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nobody has been awarded the Diploma in this selection yet.</p>}

      {rows.length > 0 && mode !== "certificates" && (
        <div className="p-4 text-[11px] print:p-0">
          <Letterhead evening={evening} />
          <p className="mt-3 text-center text-[14px] font-bold uppercase tracking-wide">
            {mode === "ranks" ? "Rank list" : "List of successful candidates – award of Diploma"}
          </p>
          <p className="text-center text-[12px] font-semibold">
            {programmeName(first.department)} · Batch {first.batch || first.startYear}
          </p>
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                {(mode === "ranks" ? ["Rank", "Register No.", "Name", "CGPA", "Percentage", "Class", "Medal"] : ["#", "Register No.", "Name", "Credits", "CGPA", "Percentage", "Class", "Rank"]).map((h) => (
                  <th key={h} className={cell}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a._id}>
                  <td className={`${cell} text-center`}>{mode === "ranks" ? a.rank : i + 1}</td>
                  <td className={`${cell} font-semibold`}>{a.registerNumber}</td>
                  <td className={cell}>{a.name}</td>
                  {mode !== "ranks" && <td className={`${cell} text-center`}>{a.credits}</td>}
                  <td className={`${cell} text-center`}>{a.cgpa?.toFixed(2)}</td>
                  <td className={`${cell} text-center`}>{a.percentage?.toFixed(2)} %</td>
                  <td className={cell}>{a.classLabel}</td>
                  <td className={`${cell} text-center`}>{mode === "ranks" ? MEDAL[a.rank] || "Certificate" : a.rank || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[9.5px] text-slate-600">
            Approved by the Academic Council: {first.reference}. Percentage = (CGPA − 0.75) × 10 (KPT 9.5).
          </p>
          <div className="mt-16 grid grid-cols-3 gap-6 text-center text-[11px] font-semibold">
            {["Controller of Examinations", "Dean (Academic)", "Principal"].map((w) => (
              <span key={w} className="border-t border-slate-500 pt-0.5">
                {w}
              </span>
            ))}
          </div>
        </div>
      )}

      {mode === "certificates" &&
        rows.map((a) => (
          <section key={a._id} className="cert flex flex-col p-4 print:p-0">
            <div className="flex flex-1 flex-col border-[3px] border-double border-slate-900 px-8 py-6">
              <Letterhead evening={String(a.registerNumber).startsWith("186")} />
              <p className="mt-8 text-center text-[22px] font-bold tracking-[0.15em] text-[#8e0d3c]">PROVISIONAL DIPLOMA CERTIFICATE</p>
              <p className="mt-1 text-center text-[11px] text-slate-600">(Issued under KPT 14.6.1 – the Diploma Certificate follows from the DTE / BTE)</p>
              <div className="mt-10 space-y-5 text-center text-[14px] leading-relaxed">
                <p>This is to certify that</p>
                <p className="text-[20px] font-bold uppercase">{a.name}</p>
                {a.fatherName && <p>son / daughter of {a.fatherName}</p>}
                <p>
                  Register Number <b>{a.registerNumber}</b> has successfully completed the
                </p>
                <p className="text-[17px] font-bold">{programmeName(a.department)}</p>
                <p>
                  and is declared to have passed in <b>{a.classLabel}</b> with a CGPA of <b>{a.cgpa?.toFixed(2)}</b> ({a.percentage?.toFixed(2)} %)
                  {a.completedOn ? <> in the examination held in {new Date(a.completedOn).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</> : null}.
                </p>
                {a.rank && a.rank <= 3 && (
                  <p className="font-semibold">
                    Rank {a.rank} in the programme – {MEDAL[a.rank]}
                  </p>
                )}
              </div>
              <p className="mt-10 text-[11px] text-slate-600">
                Date: {fmt(a.awardedOn)} · Academic Council: {a.reference}
              </p>
              <div className="mt-auto grid grid-cols-2 gap-16 pt-20 text-center text-[12px] font-semibold">
                <span className="border-t border-slate-500 pt-0.5">Controller of Examinations</span>
                <span className="border-t border-slate-500 pt-0.5">Principal</span>
              </div>
            </div>
          </section>
        ))}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintDiploma />
    </Suspense>
  );
}
