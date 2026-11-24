"use client";

// Valuation: every written paper of an exam and where it stands (ATS coding).
//   Before the exam → Valuation (packets made automatically after the session)
//   → Decoded (automatically when every packet is typed and checked)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../shell/Icon";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { T } from "../ui/table";
import { deptTint } from "../ui/deptTint";

export const STAGE = {
  ATTENDANCE: { label: "Before / on exam day", chip: "bg-sky-100 text-sky-800" },
  VALUATION: { label: "Valuation", chip: "bg-yellow-100 text-yellow-900" },
  DECODED: { label: "Decoded", chip: "bg-emerald-100 text-emerald-800" },
};

// each exam date in its own colour
const DATE_TINTS = [
  { cell: "bg-sky-100 text-sky-950", row: "bg-sky-50/60", edge: "border-sky-400" },
  { cell: "bg-emerald-100 text-emerald-950", row: "bg-emerald-50/60", edge: "border-emerald-400" },
  { cell: "bg-violet-100 text-violet-950", row: "bg-violet-50/60", edge: "border-violet-400" },
  { cell: "bg-yellow-100 text-yellow-950", row: "bg-yellow-50/60", edge: "border-yellow-500" },
  { cell: "bg-fuchsia-100 text-fuchsia-950", row: "bg-fuchsia-50/60", edge: "border-fuchsia-400" },
  { cell: "bg-teal-100 text-teal-950", row: "bg-teal-50/60", edge: "border-teal-400" },
  { cell: "bg-indigo-100 text-indigo-950", row: "bg-indigo-50/60", edge: "border-indigo-400" },
  { cell: "bg-lime-100 text-lime-950", row: "bg-lime-50/60", edge: "border-lime-500" },
  { cell: "bg-cyan-100 text-cyan-950", row: "bg-cyan-50/60", edge: "border-cyan-400" },
];

const fmtDay = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" }) : "No date";

export default function ValuationBoard({ basePath, canManage = false }) {
  const api = useApi();
  const toast = useToast();
  const router = useRouter();
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [data, setData] = useState(null);
  const [stage, setStage] = useState("");
  const [dept, setDept] = useState("");
  const [date, setDate] = useState("");
  const [course, setCourse] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await api("get", "/exams");
        const list = Array.isArray(r.data?.data) ? r.data.data : [];
        setExams(list);
        if (list[0]) setExamId(list[0]._id);
      } catch (e) {
        setExams([]);
        toast.error(errMsg(e, "Could not load examinations."));
      }
    })();
  }, [api, toast]);

  const load = useCallback(async () => {
    if (!examId) return;
    setData(null);
    try {
      const r = await api("get", `/exams/${examId}/valuation`);
      setData(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load papers."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleDouble = async () => {
    try {
      await api("patch", `/exams/${examId}/valuation-settings`, { doubleEntry: !(data.exam.valuation?.doubleEntry !== false) });
      toast.success("Saved.");
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
  };

  const all = data?.data || [];
  const departments = [...new Set(all.flatMap((p) => p.departments.map((d) => d.toUpperCase())))].sort();
  const dates = [...new Set(all.map((p) => p.date || ""))].sort((a, b) => (a || "9").localeCompare(b || "9"));
  const tintOf = (d) => DATE_TINTS[dates.indexOf(d || "") % DATE_TINTS.length];
  const courses = all.filter((p) => !date || (p.date || "") === date.replace("none", "")).sort((a, b) => a.code.localeCompare(b.code));
  const q = search.trim().toLowerCase();
  // date by date, morning before afternoon, then course code
  const shown = all
    .filter(
      (p) =>
        (!stage || p.stage === stage) &&
        (!date || (p.date || "") === date.replace("none", "")) &&
        (!course || p.code === course) &&
        (!dept || p.departments.some((d) => d.toUpperCase() === dept)) &&
        (!q || `${p.code} ${p.name}`.toLowerCase().includes(q))
    )
    .sort(
      (a, b) =>
        (a.date || "9").localeCompare(b.date || "9") ||
        (a.session === "AN") - (b.session === "AN") ||
        a.code.localeCompare(b.code)
    );
  const papersOn = (d) => shown.filter((p) => (p.date || "") === (d || ""));

  const doubleEntry = data?.exam?.valuation?.doubleEntry !== false;
  const filtered = stage || date || course || dept || search;

  return (
    <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-950">Valuation</h2>
        {exams && exams.length > 1 ? (
          <select value={examId} onChange={(e) => setExamId(e.target.value)} className={`${T.field} max-w-full`} aria-label="Examination">
            {exams.map((e) => (
              <option key={e._id} value={e._id}>
                {e.name} · {e.academicYear}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-sm text-slate-500">{exams?.[0] ? `${exams[0].name} · ${exams[0].academicYear}` : " "}</p>
        )}
        {data && (
          <span className="text-xs text-slate-600">
            Marks typed <b className="text-slate-900">{doubleEntry ? "twice" : "once"}</b>
            {canManage && (
              <button onClick={toggleDouble} className="ml-1.5 font-semibold text-indigo-700 hover:underline">
                change
              </button>
            )}
            <span className="mx-2 text-slate-300">|</span>
            Out of <b className="text-slate-900">50</b>
          </span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {canManage && examId && (
            <a href={`/print/packet-labels/${examId}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800">
              <Icon name="download" className="h-4 w-4" />
              Packet labels (all)
            </a>
          )}
          <Link href={`${basePath}/packets`} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50">
            <Icon name="list" className="h-4 w-4" />
            Packet tracker
          </Link>
        </div>
      </div>

      {exams && exams.length === 0 && (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has been created yet.
        </p>
      )}
      {examId && !data && <div className="mt-3 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          {/* stage: click to filter */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {[["", "All papers", "bg-slate-200 text-slate-800"], ...Object.entries(STAGE).map(([k, v]) => [k, v.label, v.chip])].map(([k, label, chip]) => (
              <button
                key={label}
                onClick={() => setStage(k)}
                aria-pressed={stage === k}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${chip} ${stage === k ? "ring-2 ring-slate-900" : "hover:opacity-80"}`}
              >
                {label} <b className="ml-1 tabular-nums">{k ? all.filter((p) => p.stage === k).length : all.length}</b>
              </button>
            ))}
          </div>

          {/* filters */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={date}
              onChange={(e) => {
                const next = e.target.value;
                setDate(next);
                // a course that is not on the chosen date is cleared
                if (next && course && !all.some((p) => p.code === course && (p.date || "") === next.replace("none", ""))) setCourse("");
              }}
              className={T.field}
              aria-label="Exam date"
            >
              <option value="">All dates</option>
              {dates.map((d) => (
                <option key={d || "none"} value={d || "none"}>
                  {fmtDay(d)}
                </option>
              ))}
            </select>
            <select value={course} onChange={(e) => setCourse(e.target.value)} className={`${T.field} max-w-[20rem]`} aria-label="Course">
              <option value="">All courses</option>
              {courses.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} – {p.name}
                </option>
              ))}
            </select>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={T.field} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search course" aria-label="Search course" className={`${T.field} w-40 pl-8`} />
            </div>
            {filtered && (
              <button
                onClick={() => {
                  setStage("");
                  setDate("");
                  setCourse("");
                  setDept("");
                  setSearch("");
                }}
                className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">
              {shown.length} of {all.length}
            </span>
          </div>

          <div className={`mt-2 ${T.wrap}`}>
            {shown.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {all.length ? "No paper matches these filters." : "No written papers. Register students first."}
              </p>
            )}
            {shown.length > 0 && (
              <table className={T.table}>
                <thead>
                  <tr className={T.headRow}>
                    <th className={T.th}>Exam date</th>
                    <th className={T.thNum}>Sl.</th>
                    <th className={T.th}>Session</th>
                    <th className={T.th}>Course code</th>
                    <th className={T.th}>Course name</th>
                    <th className={T.th}>Departments</th>
                    <th className={`${T.th} text-right`}>Candidates</th>
                    <th className={`${T.th} text-right`}>Absent</th>
                    <th className={`${T.th} text-right`}>Packets</th>
                    <th className={T.th}>Stage</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody className={T.body}>
                  {shown.map((p, i) => {
                    const href = `${basePath}/${examId}/${encodeURIComponent(p.code)}`;
                    const t = tintOf(p.date);
                    const sameDay = papersOn(p.date);
                    const firstOfDay = sameDay[0] === p;
                    const odd = sameDay.indexOf(p) % 2 === 1;
                    return (
                      <tr key={p.code} className={`${T.row} cursor-pointer ${odd ? t.row : "bg-white"}`} onClick={() => router.push(href)}>
                        {firstOfDay && (
                          <td rowSpan={sameDay.length} onClick={(e) => e.stopPropagation()} className={`cursor-default border-l-4 px-3 py-1 align-top text-xs font-bold whitespace-nowrap ${t.edge} ${t.cell}`}>
                            {fmtDay(p.date)}
                            <span className="block text-[11px] font-medium opacity-75">
                              {sameDay.length} paper{sameDay.length === 1 ? "" : "s"}
                            </span>
                          </td>
                        )}
                        <td className={T.tdNum}>{i + 1}</td>
                        <td className={`${T.td} whitespace-nowrap`}>
                          {p.session ? (
                            <span className={`${T.pill} ${p.session === "FN" ? "bg-orange-100 text-orange-800" : "bg-indigo-100 text-indigo-800"}`}>{p.session === "FN" ? "Morning" : "Afternoon"}</span>
                          ) : (
                            <span className="text-xs text-slate-400">–</span>
                          )}
                        </td>
                        <td className={`${T.td} whitespace-nowrap`}>
                          <Link href={href} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-950 hover:underline">
                            {p.code}
                          </Link>
                        </td>
                        <td className={`${T.td} text-xs text-slate-700`}>{p.name}</td>
                        <td className={`${T.td} text-xs text-slate-600`}>
                          {p.departments.length ? (
                            <span className="flex flex-wrap gap-0.5">
                              {p.departments.map((d) => (
                                <span key={d} className={`rounded px-1 py-0.5 text-[10px] font-bold ${deptTint(d).chip}`}>
                                  {d.toUpperCase()}
                                </span>
                              ))}
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">Back paper</span>
                          )}
                        </td>
                        <td className={`${T.td} text-right text-xs font-semibold tabular-nums text-slate-800`}>{p.candidates ?? "–"}</td>
                        <td className={`${T.td} text-right text-xs tabular-nums ${p.absent > 0 ? "font-semibold text-red-600" : "text-slate-400"}`}>
                          {p.absent || 0}
                        </td>
                        <td className={`${T.td} text-right text-xs tabular-nums text-slate-600`}>{p.packets > 0 ? `${p.packetsVerified} / ${p.packets}` : "–"}</td>
                        <td className={T.td}>
                          <span className={`${T.pill} ${STAGE[p.stage].chip}`}>{STAGE[p.stage].label}</span>
                        </td>
                        <td className="pr-2">
                          <Icon name="chevronRight" className="h-4 w-4 text-slate-300" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
