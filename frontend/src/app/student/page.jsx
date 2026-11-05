"use client";

// Student dashboard: his photo, his details on record and the courses of his
// examination that print on the hall ticket – read only. Anything wrong or
// missing: tell the HOD / office, who check and correct it.

import { useEffect, useState } from "react";

import { errMsg, useApi } from "../components/exams/shared";
import { usePopupMessage } from "../components/ui/Feedback";

const dmy = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
};
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

const KIND = { BACKLOG: ["Back paper", "bg-amber-50 text-amber-800 ring-amber-200"], BRIDGE: ["Bridge course", "bg-violet-50 text-violet-700 ring-violet-200"] };

// the courses that print on his hall ticket
function ExamCourses({ exam }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[#8E0D3C]">My exam courses</h2>
      {!exam ? (
        <p className="mt-3 text-sm leading-6 text-slate-500">You are not registered for an examination yet. Please check again later.</p>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {exam.name}
            {exam.academicYear ? ` · ${exam.academicYear}` : ""}
          </p>
          <p className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
            Below are the courses that will be printed on your hall ticket. Please check them. If any course is missing or wrong, tell your HOD or the college
            office at once.
          </p>
          {exam.subjects.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No courses yet.</p>
          ) : (
            <ol className="mt-3 divide-y divide-slate-100">
              {exam.subjects.map((c, i) => (
                <li key={c.code} className="flex items-start gap-3 py-2.5">
                  <span className="mt-0.5 w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold tabular-nums text-slate-950">{c.code}</p>
                    <p className="break-words text-sm leading-5 text-slate-700">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.semester ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Sem {c.semester}</span> : null}
                      {KIND[c.kind] && <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${KIND[c.kind][1]}`}>{KIND[c.kind][0]}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-right text-xs text-slate-500">
            {exam.subjects.length} course{exam.subjects.length === 1 ? "" : "s"}
          </p>
        </>
      )}
    </section>
  );
}

export default function StudentHome() {
  const api = useApi();
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");
  usePopupMessage(error); // errors are shown as a popup

  useEffect(() => {
    api("get", "/students/me")
      .then((r) => setMe(r.data.data))
      .catch((e) => setError(errMsg(e, "Could not load your details. Please try again.")));
  }, [api]);

  if (error) return <p className="py-10 text-center text-sm text-slate-500">Your details could not be shown. Please sign in again later.</p>;
  if (!me)
    return (
      <div className="space-y-4">
        <div className="h-44 animate-pulse rounded-3xl bg-white" />
        <div className="h-64 animate-pulse rounded-3xl bg-white" />
      </div>
    );

  const sections = [
    {
      title: "Personal details",
      rows: [
        ["Name", me.name],
        ["Father's name", me.fatherName],
        ["Mother's name", me.motherName],
        ["Date of birth", dmy(me.dob)],
        ["Gender", cap(me.gender)],
        ["Category", me.category],
        ["Caste", me.caste],
      ],
    },
    {
      title: "Contact details",
      rows: [["Email", me.email]],
    },
    {
      title: "Identification",
      rows: [
        ["Aadhaar", me.aadhaarNumber],
        ["SATS number", me.satsNumber],
      ],
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* photo and the main details */}
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="h-16 bg-gradient-to-r from-[#1D1842] to-[#8E0D3C] sm:h-20" />
        <div className="flex flex-col items-center gap-4 px-5 pb-6 text-center sm:flex-row sm:items-end sm:gap-6 sm:px-8 sm:text-left">
          {me.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.imageUrl}
              alt={me.name || "Photo"}
              className="-mt-12 h-36 w-28 shrink-0 rounded-2xl border-4 border-white object-cover shadow-md sm:-mt-14 sm:h-40 sm:w-32"
            />
          ) : (
            <div className="-mt-12 flex h-36 w-28 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-slate-100 text-4xl font-bold text-slate-400 shadow-md sm:-mt-14 sm:h-40 sm:w-32">
              {String(me.name || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{me.name}</h1>
            <p className="mt-1 text-base font-semibold tabular-nums text-slate-700">{me.registerNumber}</p>
          </div>
        </div>
      </section>

      <ExamCourses exam={me.exam} />

      {/* every detail on record */}
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-[#8E0D3C]">{s.title}</h2>
            <dl className="mt-3 divide-y divide-slate-100">
              {s.rows.map(([label, value]) => (
                <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
                  <dt className="text-sm text-slate-500">{label}</dt>
                  <dd className="break-all text-right text-sm font-semibold text-slate-900">{value === 0 || value ? value : <span className="font-normal text-slate-400">—</span>}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <p className="px-1 text-center text-xs leading-5 text-slate-500">
        If any detail is wrong, please tell your HOD or the college office – they will correct it.
      </p>
    </div>
  );
}
