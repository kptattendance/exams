"use client";

// Valuation: every written paper of an exam and where it stands.
//   Attendance → Coded → Valuation → Ready to decode → Decoded

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Icon from "../shell/Icon";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { T } from "../ui/table";

export const STAGE = {
  ATTENDANCE: { label: "Mark absentees", chip: "bg-slate-100 text-slate-600" },
  VALUATION: { label: "Valuation", chip: "bg-blue-50 text-blue-700" },
  READY: { label: "Ready to decode", chip: "bg-orange-50 text-orange-700" },
  DECODED: { label: "Decoded", chip: "bg-emerald-50 text-emerald-700" },
};

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

  const departments = [...new Set((data?.data || []).flatMap((p) => p.departments.map((d) => d.toUpperCase())))].sort();
  const q = search.trim().toLowerCase();
  const shown = (data?.data || []).filter(
    (p) =>
      (!stage || p.stage === stage) &&
      (!dept || p.departments.some((d) => d.toUpperCase() === dept)) &&
      (!q || `${p.code} ${p.name}`.toLowerCase().includes(q))
  );

  const doubleEntry = data?.exam?.valuation?.doubleEntry !== false;
  const percent = data?.exam?.valuation?.thirdValuationPercent ?? 15;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Valuation</h2>
      {exams && exams.length > 1 ? (
        <select value={examId} onChange={(e) => setExamId(e.target.value)} className="mt-2 h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
          {exams.map((e) => (
            <option key={e._id} value={e._id}>
              {e.name} · {e.academicYear}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{exams?.[0] ? `${exams[0].name} · ${exams[0].academicYear}` : " "}</p>
      )}

      {data && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span>
            Marks typed <b className="text-slate-900">{doubleEntry ? "twice (double entry)" : "once"}</b>
            {canManage && (
              <button onClick={toggleDouble} className="ml-2 text-xs font-semibold text-blue-700 hover:underline">
                change
              </button>
            )}
          </span>
          <span>
            3rd valuation when 1st & 2nd differ by more than <b className="text-slate-900">{percent}%</b>
          </span>
          <span>
            Papers valued out of <b className="text-slate-900">100</b>, reduced to the subject’s maximum
          </span>
        </div>
      )}

      {exams && exams.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has been created yet.
        </p>
      )}
      {examId && !data && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          {/* stage tiles: click to filter */}
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[["", "All papers"], ...Object.entries(STAGE).map(([k, v]) => [k, v.label])].map(([k, label]) => (
              <button
                key={label}
                onClick={() => setStage(k)}
                className={`rounded-2xl border bg-white px-3 py-2.5 text-left transition ${
                  stage === k ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">
                  {k ? data.data.filter((p) => p.stage === k).length : data.data.length}
                </p>
              </button>
            ))}
          </div>

          {/* filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject code or name" className={`${T.field} w-52 pl-8`} />
            </div>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={T.field}>
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {(stage || dept || search) && (
              <button
                onClick={() => {
                  setStage("");
                  setDept("");
                  setSearch("");
                }}
                className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-slate-500">
              {shown.length} of {data.data.length}
            </span>
          </div>

          <div className={`mt-3 ${T.wrap}`}>
            {shown.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {data.data.length ? "No paper matches these filters." : "No written papers. Register students first."}
              </p>
            )}
            {shown.length > 0 && (
              <table className={T.table}>
                <thead>
                  <tr className={T.headRow}>
                    <th className={T.thNum}>Sl.</th>
                    <th className={T.th}>Exam date</th>
                    <th className={T.th}>Subject</th>
                    <th className={T.th}>Departments</th>
                    <th className={`${T.th} text-right`}>Candidates</th>
                    <th className={`${T.th} text-right`}>Absent</th>
                    <th className={T.th}>Packets entered</th>
                    <th className={T.th}>Stage</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className={T.body}>
                  {shown.map((p, i) => {
                    const href = `${basePath}/${examId}/${encodeURIComponent(p.code)}`;
                    return (
                      <tr key={p.code} className={`${T.row} cursor-pointer`} onClick={() => router.push(href)}>
                        <td className={T.tdNum}>{i + 1}</td>
                        <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
                          {fmtDay(p.date)}
                          {p.session && <span className="block text-[11px] text-slate-400">{p.session === "FN" ? "Morning" : "Afternoon"}</span>}
                        </td>
                        <td className={T.td}>
                          <Link href={href} onClick={(e) => e.stopPropagation()} className="font-semibold text-slate-950 hover:underline">
                            {p.code}
                          </Link>
                          <p className="max-w-[16rem] truncate text-xs text-slate-500">{p.name}</p>
                        </td>
                        <td className={`${T.td} text-xs text-slate-600`}>
                          {p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "Back paper"}
                        </td>
                        <td className={`${T.td} text-right text-xs tabular-nums text-slate-700`}>{p.candidates ?? "–"}</td>
                        <td className={`${T.td} text-right text-xs tabular-nums ${p.absent > 0 ? "font-semibold text-red-600" : "text-slate-400"}`}>
                          {p.absent || 0}
                        </td>
                        <td className={`${T.td} text-xs tabular-nums text-slate-600`}>{p.packets > 0 ? `${p.packetsVerified} / ${p.packets}` : "–"}</td>
                        <td className={T.td}>
                          <span className={`${T.pill} ${STAGE[p.stage].chip}`}>{STAGE[p.stage].label}</span>
                        </td>
                        <td className="pr-3">
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
