"use client";

// COE dashboard – real numbers of the running examination: students,
// subjects, registrations and eligibility, hall tickets, question papers
// (theory) and practical marks. Each figure comes from the same data the
// COE pages use; a figure that cannot be loaded shows "–".

import Link from "next/link";
import { useEffect, useState } from "react";

import Icon from "../components/shell/Icon";
import { useAcademicYear } from "../components/academicYear";
import { useApi } from "../components/exams/shared";

const list = (r) => (r?.status === "fulfilled" ? r.value?.data?.data || r.value?.data?.students || r.value?.data?.subjects || [] : null);

export default function COEDashboard() {
  const api = useApi();
  const academicYear = useAcademicYear();
  const [d, setD] = useState(null);

  useEffect(() => {
    (async () => {
      const [ex, st, sub, ps] = await Promise.allSettled([
        api("get", "/exams"),
        api("get", "/students"),
        api("get", "/subjects/getsubjects"),
        api("get", "/paper-setting"),
      ]);
      const exams = list(ex) || [];
      // the running examination: the newest that is not completed
      const exam = exams.find((e) => e.status !== "COMPLETED") || null;
      const students = list(st);
      const subjects = list(sub);
      const papers = (list(ps) || []).filter((p) => p.status !== "CANCELLED");

      let tickets = null;
      let practical = null;
      if (exam) {
        const [ht, pr] = await Promise.allSettled([
          api("get", `/exams/${exam._id}/hall-tickets`, undefined, { params: { limit: 1 } }),
          api("get", `/practicals/${exam._id}/office`),
        ]);
        if (ht.status === "fulfilled") tickets = ht.value.data.counts || null;
        if (pr.status === "fulfilled") {
          const subs = pr.value.data.subjects || [];
          const by = (k) => subs.filter((s) => s.status === k).length;
          practical = { subjects: subs.length, entered: by("ENTERED"), partly: by("PARTLY"), pending: by("PENDING"), notScheduled: by("NOT_SCHEDULED"), batches: (pr.value.data.batches || []).length };
        }
      }

      const byStatus = (k) => papers.filter((p) => p.status === k).length;
      setD({
        exam,
        examsLoaded: ex.status === "fulfilled",
        students: students ? { total: students.length, active: students.filter((s) => (s.status || "active") === "active").length } : null,
        subjects: subjects ? subjects.length : null,
        papers: ps.status === "fulfilled" ? { total: papers.length, submitted: byStatus("SUBMITTED"), uploaded: byStatus("UPLOADED"), returned: byStatus("RETURNED"), assigned: byStatus("ASSIGNED") } : null,
        tickets,
        practical,
      });
    })();
  }, [api]);

  const s = d?.exam?.stats;
  const loading = d === null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-600">Controller of Examinations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Examination Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Loading… please wait" : d.exam ? `Running examination: ${d.exam.name}` : d.examsLoaded ? "No examination is running right now." : "Could not load the examinations."}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Academic year</p>
          <p className="text-sm font-bold text-slate-900">{academicYear}</p>
        </div>
      </div>

      {/* the institution */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Students" value={d?.students?.active} sub={d?.students ? `${d.students.total} in all (incl. not active)` : ""} href="/coe/students" loading={loading} />
        <Stat label="Subjects" value={d?.subjects} sub="all departments" href="/coe/subjects" loading={loading} />
        <Stat label="Registered for the exam" value={s?.students} sub={d?.exam ? d.exam.name : "no running exam"} href="/coe/exams" loading={loading} />
        <Stat
          label="Hall tickets ready"
          value={d?.tickets ? d.tickets.ready : undefined}
          sub={d?.tickets ? `${d.tickets.notReady} not ready yet` : ""}
          href="/coe/hall-tickets"
          loading={loading}
          tone={d?.tickets?.notReady ? "orange" : "green"}
        />
      </div>

      {/* eligibility of the registered students */}
      {d?.exam && s && (
        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">Eligibility – {d.exam.name}</h2>
          <Bar
            total={s.students || 0}
            parts={[
              ["All subjects eligible", s.ALL_CLEAR || 0, "bg-emerald-500"],
              ["Partly eligible", s.PARTIAL || 0, "bg-yellow-400"],
              ["Not eligible", s.BLOCKED || 0, "bg-red-500"],
              ["Not decided yet", s.PENDING || 0, "bg-slate-300"],
            ]}
          />
        </section>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* theory */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-sm font-bold text-slate-900">Theory – question papers</h2>
            <Link href="/coe/paper-setting" className="text-xs font-semibold text-blue-700 hover:underline">
              Open →
            </Link>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-slate-400">Loading… please wait</p>
          ) : !d.papers ? (
            <p className="mt-3 text-sm text-slate-400">–</p>
          ) : d.papers.total === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No paper setter is assigned yet.</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {d.papers.submitted} <span className="text-sm font-semibold text-slate-500">of {d.papers.total} papers submitted</span>
              </p>
              <Bar
                total={d.papers.total}
                parts={[
                  ["Submitted", d.papers.submitted, "bg-emerald-500"],
                  ["Uploaded (draft)", d.papers.uploaded, "bg-blue-400"],
                  ["Sent back", d.papers.returned, "bg-yellow-400"],
                  ["Not uploaded yet", d.papers.assigned, "bg-slate-300"],
                ]}
              />
            </>
          )}
        </section>

        {/* practical */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="flex-1 text-sm font-bold text-slate-900">Practical – marks entry</h2>
            <Link href="/coe/practical-exam-marks" className="text-xs font-semibold text-blue-700 hover:underline">
              Open →
            </Link>
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-slate-400">Loading… please wait</p>
          ) : !d.practical ? (
            <p className="mt-3 text-sm text-slate-400">{d.exam ? "–" : "No running examination."}</p>
          ) : d.practical.subjects === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No practical subjects in this examination.</p>
          ) : (
            <>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {d.practical.entered} <span className="text-sm font-semibold text-slate-500">of {d.practical.subjects} subjects fully entered · {d.practical.batches} batches</span>
              </p>
              <Bar
                total={d.practical.subjects}
                parts={[
                  ["Entered", d.practical.entered, "bg-emerald-500"],
                  ["Partly entered", d.practical.partly, "bg-yellow-400"],
                  ["Pending", d.practical.pending, "bg-orange-400"],
                  ["No batches yet", d.practical.notScheduled, "bg-slate-300"],
                ]}
              />
            </>
          )}
        </section>
      </div>

      {/* quick links – only pages that exist */}
      <section className="mt-5">
        <h2 className="text-sm font-bold text-slate-900">Quick links</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Examinations", "/coe/exams", "paper"],
            ["Time table", "/coe/timetable", "calendar"],
            ["Hall tickets", "/coe/hall-tickets", "ticket"],
            ["Paper setting", "/coe/paper-setting", "lock"],
            ["Valuation", "/coe/valuation", "valuation"],
            ["Marks entry", "/coe/marks-entry", "marks"],
            ["Practical Examiners", "/coe/practical-exam-marks", "paper"],
            ["Results", "/coe/results", "results"],
          ].map(([label, href, icon]) => (
            <Link key={href} href={href} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400">
              <Icon name={icon} className="h-4 w-4 text-slate-500" />
              {label}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, sub, href, loading, tone }) {
  const color = tone === "orange" ? "text-orange-700" : tone === "green" ? "text-emerald-700" : "text-slate-950";
  return (
    <Link href={href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-400">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      {loading ? (
        <p className="mt-2 text-sm font-semibold text-slate-400">Loading…</p>
      ) : (
        <p className={`mt-1 text-2xl font-bold tabular-nums ${value === undefined || value === null ? "text-slate-400" : color}`}>{value === undefined || value === null ? "–" : value}</p>
      )}
      {sub && <p className="mt-0.5 truncate text-[11px] text-slate-400">{sub}</p>}
    </Link>
  );
}

// one horizontal bar split into parts, with a legend
function Bar({ total, parts }) {
  return (
    <div className="mt-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {total > 0 && parts.map(([label, n, color]) => (n > 0 ? <span key={label} className={color} style={{ width: `${(n / total) * 100}%` }} title={`${label}: ${n}`} /> : null))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {parts.map(([label, n, color]) => (
          <li key={label} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            {label}: <b className="text-slate-900">{n}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
