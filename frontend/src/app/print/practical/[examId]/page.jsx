"use client";

// Practical exam printouts (new tab, Print → Save as PDF):
//   ?batch=<id>                     mark list of one batch – blank before the exam,
//                                   with the marks after the examiners submit
//   ?sheet=timetable&department=cs  time table and examiners (notice board / file);
//                                   department = the department that conducts the exams
//   Exam section (office), with optional &department= &date= (&status= for the report):
//   ?sheet=room-diary               one room diary per lab and session
//   ?sheet=ml                       blank ML (mark list) entry sheets, one batch per page
//   ?sheet=status                   practical marks entered / pending, subject-wise
//   HOD time table grid (&department=cs):
//   ?sheet=tt-students              date, time and register numbers – for the students
//   ?sheet=tt-examiners             date, time and examiners with phone numbers – for the HOD
//   &auto=1                         opens the print (Save as PDF) dialog by itself

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { SLOTS, branches, dept, sessionLabel } from "../../../components/exams/practicalShared";
import { STATUS, filterOffice, roomsOf } from "../../../components/exams/OfficePractical";
import Letterhead from "../../../components/print/Letterhead";
import { useRole } from "../../../components/useRole";

const OFFICE_SHEETS = ["room-diary", "ml", "status"];
const TT_SHEETS = ["tt-students", "tt-examiners"];

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "__________");
const session = (s) => sessionLabel(s) || "______";

function Head({ exam, title, sub }) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-bold uppercase tracking-wide">Karnataka Government Polytechnic, Mangaluru</p>
      <p className="text-[10px]">(Autonomous)</p>
      <p className="mt-1 text-[12px] font-semibold">{exam}</p>
      <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">{title}</p>
      {sub && <p className="text-[12px]">{sub}</p>}
    </div>
  );
}

function PrintPractical() {
  const { examId } = useParams();
  const search = useSearchParams();
  const batchId = search.get("batch");
  const department = search.get("department") || "";
  const branch = search.get("branch") || ""; // a HOD's view: his own exams + his students elsewhere
  const sheet = search.get("sheet") || "";
  const office = OFFICE_SHEETS.includes(sheet);
  const grid = TT_SHEETS.includes(sheet);
  const auto = search.get("auto") === "1";
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Mark lists are printed by the exam section, not by the examiners (faculty)
  const examinerOnly = useRole() === "staff";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in.");
    const call = office
      ? api("get", `/practicals/${examId}/office`)
      : grid
      ? api("get", `/practicals/${examId}/schedule`, undefined, { params: { department } })
      : batchId
        ? api("get", `/practicals/batches/${batchId}`)
        : api("get", `/practicals/${examId}/batches`, undefined, { params: branch ? { branch } : department ? { department } : {} });
    call.then((r) => setData(r.data)).catch((e) => setError(errMsg(e, "Could not load.")));
  }, [api, examId, batchId, department, branch, office, grid, isLoaded, isSignedIn]);

  // "PDF" button of the office pages: open the print dialog once the sheet is drawn
  useEffect(() => {
    if (!auto || !data) return;
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, [auto, data]);

  if (examinerOnly) return <p className="p-8 text-sm text-slate-700">Mark lists and room diaries are printed by the exam section.</p>;
  if (error) return <p className="p-8 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="p-8 text-sm text-slate-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-[210mm] bg-white px-6 py-6 text-[11.5px] text-slate-900 print:max-w-none print:p-0">
      <style>{`@page{size:A4;margin:12mm} @media print{body{background:#fff}}`}</style>
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-slate-100 p-3 print:hidden">
        <p className="flex-1 text-sm text-slate-600">Use Print → Save as PDF for a PDF.</p>
        <button onClick={() => window.print()} className="h-10 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">
          Print
        </button>
      </div>
      {grid ? (
        <GridSheet sheet={sheet} data={data} />
      ) : office ? (
        <OfficeSheet sheet={sheet} data={data} department={department} date={search.get("date") || ""} status={search.get("status") || ""} />
      ) : batchId ? (
        <MarkList b={data.data} />
      ) : (
        <TimeTable exam={data.exam} batches={data.data} department={department} branch={branch} />
      )}
    </div>
  );
}

function MarkList({ b }) {
  const done = b.status === "SUBMITTED";
  return (
    <div>
      <Head exam={b.examName} title={done ? "PRACTICAL EXAMINATION – MARK LIST" : "PRACTICAL EXAMINATION – BLANK MARK LIST"} sub={`${b.code} – ${b.name}`} />
      <div className="mt-3 flex items-end justify-between">
        <p className="text-[11px] leading-5">
          Conducted by: {dept(b.department)} &nbsp;·&nbsp; Semester: {b.semester ?? "–"}
          <br />
          Date: {day(b.date)} &nbsp;·&nbsp; Session: {session(b.session)} &nbsp;·&nbsp; Lab: {b.lab || "__________"}
        </p>
        <p className="border-2 border-slate-900 px-3 py-1 text-[15px] font-bold tracking-wide">{b.label}</p>
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-28`}>Register No.</th>
            <th className={th}>Name</th>
            <th className={`${th} w-12`}>Branch</th>
            <th className={`${th} w-28`}>Marks (out of {b.max})</th>
            <th className={`${th} w-40`}>{done ? "Remarks" : "Marks in words"}</th>
          </tr>
        </thead>
        <tbody>
          {b.students.map((s, i) => (
            <tr key={s.registerNumber} className="h-[7mm]">
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{s.registerNumber}</td>
              <td className={td}>
                {s.name}
                {s.kind === "BACKLOG" && <span className="ml-1 text-[9px]">(B)</span>}
              </td>
              <td className={td}>{String(s.department || "").toUpperCase()}</td>
              <td className={`${td} text-center text-[13px] font-bold`}>{done && s.attendance ? (s.attendance === "PRESENT" ? s.marks : s.attendance === "ABSENT" ? "AB" : "MP") : ""}</td>
              <td className={td}>{done && s.attendance !== "PRESENT" ? (s.attendance === "ABSENT" ? "Absent" : "Malpractice") : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {done ? (
        <p className="mt-3 text-[11px]">
          Students: {b.count} &nbsp;·&nbsp; Present: {b.summary.present} &nbsp;·&nbsp; Absent: {b.summary.absent} &nbsp;·&nbsp; Malpractice: {b.summary.malpractice}
          <br />
          Submitted online on {new Date(b.submitted.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} by {b.submitted.by}, confirmed by the external examiner&apos;s code.
          {b.corrections?.length > 0 && ` Includes ${b.corrections.length} correction${b.corrections.length > 1 ? "s" : ""} by the Admin.`}
        </p>
      ) : (
        <p className="mt-3 text-[11px]">Students: {b.count} &nbsp;·&nbsp; Present: ______ &nbsp;·&nbsp; Absent: ______</p>
      )}
      <div className="mt-14 flex justify-between text-[11px]">
        <div>
          <p className="font-semibold">Internal examiner</p>
          <p>{b.internal.name || "________________"}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">External examiner</p>
          <p>
            {b.external.name || "________________"}
            {b.external.college && `, ${b.external.college}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function TimeTable({ exam, batches, department, branch }) {
  return (
    <div>
      <Head exam={exam.name} title="PRACTICAL EXAMINATION – TIME TABLE AND EXAMINERS" sub={branch ? `${dept(branch)} department – exams it conducts and exams its students attend` : department ? `Conducted by the ${dept(department)} department` : "All departments"} />
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-24`}>Date / session</th>
            <th className={th}>Subject</th>
            <th className={`${th} w-12`}>Batch</th>
            <th className={`${th} ${branch ? "w-40" : "w-24"}`}>Students</th>
            <th className={`${th} w-24`}>Lab</th>
            <th className={th}>Internal examiner</th>
            <th className={th}>External examiner</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b, i) => (
            <tr key={b._id}>
              <td className={td}>{i + 1}</td>
              <td className={td}>
                {b.date ? day(b.date) : "Not fixed"}
                {b.session && <br />}
                {b.session && session(b.session)}
              </td>
              <td className={td}>
                <b>{b.code}</b> {b.name}
                {branch && b.department !== branch && <span className="block text-[10px]">Conducted by {dept(b.department)}</span>}
              </td>
              <td className={`${td} text-center`}>{b.number}</td>
              <td className={td}>
                {branch && b.department !== branch ? (
                  // another board's batch: which of our students sit in it
                  <>
                    {b.own.length} {branch.toUpperCase()} student{b.own.length === 1 ? "" : "s"}
                    <span className="block text-[9.5px] leading-tight">
                      {b.own.length > 8 ? `${b.own[0].registerNumber} … ${b.own[b.own.length - 1].registerNumber}` : b.own.map((s) => s.registerNumber).join(", ")}
                    </span>
                  </>
                ) : (
                  <>
                    {b.count}
                    {b.branches.length > 0 && ` (${branches(b.branches)})`}
                  </>
                )}
              </td>
              <td className={td}>{b.lab}</td>
              <td className={td}>{b.internal.name || "–"}</td>
              <td className={td}>
                {b.external.name || "–"}
                {b.external.college && <br />}
                {b.external.college}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {batches.length === 0 && <p className="mt-4 text-sm text-slate-500">No batches yet.</p>}
      <div className="mt-12 flex justify-between text-[11px] font-semibold">
        <span>Head of the Department</span>
        <span>Controller of Examinations</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ HOD time table (grid) sheets

const longDay = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });

function GridSheet({ sheet, data }) {
  const forStudents = sheet === "tt-students";
  const order = (s) => SLOTS.findIndex((x) => x.code === s);
  const placed = data.batches
    .filter((b) => b.date && b.session)
    .sort((a, b) => a.date.localeCompare(b.date) || order(a.session) - order(b.session) || a.label.localeCompare(b.label, undefined, { numeric: true }));
  const notPlaced = data.batches.filter((b) => !(b.date && b.session));
  const panels = new Map((data.panels || []).map((p) => [String(p._id), p]));
  // the date is printed once for all its rows
  const span = (i) => (i > 0 && placed[i - 1].date === placed[i].date ? 0 : placed.filter((b) => b.date === placed[i].date).length);
  const person = (name, phone, extra) => (
    <>
      {name || "________________"}
      {extra && <span className="block text-[10px]">{extra}</span>}
      {phone && <span className="block text-[10px] font-semibold">Ph: {phone}</span>}
    </>
  );
  return (
    <div>
      <style>{forStudents ? "" : "@page{size:A4 landscape;margin:10mm}"}</style>
      <Letterhead />
      <div className="mt-2 text-center">
        <p className="text-[12px] font-semibold">{data.exam?.name}</p>
        <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">
          {forStudents ? "PRACTICAL EXAMINATION – TIME TABLE FOR STUDENTS" : "PRACTICAL EXAMINATION – TIME TABLE AND EXAMINERS"}
        </p>
        <p className="text-[12px]">Conducted by the {dept(data.department)} department</p>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-24`}>Date / day</th>
            <th className={`${th} w-28`}>Time</th>
            <th className={th}>Subject</th>
            <th className={`${th} w-12`}>Batch</th>
            <th className={`${th} w-20`}>Lab</th>
            {forStudents ? (
              <th className={th}>Register numbers</th>
            ) : (
              <>
                <th className={`${th} w-14`}>Students</th>
                <th className={`${th} w-56`}>Register numbers</th>
                <th className={th}>Internal examiner</th>
                <th className={th}>External examiner</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {placed.map((b, i) => {
            const p = panels.get(String(b.panel || ""));
            return (
              <tr key={b._id} className="break-inside-avoid align-top">
                {span(i) > 0 && (
                  <td rowSpan={span(i)} className={`${td} font-semibold`}>
                    {day(b.date)}
                    <span className="block text-[10px] font-normal">{longDay(b.date)}</span>
                  </td>
                )}
                <td className={`${td} whitespace-nowrap`}>{session(b.session)}</td>
                <td className={td}>
                  <b>{b.code}</b> {b.name}
                </td>
                <td className={`${td} text-center`}>{b.number}</td>
                <td className={td}>{b.lab}</td>
                {forStudents ? (
                  <td className={`${td} text-[10px] leading-snug`}>{b.students.map((s) => s.registerNumber).join(", ")}</td>
                ) : (
                  <>
                    <td className={`${td} text-center`}>{b.count}</td>
                    <td className={`${td} text-[9.5px] leading-snug`}>{b.students.map((s) => s.registerNumber).join(", ")}</td>
                    <td className={td}>{p ? person(p.internal.name, p.internal.phone) : b.internal?.name || "Not allotted"}</td>
                    <td className={td}>{p ? person(p.external.name, p.external.phone, p.external.college) : b.external?.name || "Not allotted"}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {placed.length === 0 && <p className="mt-4 text-sm text-slate-500">No batch is in the time table yet.</p>}
      {notPlaced.length > 0 && (
        <p className="mt-3 text-[11px]">
          <b>Not scheduled yet:</b> {notPlaced.map((b) => b.label).join(", ")}
        </p>
      )}
      {!forStudents && <MissingCheck check={data.check || []} />}
      {forStudents && <p className="mt-3 text-[10.5px]">Report to the lab 15 minutes before the time. Bring your hall ticket, ID card and record book.</p>}
      <Signatures who={forStudents ? ["HOD", "Principal / Dean", "COE"] : ["HOD", "COE"]} />
    </div>
  );
}

// HOD's check: every registered student of each subject is either in a batch,
// or listed here (permitted but left out / not permitted).
function MissingCheck({ check }) {
  const gaps = check.filter((c) => c.notInBatch.length || c.notPermitted.length);
  const list = (rows, reason) => rows.map((s) => `${s.registerNumber}${reason && s.reason ? ` (${s.reason})` : ""}`).join(", ");
  return (
    <div className="mt-4 break-inside-avoid">
      <p className="text-[12px] font-bold">Register number check</p>
      {check.length > 0 && gaps.length === 0 && (
        <p className="mt-1 text-[11px]">All registered students of every subject are in the time table – nobody is missing.</p>
      )}
      {gaps.length > 0 && (
        <table className="mt-1 w-full border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className={`${th} w-48`}>Subject</th>
              <th className={`${th} w-28`}>Registered / permitted</th>
              <th className={th}>Permitted but NOT in any batch (add them)</th>
              <th className={th}>Not permitted (eligibility / fee)</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map((c) => (
              <tr key={c.code} className="align-top">
                <td className={td}>
                  <b>{c.code}</b> {c.name}
                </td>
                <td className={`${td} text-center`}>
                  {c.registered} / {c.permitted}
                </td>
                <td className={`${td} text-[10px] font-semibold leading-snug`}>{c.notInBatch.length ? list(c.notInBatch) : "None"}</td>
                <td className={`${td} text-[10px] leading-snug`}>{c.notPermitted.length ? list(c.notPermitted, true) : "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ office sheets

function OfficeSheet({ sheet, data, department, date, status }) {
  const { batches, subjects } = filterOffice(data, { department, date, status });
  const exam = data.exam?.name || "";
  const empty = <p className="mt-6 text-sm text-slate-500">Nothing to print for this selection.</p>;
  if (sheet === "status") return <StatusSheet exam={exam} subjects={subjects} department={department} />;
  if (!batches.length) return empty;
  if (sheet === "ml")
    return batches.map((b, i) => (
      <div key={b._id} className={i ? "break-before-page pt-2" : ""}>
        <BlankMarkList exam={exam} b={b} />
      </div>
    ));
  return roomsOf(batches).map((r, i) => (
    <div key={r.key} className={i ? "break-before-page pt-2" : ""}>
      <RoomDiary exam={exam} room={r} />
    </div>
  ));
}

function Signatures({ who }) {
  return (
    <div className="mt-12 grid gap-4 text-center text-[11px] font-semibold" style={{ gridTemplateColumns: `repeat(${who.length}, 1fr)` }}>
      {who.map((w) => (
        <span key={w} className="border-t border-slate-700 pt-1">
          {w}
        </span>
      ))}
    </div>
  );
}

// Room diary sign-off: under each examiner his name, then his college (code and
// name); under HOD the department that conducts the exam
const OUR_COLLEGE = "103 – Karnataka (Govt.) Polytechnic, Mangaluru";
const uniq = (list) => [...new Set(list.filter(Boolean))];

function RoomSignatures({ batches }) {
  const internals = uniq(batches.map((b) => b.internal?.name));
  const externals = uniq(batches.map((b) => [b.external?.name, b.external?.college].filter(Boolean).join("|")));
  const depts = uniq(batches.map((b) => dept(b.department)));
  const cell = (title, lines) => (
    <div className="border-t border-slate-700 pt-1">
      <p className="font-semibold">{title}</p>
      {lines}
    </div>
  );
  return (
    <div className="mt-12 grid grid-cols-4 gap-4 text-center text-[11px] leading-4 break-inside-avoid">
      {cell(
        "Internal Examiner",
        internals.length ? (
          internals.map((n) => (
            <p key={n}>
              {n}
              <span className="block text-[10px]">{OUR_COLLEGE}</span>
            </p>
          ))
        ) : (
          <p>________________</p>
        )
      )}
      {cell(
        "External Examiner",
        externals.length ? (
          externals.map((x) => {
            const [name, college] = x.split("|");
            return (
              <p key={x}>
                {name}
                {college && <span className="block text-[10px]">{college}</span>}
              </p>
            );
          })
        ) : (
          <p>________________</p>
        )
      )}
      {cell(
        "HOD",
        depts.map((d) => <p key={d}>{d}</p>)
      )}
      {cell("COE", null)}
    </div>
  );
}

function RoomDiary({ exam, room }) {
  const students = room.batches.flatMap((b) => b.students.map((s) => ({ ...s, batch: b.label })));
  const done = room.batches.every((b) => b.status === "SUBMITTED");
  const count = (a) => students.filter((s) => s.attendance === a).length;
  return (
    <div>
      <Letterhead />
      <div className="mt-2 text-center">
        <p className="text-[12px] font-semibold">{exam}</p>
        <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">PRACTICAL EXAMINATION – ROOM DIARY</p>
      </div>
      <table className="mt-3 w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${td} w-24 font-semibold`}>Date</td>
            <td className={td}>{day(room.date)}</td>
            <td className={`${td} w-24 font-semibold`}>Session</td>
            <td className={td}>{session(room.session)}</td>
            <td className={`${td} w-24 font-semibold`}>Lab / Room</td>
            <td className={td}>{room.lab || "__________"}</td>
          </tr>
        </tbody>
      </table>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={th}>Batch</th>
            <th className={th}>Subject</th>
            <th className={`${th} w-16`}>Students</th>
            <th className={th}>Internal examiner</th>
            <th className={th}>External examiner</th>
          </tr>
        </thead>
        <tbody>
          {room.batches.map((b) => (
            <tr key={b._id}>
              <td className={`${td} font-semibold`}>{b.label}</td>
              <td className={td}>
                <b>{b.code}</b> {b.name}
                <span className="block text-[10px]">Conducted by {dept(b.department)}</span>
              </td>
              <td className={`${td} text-center`}>{b.count}</td>
              <td className={td}>{b.internal.name || "________________"}</td>
              <td className={td}>
                {b.external.name || "________________"}
                {b.external.college && <span className="block text-[10px]">{b.external.college}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-28`}>Register No.</th>
            <th className={th}>Name</th>
            <th className={`${th} w-12`}>Branch</th>
            <th className={`${th} w-24`}>Batch</th>
            {/* written by the candidate: the number printed on his answer script */}
            <th className={`${th} w-28`}>Answer script No.</th>
            <th className={`${th} w-28`}>Signature of candidate</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s, i) => (
            <tr key={`${s.batch}-${s.registerNumber}`} className="h-[7mm]">
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{s.registerNumber}</td>
              <td className={td}>{s.name}</td>
              <td className={td}>{String(s.department || "").toUpperCase()}</td>
              <td className={td}>{s.batch}</td>
              <td className={td} />
              <td className={td} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px]">
        Allotted: {students.length} &nbsp;·&nbsp; Present: {done ? count("PRESENT") : "______"} &nbsp;·&nbsp; Absent:{" "}
        {done ? count("ABSENT") : "______"} &nbsp;·&nbsp; Malpractice: {done ? count("MALPRACTICE") : "______"}
        <br />
        Absentees (register numbers): {done ? students.filter((s) => s.attendance === "ABSENT").map((s) => s.registerNumber).join(", ") || "Nil" : "______________________________________________"}
      </p>
      <RoomSignatures batches={room.batches} />
    </div>
  );
}

function BlankMarkList({ exam, b }) {
  return (
    <div>
      <Letterhead />
      <div className="mt-2 text-center">
        <p className="text-[12px] font-semibold">{exam}</p>
        <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">PRACTICAL EXAMINATION – MARK LIST (ML) ENTRY SHEET</p>
        <p className="text-[12px]">
          {b.code} – {b.name}
        </p>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-[11px] leading-5">
          Conducted by: {dept(b.department)} &nbsp;·&nbsp; Semester: {b.semester ?? "–"} &nbsp;·&nbsp; Maximum marks: {b.max}
          <br />
          Date: {day(b.date)} &nbsp;·&nbsp; Session: {session(b.session)} &nbsp;·&nbsp; Lab: {b.lab || "__________"}
        </p>
        <p className="border-2 border-slate-900 px-3 py-1 text-[15px] font-bold tracking-wide">{b.label}</p>
      </div>
      <table className="mt-3 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={`${th} w-28`}>Register No.</th>
            <th className={th}>Name</th>
            <th className={`${th} w-12`}>Branch</th>
            <th className={`${th} w-24`}>Marks (figures)</th>
            <th className={`${th} w-36`}>Marks (words)</th>
            <th className={`${th} w-20`}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {b.students.map((s, i) => (
            <tr key={s.registerNumber} className="h-[7.5mm]">
              <td className={td}>{i + 1}</td>
              <td className={`${td} font-semibold`}>{s.registerNumber}</td>
              <td className={td}>
                {s.name}
                {s.kind === "BACKLOG" && <span className="ml-1 text-[9px]">(B)</span>}
              </td>
              <td className={td}>{String(s.department || "").toUpperCase()}</td>
              <td className={td} />
              <td className={td} />
              <td className={td} />
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px]">Students: {b.count} &nbsp;·&nbsp; Present: ______ &nbsp;·&nbsp; Absent: ______ &nbsp;·&nbsp; Write AB for absent.</p>
      <div className="mt-12 grid grid-cols-3 gap-4 text-[11px]">
        <div>
          <p className="border-t border-slate-700 pt-1 font-semibold">Internal Examiner</p>
          <p>{b.internal.name || "Name: ________________"}</p>
        </div>
        <div>
          <p className="border-t border-slate-700 pt-1 font-semibold">External Examiner</p>
          <p>
            {b.external.name || "Name: ________________"}
            {b.external.college && `, ${b.external.college}`}
          </p>
        </div>
        <div>
          <p className="border-t border-slate-700 pt-1 font-semibold">HOD</p>
        </div>
      </div>
    </div>
  );
}

function StatusSheet({ exam, subjects, department }) {
  const sum = (k) => subjects.reduce((n, s) => n + (s[k] || 0), 0);
  return (
    <div>
      <Letterhead />
      <div className="mt-2 text-center">
        <p className="text-[12px] font-semibold">{exam}</p>
        <p className="mt-1 text-[13px] font-bold tracking-[0.15em]">PRACTICAL MARKS ENTRY – STATUS REPORT</p>
        <p className="text-[11px]">
          {department ? `Conducted by the ${dept(department)} department` : "All departments"} · as on{" "}
          {new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className={`${th} w-8`}>#</th>
            <th className={th}>Subject</th>
            <th className={`${th} w-28`}>Department</th>
            <th className={`${th} w-16`}>Regd.</th>
            <th className={`${th} w-20`}>Batches (done)</th>
            <th className={`${th} w-16`}>Entered</th>
            <th className={`${th} w-16`}>Pending</th>
            <th className={`${th} w-24`}>Status</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => (
            <tr key={s.code}>
              <td className={td}>{i + 1}</td>
              <td className={td}>
                <b>{s.code}</b> {s.name}
              </td>
              <td className={td}>
                {dept(s.department)}
                {s.semester ? ` · ${s.semester}` : ""}
              </td>
              <td className={`${td} text-right`}>{s.registered}</td>
              <td className={`${td} text-right`}>
                {s.batches} ({s.submittedBatches})
              </td>
              <td className={`${td} text-right font-semibold`}>{s.entered}</td>
              <td className={`${td} text-right font-semibold`}>{s.pending}</td>
              <td className={td}>{STATUS[s.status]?.label || s.status}</td>
            </tr>
          ))}
          <tr className="bg-slate-100 font-semibold">
            <td className={td} colSpan={3}>
              Total ({subjects.length} subjects)
            </td>
            <td className={`${td} text-right`}>{sum("registered")}</td>
            <td className={`${td} text-right`}>
              {sum("batches")} ({sum("submittedBatches")})
            </td>
            <td className={`${td} text-right`}>{sum("entered")}</td>
            <td className={`${td} text-right`}>{sum("pending")}</td>
            <td className={td} />
          </tr>
        </tbody>
      </table>
      {subjects.length === 0 && <p className="mt-4 text-sm text-slate-500">No practical subjects for this selection.</p>}
      <Signatures who={["Exam Section", "COE"]} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintPractical />
    </Suspense>
  );
}
