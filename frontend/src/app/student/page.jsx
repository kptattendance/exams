"use client";

// Student dashboard: his photo and every detail the college has on record –
// read only. Wrong details: tell the HOD / office, who correct them.

import { useEffect, useState } from "react";

import { deptLabel, errMsg, useApi } from "../components/exams/shared";
import { usePopupMessage } from "../components/ui/Feedback";

const dmy = (d) => {
  if (!d) return "";
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? "" : x.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
};
const cap = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

const STATUS = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  passed: "bg-blue-50 text-blue-700 ring-blue-200",
  detained: "bg-orange-50 text-orange-700 ring-orange-200",
};

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
      title: "Academic details",
      rows: [
        ["Register number", me.registerNumber],
        ["Department", me.department ? `${String(me.department).toUpperCase()} – ${deptLabel(me.department)}` : ""],
        ["Semester", me.semester],
        ["Batch", me.batch],
        ["Batch number", me.batchNumber],
        ["Admission year", me.admissionYear],
        ["Admission type", me.admissionLabel],
        ["Status", cap(me.status)],
      ],
    },
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
    <div className="space-y-5">
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
            <p className="mt-0.5 text-sm text-slate-500">
              {me.department ? deptLabel(me.department) : ""}
              {me.semester ? ` · Semester ${me.semester}` : ""}
            </p>
          </div>
          {me.status && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${STATUS[me.status] || "bg-slate-100 text-slate-600 ring-slate-200"}`}>{cap(me.status)}</span>
          )}
        </div>
      </section>

      {/* every detail on record */}
      <div className="grid gap-5 md:grid-cols-2">
        {sections.map((s) => (
          <section key={s.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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
