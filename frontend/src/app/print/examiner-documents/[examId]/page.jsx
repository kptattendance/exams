"use client";

// Practical examiners' documents, made by the exam section from the HOD's time table:
//   ?doc=intimation   intimation for setting & conducting (one letter per examiner set, to both examiners)
//   ?doc=conducting   practical setting / conducting certificate (one per examiner)
//   ?doc=attendance   attendance certificate (one per examiner)
//   ?doc=statement    the HOD's statement of the practical examination (one per examiner set),
//                     signed by the HOD and handed to the office
// &panel=<set> for one set, &department= / &shift= for many.
// The file number, letter date and every date can be corrected on screen before printing.

import { Suspense, createContext, useContext, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { dept } from "../../../components/exams/practicalShared";
import Letterhead from "../../../components/print/Letterhead";
import { useRole } from "../../../components/useRole";

const FILE_NO = "ಕೆಪಿಎಂ/35/ ಸ್ವಾಯತ್ತತೆ (ಪರೀಕ್ಷೆ) /2026-27";
const CENTRE = "Karnataka (Govt.) Polytechnic (Autonomous), Mangaluru";
const dmy = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
const dmyShort = (iso) => (iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(2, 4)}` : "");
const two = (n) => String(n).padStart(2, "0");

// text the exam section (office, COE, Admin) may correct on screen (dotted outline only on
// screen); for a HOD the documents are read-only
const CanEdit = createContext(false);
const EDITORS = ["office", "office_typist", "coe", "acoe", "admin"];
function Edit({ children, className = "" }) {
  const canEdit = useContext(CanEdit);
  if (!canEdit) return <span className={className}>{children}</span>;
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      title="Click to correct"
      className={`rounded-sm outline-dashed outline-1 outline-offset-2 outline-amber-400 focus:bg-amber-50 print:outline-none ${className}`}
    >
      {children}
    </span>
  );
}

const personLines = (p, internal) => [
  p.name,
  p.designation || "Lecturer",
  internal ? `${dept(p.department)} Dept.` : "", // the external examiner's department is not printed
  internal ? "Karnataka (Govt.) Polytechnic," : p.college ? `${p.college},` : "",
  internal ? "MANGALURU – 575 004" : "",
].filter(Boolean);

function Head({ date, confidential = false }) {
  return (
    <>
      <Letterhead />
      {confidential && <p className="mt-2 text-[12px] font-bold tracking-[0.25em] text-[#8e0d3c]">CONFIDENTIAL</p>}
      <div className={`${confidential ? "mt-1" : "mt-4"} flex items-start justify-between gap-6 text-[12.5px]`}>
        {/* fixed file number; room after it for the dispatch number written by hand */}
        <p className="pt-6 font-semibold">
          <span className="underline underline-offset-2">No. {FILE_NO}</span>
          <span className="ml-1 inline-block w-[16mm]" />
        </p>
        <p className="text-right leading-snug">
          Office of the Controller of Examination (COE),
          <br />
          Karnataka (Govt.) Polytechnic (Autonomous),
          <br />
          Mangaluru – 575 004, dt: <Edit className="font-semibold">{dmy(date)}</Edit>
        </p>
      </div>
    </>
  );
}

function Sign() {
  return (
    <div className="mt-16 flex justify-end text-center text-[12.5px] leading-snug">
      <div>
        <p className="font-bold text-[#1f4e79]">Chief Superintendent of Examinations</p>
        <p>Karnataka (Govt.) Polytechnic,</p>
        <p>Mangaluru – 575 004</p>
      </div>
    </div>
  );
}

const th = "border border-slate-700 bg-[#dbe7f5] px-2 py-1.5 text-center font-bold text-[#1f2937]";
const td = "border border-slate-700 px-2 py-1.5 text-center align-middle";

function Intimation({ exam, d }) {
  const people = [d.external.name && d.external, d.internal.name && d.internal].filter(Boolean);
  return (
    <section className="doc">
      <Head date={d.from} confidential />
      <p className="mt-5 text-[12.5px] font-semibold">To:</p>
      <div className="mt-1 grid grid-cols-2 gap-6 text-[12.5px] leading-snug">
        {people.map((p, i) => (
          <div key={i} className="flex gap-2">
            <span>{i + 1}.</span>
            <div>
              {personLines(p, p === d.internal).map((l, j, all) => (
                <p key={j} className={`${j === 0 ? "font-semibold" : ""} ${j === all.length - 1 ? "underline underline-offset-2" : ""}`}>
                  {l}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-5 text-[12.5px]">Dear Sir / Madam,</p>
      <p className="mt-3 text-center text-[12.5px]">
        <b>Sub:</b> Practical Examinations – Intimation for setting &amp; conducting.
      </p>
      <p className="mt-4 text-justify indent-12 text-[12.5px] leading-[1.75]">
        You have been appointed as an Examiner for setting and conducting of Practical Examinations of <b>{exam.name}</b> to be held at this Centre. I
        request you to set the Question Paper and conduct the Practical Examinations on the dates indicated herein.
      </p>
      <p className="mt-2 text-justify indent-12 text-[12.5px] leading-[1.75]">
        The Examiners are required to keep all correspondence, questions, marks obtained by the candidates, etc., absolutely confidential. The marks lists
        and valued answer books if any enclosed in the covers supplied have to be handed over to the Chief Superintendent concerned in sealed condition at the
        end of the day on the date of conduct of Examination. For separate Code Numbers separate covers have to be used.
      </p>
      <table className="mt-4 w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th className={`${th} w-10`}>Sl. No.</th>
            <th className={th}>Code No. with Batch No. &amp; No. of candidates</th>
            <th className={th}>Class</th>
            <th className={`${th} w-24`}>Date</th>
            <th className={`${th} w-28`}>Time</th>
            <th className={th}>Subject</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{i + 1}.</td>
              <td className={td}>
                <b>{r.code}</b> – {two(r.batches)} Batch{r.batches === 1 ? "" : "es"}
                <span className="block">({two(r.candidates)} Candidates)</span>
              </td>
              <td className={td}>{r.cls}</td>
              <td className={td}>
                <Edit>{dmyShort(r.date)}</Edit>
              </td>
              <td className={`${td} p-0`}>
                {r.times.map((t, j) => (
                  <span key={j} className={`block px-2 py-1 ${j ? "border-t border-slate-500" : ""}`}>
                    {t}
                  </span>
                ))}
              </td>
              <td className={`${td} text-left`}>{r.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-6 text-right text-[12.5px]">Yours faithfully,</p>
      <Sign />
    </section>
  );
}

function Conducting({ d, p, internal }) {
  const total = d.rows.reduce((a, r) => ({ b: a.b + r.batches, c: a.c + r.candidates, cb: a.cb + r.conducted, ca: a.ca + r.attended }), { b: 0, c: 0, cb: 0, ca: 0 });
  const who = [p.name, p.designation || "Lecturer", internal ? `${dept(p.department)} Dept.` : "", internal ? "Karnataka (Govt.) Polytechnic, Mangaluru" : p.college]
    .filter(Boolean)
    .join(", ");
  return (
    <section className="doc">
      <Head date={d.to} />
      <p className="mt-6 text-center text-[15px] font-bold tracking-wide text-[#1f4e79] underline underline-offset-4">PRACTICAL SETTING / CONDUCTING CERTIFICATE</p>
      <p className="mt-5 text-justify indent-12 text-[13px] leading-[1.9]">
        Certified that <b>{who}</b>, has attended to set the Question Papers and conducted the Practical examinations in the following subjects at {CENTRE}{" "}
        from <Edit className="font-bold">{dmy(d.from)}</Edit> to <Edit className="font-bold">{dmy(d.to)}</Edit>.
      </p>
      <table className="mt-5 w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th rowSpan={2} className={`${th} w-10`}>Sl. No.</th>
            <th rowSpan={2} className={`${th} w-24`}>Code No.</th>
            <th rowSpan={2} className={th}>Name of the Subject</th>
            <th rowSpan={2} className={`${th} w-20`}>Date</th>
            <th colSpan={4} className={th}>Practical set and conducted</th>
          </tr>
          <tr>
            <th className={`${th} w-[19mm] text-[11px]`}>No. of batches allotted as per statement</th>
            <th className={`${th} w-[19mm] text-[11px]`}>No. of candidates allotted</th>
            <th className={`${th} w-[19mm] text-[11px]`}>No. of batches actually conducted</th>
            <th className={`${th} w-[19mm] text-[11px]`}>No. of candidates attended</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{r.code}</td>
              <td className={`${td} text-left`}>
                {r.name}
                <span className="block text-[10.5px] text-slate-600">{r.cls}</span>
              </td>
              <td className={td}>
                <Edit>{dmyShort(r.date)}</Edit>
              </td>
              <td className={td}>{two(r.batches)}</td>
              <td className={td}>{two(r.candidates)}</td>
              <td className={td}>
                <Edit>{two(r.conducted)}</Edit>
              </td>
              <td className={td}>
                <Edit>{two(r.attended)}</Edit>
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={td} colSpan={4} />
            <td className={td}>{two(total.b)}</td>
            <td className={td}>{two(total.c)}</td>
            <td className={td}>
              <Edit>{two(total.cb)}</Edit>
            </td>
            <td className={td}>
              <Edit>{two(total.ca)}</Edit>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-6 space-y-2 text-[13px]">
        <p>
          1.&nbsp;&nbsp;Total : <b className="underline underline-offset-2"><Edit>{two(total.cb)}</Edit></b> Batches only.
        </p>
        <p>
          2.&nbsp;&nbsp;Total : <b className="underline underline-offset-2"><Edit>{two(total.ca)}</Edit></b> Candidates only.
        </p>
      </div>
      <Sign />
    </section>
  );
}

function Attendance({ exam, d, p, internal }) {
  const who = [p.name, p.designation || "Lecturer", internal ? `${dept(p.department)} Department` : "", internal ? "Karnataka (Govt.) Polytechnic, Mangaluru" : p.college]
    .filter(Boolean)
    .join(", ");
  return (
    <section className="doc">
      <Head date={d.to} />
      <p className="mt-10 text-center text-[16px] font-bold tracking-wide text-[#1f4e79] underline underline-offset-4">ATTENDANCE CERTIFICATE</p>
      <p className="mt-8 text-justify indent-12 text-[14px] leading-[2.2]">
        Certified that <b>{who}</b> has attended to conduct <b>{exam.name}</b> Practical Examinations at {CENTRE} from{" "}
        <Edit className="font-bold">{dmy(d.from)}</Edit> to <Edit className="font-bold">{dmy(d.to)}</Edit>.
      </p>
      <Sign />
    </section>
  );
}

// The HOD's statement: examiners, and per subject / date / class the batches and candidates
function Statement({ exam, d }) {
  const total = d.rows.reduce((a, r) => ({ b: a.b + r.batches, c: a.c + r.candidates, cb: a.cb + r.conducted, ca: a.ca + r.attended }), { b: 0, c: 0, cb: 0, ca: 0 });
  const people = [d.external, d.internal].map((p, i) => ({ p, internal: i === 1 })).filter((x) => x.p.name);
  return (
    <section className="doc">
      <Letterhead compact />
      <div className="mt-2 text-center">
        <p className="text-[14px] font-bold tracking-wide text-[#1f4e79]">PRACTICAL EXAMINATION – STATEMENT OF EXAMINERS</p>
        <p className="text-[12.5px] font-semibold">{exam.name}</p>
        <p className="text-[12px]">
          {dept(d.panel.department)} Department{d.panel.shift === "EVENING" ? " (Second Shift)" : ""} · Examiner set {d.panel.number}
        </p>
      </div>
      <p className="mt-3 text-[12.5px]">
        Date: From <Edit className="font-bold">{dmy(d.from)}</Edit> to <Edit className="font-bold">{dmy(d.to)}</Edit>
      </p>
      <table className="mt-2 w-full border-collapse text-[12px]">
        <thead>
          <tr>
            <th colSpan={people.length || 1} className={`${th} text-left`}>
              Examiners&apos; name &amp; college address
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {people.map(({ p, internal }, i) => (
              <td key={i} className={`${td} text-left align-top leading-snug`}>
                <span className="mr-1 text-slate-500">{i + 1})</span>
                <span className="text-[10.5px] font-semibold uppercase text-slate-500">{internal ? "Internal" : "External"}</span>
                {personLines(p, internal).map((l, j) => (
                  <span key={j} className={`block ${j === 0 ? "font-semibold" : ""}`}>
                    {l}
                  </span>
                ))}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <table className="mt-3 w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            <th className={`${th} w-9`}>Sl. No.</th>
            <th className={`${th} w-[22mm]`}>Code No.</th>
            <th className={`${th} w-[14mm]`}>No. of students</th>
            <th className={th}>Name of the subject</th>
            <th className={`${th} w-[18mm]`}>Class</th>
            <th className={`${th} w-[18mm]`}>Date</th>
            <th className={`${th} w-[22mm]`}>Time</th>
            <th className={`${th} w-[15mm] text-[10.5px]`}>Total no. of batches allotted</th>
            <th className={`${th} w-[15mm] text-[10.5px]`}>No. of candidates allotted</th>
            <th className={`${th} w-[15mm] text-[10.5px]`}>No. of batches conducted</th>
            <th className={`${th} w-[15mm] text-[10.5px]`}>No. of candidates attended</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={i}>
              <td className={td}>{i + 1}.</td>
              <td className={`${td} font-semibold`}>{r.code}</td>
              <td className={td}>{two(r.candidates)}</td>
              <td className={`${td} text-left`}>{r.name}</td>
              <td className={td}>{r.cls}</td>
              <td className={td}>
                <Edit>{dmyShort(r.date)}</Edit>
              </td>
              <td className={`${td} p-0 text-[10.5px]`}>
                {r.times.map((t, j) => (
                  <span key={j} className={`block px-1 py-0.5 ${j ? "border-t border-slate-500" : ""}`}>
                    {t}
                  </span>
                ))}
              </td>
              <td className={td}>{two(r.batches)}</td>
              <td className={td}>{two(r.candidates)}</td>
              <td className={td}>
                <Edit>{two(r.conducted)}</Edit>
              </td>
              <td className={td}>
                <Edit>{two(r.attended)}</Edit>
              </td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={`${td} text-right`} colSpan={7}>
              Total
            </td>
            <td className={td}>{two(total.b)}</td>
            <td className={td}>{two(total.c)}</td>
            <td className={td}>
              <Edit>{two(total.cb)}</Edit>
            </td>
            <td className={td}>
              <Edit>{two(total.ca)}</Edit>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="mt-16 grid grid-cols-3 gap-8 text-center text-[12px] font-semibold">
        <span className="border-t border-slate-700 pt-1">
          Internal Examiner
          {d.internal.name && <span className="block font-normal">{d.internal.name}</span>}
          {d.internal.name && <span className="block text-[10.5px] font-normal text-slate-600">Karnataka (Govt.) Polytechnic, Mangaluru</span>}
        </span>
        <span className="border-t border-slate-700 pt-1">
          External Examiner
          {d.external.name && <span className="block font-normal">{d.external.name}</span>}
          {d.external.college && <span className="block text-[10.5px] font-normal text-slate-600">{d.external.college}</span>}
        </span>
        <span className="border-t border-slate-700 pt-1">
          Signature of HOD
          <span className="block font-normal">{dept(d.panel.department)}</span>
        </span>
      </div>
    </section>
  );
}

function PrintExaminerDocuments() {
  const { examId } = useParams();
  const search = useSearchParams();
  const doc = search.get("doc") || "intimation";
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const canEdit = EDITORS.includes(useRole());

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in.");
    const params = {};
    for (const k of ["panel", "department", "shift"]) if (search.get(k)) params[k] = search.get(k);
    api("get", `/practicals/${examId}/examiner-documents`, undefined, { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e, "Could not load.")));
  }, [api, examId, isLoaded, isSignedIn, search]);

  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  const pages = [];
  for (const d of data.data) {
    if (doc === "intimation") pages.push(<Intimation key={`${d.panel._id}-i`} exam={data.exam} d={d} />);
    else if (doc === "statement") pages.push(<Statement key={`${d.panel._id}-s`} exam={data.exam} d={d} />);
    else
      for (const [p, internal] of [
        [d.external, false],
        [d.internal, true],
      ])
        if (p.name)
          pages.push(
            doc === "attendance" ? (
              <Attendance key={`${d.panel._id}-${internal}`} exam={data.exam} d={d} p={p} internal={internal} />
            ) : (
              <Conducting key={`${d.panel._id}-${internal}`} d={d} p={p} internal={internal} />
            )
          );
  }
  const title = {
    intimation: "Intimation for setting & conducting",
    conducting: "Setting / conducting certificates",
    attendance: "Attendance certificates",
    statement: "Statement of examiners (sign as HOD and give to the office)",
  }[doc];
  const blank = "\\00a0";
  return (
    <div className="mx-auto max-w-[210mm] bg-white text-slate-900 print:max-w-none" style={{ fontFamily: "'Noto Serif', 'Noto Sans Kannada', 'Nirmala UI', Georgia, serif" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Kannada:wght@400;600;700&family=Noto+Serif:wght@400;600;700&display=swap" />
      <style>{`
        @page { size: A4; margin: 12mm 16mm;
          @top-left { content: "${blank}"; } @top-center { content: "${blank}"; } @top-right { content: "${blank}"; }
          @bottom-left { content: "${blank}"; } @bottom-center { content: "${blank}"; } @bottom-right { content: "${blank}"; } }
        @media print { body { background: #fff; } }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .doc { break-after: page; page-break-after: always; }
        .doc:last-child { break-after: auto; page-break-after: auto; }
      `}</style>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4 font-sans print:hidden">
        <p className="flex-1 text-sm text-slate-600">
          <b>{title}</b> · {pages.length} page{pages.length === 1 ? "" : "s"}.
          {canEdit && " Dates and numbers with a dotted outline can be corrected – click and type – before printing."}
        </p>
        <button onClick={() => window.print()} disabled={!pages.length} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white disabled:opacity-40">
          Print / Save as PDF
        </button>
      </div>
      {!pages.length && <p className="p-8 text-center font-sans text-sm text-slate-500">No examiner set has batches in the time table for this selection yet.</p>}
      <CanEdit.Provider value={canEdit}>
        <div className="px-6 py-6 print:p-0">{pages}</div>
      </CanEdit.Provider>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintExaminerDocuments />
    </Suspense>
  );
}
