"use client";

// Valuation: every written paper of an exam and where it stands.
//   Attendance → Coded → Valuation → Ready to decode → Decoded

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

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
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState("");
  const [data, setData] = useState(null);

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
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {data.data.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No written papers. Register students first.</p>}
          <ul className="divide-y divide-slate-100">
            {data.data.map((p) => (
              <li key={p.code}>
                <Link
                  href={`${basePath}/${examId}/${encodeURIComponent(p.code)}`}
                  className="flex flex-col gap-2 px-4 py-3.5 hover:bg-slate-50 sm:flex-row sm:items-center"
                >
                  <div className="w-28 shrink-0 text-xs font-semibold text-slate-500">
                    {fmtDay(p.date)} {p.session && (p.session === "FN" ? "· Morning" : "· Afternoon")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">
                      {p.code} <span className="font-normal text-slate-600">{p.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "Back paper"}
                      {p.candidates !== null && ` · ${p.candidates} candidates`}
                      {p.absent > 0 && ` · ${p.absent} absent`}
                      {p.packets > 0 && ` · packets ${p.packetsVerified}/${p.packets} entered`}
                    </p>
                  </div>
                  <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-center ${STAGE[p.stage].chip}`}>
                    {STAGE[p.stage].label}
                  </span>
                  <Icon name="chevronRight" className="hidden h-5 w-5 text-slate-300 sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
