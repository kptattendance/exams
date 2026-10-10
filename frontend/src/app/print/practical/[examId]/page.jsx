"use client";

// Practical exam printouts (new tab, Print → Save as PDF):
//   ?batch=<id>                     mark list of one batch – blank before the exam,
//                                   with the marks after the examiners submit
//   ?sheet=timetable&department=cs  time table and examiners (notice board / file);
//                                   department = the department that conducts the exams

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";

import { errMsg, useApi } from "../../../components/exams/shared";
import { branches, dept } from "../../../components/exams/practicalShared";

const th = "border border-slate-700 px-2 py-1 text-left";
const td = "border border-slate-700 px-2 py-1";
const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "__________");
const session = (s) => (s === "FN" ? "Morning" : s === "AN" ? "Afternoon" : "______");

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
  const { isLoaded, isSignedIn } = useAuth();
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError("Please sign in.");
    const call = batchId ? api("get", `/practicals/batches/${batchId}`) : api("get", `/practicals/${examId}/batches`, undefined, { params: branch ? { branch } : department ? { department } : {} });
    call.then((r) => setData(r.data)).catch((e) => setError(errMsg(e, "Could not load.")));
  }, [api, examId, batchId, department, branch, isLoaded, isSignedIn]);

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
      {batchId ? <MarkList b={data.data} /> : <TimeTable exam={data.exam} batches={data.data} department={department} branch={branch} />}
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
              <td className={`${td} text-center text-[13px] font-bold`}>{done ? (s.attendance === "PRESENT" ? s.marks : s.attendance === "ABSENT" ? "AB" : "MP") : ""}</td>
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

export default function Page() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading…</p>}>
      <PrintPractical />
    </Suspense>
  );
}
