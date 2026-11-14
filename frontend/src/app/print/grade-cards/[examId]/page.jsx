"use client";

// Printable grade cards (KPT 9.7), one per A4 page, after the results of an
// exam are published. Opened in a new tab from Results; Print → "Save as PDF"
// for a PDF. ?department=&semester=&college=&q= choose the students.
//
// On the card: every course written in this exam with its credits, marks,
// letter grade and grade points; audit courses as S / NS; SGPA, CGPA, credits
// earned, the CGPA as a percentage (KPT 9.5) and promotion (KPT 9.3).

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { KIND, errMsg, programmeName, useApi } from "../../../components/exams/shared";
import Letterhead from "../../../components/print/Letterhead";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const two = (n) => (n === null || n === undefined ? "—" : Number(n).toFixed(2));
const val = (n) => (n === null || n === undefined ? "—" : n);
const ADMISSION = { regular: "Regular", "lateral-puc": "Lateral (PUC)", "lateral-iti": "Lateral (ITI)", "lateral-iti-cross": "Lateral (ITI)", "branch-change": "Branch change" };

// KPT 9.1.1
const GRADES = [
  ["91–100", "A+", 10],
  ["81–90", "A", 9],
  ["71–80", "B+", 8],
  ["61–70", "B", 7],
  ["51–60", "C+", 6],
  ["45–50", "C", 5],
  ["40–44", "D", 4],
  ["< 40", "F", 0],
];

const RESULT = { PASS: "P", FAIL: "F", ABSENT: "AB", NE: "NE", ANS: "ANS", WITHHELD: "W" };

// how one course reads on the card
function row(c) {
  const audit = c.kind === "AUDIT";
  const pass = c.status === "PASS";
  const seeMax = (Number(c.theoryMax) || 0) + (Number(c.practicalMax) || 0);
  const see = c.theory === null && c.practical === null ? null : (Number(c.theory) || 0) + (Number(c.practical) || 0);
  return {
    credits: audit ? "—" : val(c.credit),
    cie: c.cieMax ? `${val(c.cie)}` : "—",
    see: seeMax ? `${val(see)}` : "—",
    total: c.max ? `${val(c.total)}/${c.max}` : "—",
    grade: audit ? (pass ? "S" : "NS") : c.status === "WITHHELD" ? "—" : c.grade || (pass ? "" : "F"),
    points: audit || c.status === "WITHHELD" ? "—" : val(pass ? c.points : 0),
    earned: audit ? "—" : pass ? val(c.credit) : 0,
    result: audit ? (pass ? "S" : "NS") : RESULT[c.status] || c.status,
  };
}

function PrintGradeCards() {
  const { examId } = useParams();
  const search = useSearchParams();
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in to print grade cards.");
    api("get", `/exams/${examId}/grade-cards`, undefined, { params: Object.fromEntries(search.entries()) })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e, "Could not load the grade cards.")));
  }, [api, examId, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading… please wait</p>;

  const cards = data.data;
  return (
    <div className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none">
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        @media print { body { background: #fff; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .card { min-height: 277mm; break-after: page; page-break-after: always; }
        .card:last-child { break-after: auto; page-break-after: auto; }
      `}</style>

      <div className="flex items-center gap-3 border-b border-slate-200 p-4 print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{cards.length}</b> grade card{cards.length === 1 ? "" : "s"} · one per A4 page
        </p>
        <button onClick={() => window.print()} disabled={!cards.length} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
          Print / Save as PDF
        </button>
      </div>

      {cards.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No student for this selection.</p>}
      {cards.map((g) => (
        <Card key={g._id} g={g} exam={data.exam} />
      ))}
    </div>
  );
}

function Card({ g, exam }) {
  const r = g.result;
  const courses = [...(r.courses || [])].sort((a, b) => (a.kind === "BACKLOG") - (b.kind === "BACKLOG") || (a.semester || 0) - (b.semester || 0) || String(a.code).localeCompare(String(b.code)));
  const hasAudit = courses.some((c) => c.kind === "AUDIT");
  const p = r.progression;
  const percent = r.cgpa !== null && r.cgpa !== undefined ? Math.max(0, (Number(r.cgpa) - 0.75) * 10) : null;
  const cell = "border border-slate-400 px-1.5 py-[3px]";

  return (
    <section className="card flex flex-col px-4 py-4 text-[11px] leading-snug print:px-0 print:py-0">
      <div className="flex flex-1 flex-col border-2 border-slate-900 px-4 pb-3 pt-2">
        <Letterhead evening={String(g.registerNumber || "").startsWith("186")} />

        <div className="mt-2 text-center">
          <p className="inline-block bg-slate-900 px-4 py-0.5 text-[13px] font-bold tracking-[0.25em] text-white">GRADE CARD</p>
          <p className="mt-1 text-[12px] font-bold uppercase text-[#8e0d3c]">
            {exam.name} · Academic year {exam.academicYear}
          </p>
        </div>

        {/* student */}
        <div className="mt-2 flex gap-3">
          <table className="flex-1 border-collapse">
            <tbody>
              {[
                ["Register No.", <b key="r" className="text-[12.5px] tracking-wide">{g.registerNumber}</b>, "Semester", g.backPapersOnly ? "Back papers" : g.semester],
                ["Name", <b key="n">{g.name}</b>, "Batch", g.batch || "—"],
                ["Father’s name", g.fatherName || "—", "Admission", ADMISSION[g.admissionType] || g.admissionType || "—"],
                ["Programme", programmeName(g.department), "Declared on", fmtDate(exam.publishedAt)],
              ].map(([k, v, k2, v2]) => (
                <tr key={k}>
                  <td className={`${cell} w-28 text-slate-600`}>{k}</td>
                  <td className={cell}>{v}</td>
                  <td className={`${cell} w-24 text-slate-600`}>{k2}</td>
                  <td className={`${cell} w-32`}>{v2}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex h-[30mm] w-[24mm] shrink-0 items-center justify-center border border-slate-400 text-center text-[8.5px] text-slate-400">
            {g.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span>Photo</span>
            )}
          </div>
        </div>

        {/* courses */}
        <table className="mt-3 w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              {["#", "Course code", "Course", "Sem", "Credits", "CIE", "SEE", "Total", "Grade", "Grade points", "Credits earned", "Result"].map((h) => (
                <th key={h} className={`${cell} ${["#", "Sem", "Credits", "CIE", "SEE", "Total", "Grade", "Grade points", "Credits earned", "Result"].includes(h) ? "text-center" : ""}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {courses.map((c, i) => {
              const x = row(c);
              return (
                <tr key={`${c.code}-${i}`}>
                  <td className={`${cell} text-center`}>{i + 1}</td>
                  <td className={`${cell} font-semibold`}>{c.code}</td>
                  <td className={cell}>
                    {c.name}
                    {KIND[c.kind] && <span className="ml-1 text-[9px] font-semibold uppercase text-slate-500">({KIND[c.kind]})</span>}
                  </td>
                  <td className={`${cell} text-center`}>{val(c.semester)}</td>
                  <td className={`${cell} text-center`}>{x.credits}</td>
                  <td className={`${cell} text-center tabular-nums`}>{x.cie}</td>
                  <td className={`${cell} text-center tabular-nums`}>{x.see}</td>
                  <td className={`${cell} text-center tabular-nums`}>{x.total}</td>
                  <td className={`${cell} text-center font-bold`}>{x.grade}</td>
                  <td className={`${cell} text-center tabular-nums`}>{x.points}</td>
                  <td className={`${cell} text-center tabular-nums`}>{x.earned}</td>
                  <td className={`${cell} text-center font-semibold`}>{x.result}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* summary */}
        <table className="mt-3 w-full border-collapse text-[11px]">
          <tbody>
            <tr className="text-center">
              <td className={`${cell} bg-slate-50`}>
                Credits registered <b className="block text-[13px]">{g.backPapersOnly ? "—" : r.credits.registered}</b>
              </td>
              <td className={`${cell} bg-slate-50`}>
                Credits earned <b className="block text-[13px]">{g.backPapersOnly ? "—" : r.credits.earned}</b>
              </td>
              <td className={`${cell} bg-slate-50`}>
                SGPA <b className="block text-[13px]">{g.backPapersOnly ? "—" : two(r.sgpa)}</b>
              </td>
              <td className={`${cell} bg-slate-50`}>
                CGPA <b className="block text-[13px]">{two(r.cgpa)}</b>
              </td>
              <td className={`${cell} bg-slate-50`}>
                Percentage* <b className="block text-[13px]">{percent === null ? "—" : `${percent.toFixed(2)} %`}</b>
              </td>
              <td className={`${cell} bg-slate-50`}>
                Result{" "}
                <b className="block text-[13px]">{r.outcome === "PASS" ? "PASS" : r.outcome === "WITHHELD" ? "WITHHELD" : r.outcome ? "NOT PASSED" : "—"}</b>
              </td>
            </tr>
          </tbody>
        </table>
        {g.rejection && (
          <p className="mt-1.5 rounded border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-800">
            Result of semester {g.rejection.semester} rejected by the student (KPT 9.9): {g.rejection.codes.join(", ")} not counted; he repeats the semester.
          </p>
        )}
        {!g.rejection && p?.decision === "PROMOTE" && <p className="mt-1.5 text-[11px] font-semibold">Promoted to semester {p.toSemester} (KPT 9.3).</p>}
        {!g.rejection && p?.decision === "DETAIN" && <p className="mt-1.5 text-[11px] font-semibold">Not promoted to the next semester (KPT 9.3): {String(p.note || "").replace(/^Not promoted: /, "")}</p>}

        {/* grade table + notes */}
        <div className="mt-3 flex gap-3">
          <table className="border-collapse text-[9.5px]">
            <thead>
              <tr className="bg-slate-100">
                <th className={cell}>Marks %</th>
                {GRADES.map(([m]) => (
                  <th key={m} className={`${cell} font-normal`}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className={`${cell} font-semibold`}>Grade</td>
                {GRADES.map(([m, gr]) => (
                  <td key={m} className={`${cell} text-center font-semibold`}>
                    {gr}
                  </td>
                ))}
              </tr>
              <tr>
                <td className={`${cell} font-semibold`}>Points</td>
                {GRADES.map(([m, , pt]) => (
                  <td key={m} className={`${cell} text-center`}>
                    {pt}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="flex-1 text-[9px] leading-[1.45] text-slate-600">
            P – Pass · F – Fail · AB – Absent · NE – Not eligible · ANS – Attendance not satisfactory · W – Result withheld.
            {hasAudit && " Audit courses: S – Satisfactory, NS – Not satisfactory (not counted in SGPA / CGPA)."} Bridge courses are not counted in SGPA / CGPA.
            SGPA = Σ(credits × grade points) ÷ Σ credits. *Percentage = (CGPA − 0.75) × 10 (KPT 9.5).
          </p>
        </div>

        <div className="mt-auto grid grid-cols-3 gap-6 pt-12 text-center text-[11px] font-semibold">
          {["Prepared by", "Controller of Examinations", "Principal"].map((w) => (
            <span key={w} className="border-t border-slate-500 pt-0.5">
              {w}
            </span>
          ))}
        </div>
        <p className="mt-2 text-center text-[8.5px] text-slate-500">This grade card is issued by Karnataka (Govt.) Polytechnic, Mangaluru (Autonomous). Any alteration makes it invalid.</p>
      </div>
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintGradeCards />
    </Suspense>
  );
}
