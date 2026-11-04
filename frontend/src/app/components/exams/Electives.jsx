"use client";

// HOD: choose each student's elective. Exam registration then registers the
// student only for the elective he studies.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { DEPARTMENTS, errMsg, useApi } from "./shared";

export default function Electives({ fixedDepartment = false }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();

  const [department, setDepartment] = useState(fixedDepartment ? "" : "cs");
  const [overview, setOverview] = useState(null);
  const [semester, setSemester] = useState(null);
  const [data, setData] = useState(null);
  const [choices, setChoices] = useState({}); // studentId -> {group: subjectId}
  const [saving, setSaving] = useState(false);

  const deptParam = fixedDepartment ? {} : { department };

  const loadOverview = useCallback(async () => {
    setOverview(null);
    try {
      const r = await api("get", "/electives/overview", undefined, { params: deptParam });
      setOverview(r.data.data);
      const first = r.data.data.semesters[0]?.semester ?? null;
      setSemester((s) => (r.data.data.semesters.some((x) => x.semester === s) ? s : first));
    } catch (e) {
      setOverview({ semesters: [] });
      toast.error(errMsg(e, "Could not load electives."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, toast, department]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const loadSemester = useCallback(async () => {
    if (!semester) return setData(null);
    setData(null);
    try {
      const r = await api("get", "/electives", undefined, { params: { ...deptParam, semester } });
      setData(r.data.data);
      setChoices(r.data.data.choices || {});
    } catch (e) {
      toast.error(errMsg(e, "Could not load students."));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, toast, semester, department]);

  useEffect(() => {
    loadSemester();
  }, [loadSemester]);

  const original = data?.choices || {};
  const changed = [];
  if (data) {
    for (const st of data.students) {
      for (const g of data.groups) {
        const a = original[st._id]?.[g.group] || "";
        const b = choices[st._id]?.[g.group] || "";
        if (a !== b) changed.push({ studentId: st._id, group: g.group, subjectId: b || null });
      }
    }
  }

  const setChoice = (sid, group, subjectId) =>
    setChoices((c) => ({ ...c, [sid]: { ...(c[sid] || {}), [group]: subjectId } }));

  const setAll = async (group, subjectId, code) => {
    const ok = await confirm({
      title: `Give ${code} to every student?`,
      message: `All ${data.students.length} students of semester ${semester} get ${code} for group ${group}. You can still change single students afterwards.`,
      confirmText: "Set for all",
    });
    if (!ok) return;
    setChoices((c) => {
      const next = { ...c };
      for (const st of data.students) next[st._id] = { ...(next[st._id] || {}), [group]: subjectId };
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api("put", "/electives", { ...deptParam, semester, choices: changed });
      toast.success(r.data.message || "Saved.");
      await loadSemester();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
    setSaving(false);
  };

  const missing = data
    ? data.students.filter((st) => data.groups.some((g) => !(choices[st._id]?.[g.group]))).length
    : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Electives</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Choose the elective each student studies. Students are registered for exams only in the elective chosen here.
          </p>
        </div>
        {!fixedDepartment && (
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
          >
            {DEPARTMENTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.value.toUpperCase()} – {d.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {overview === null && <div className="mt-6 h-48 animate-pulse rounded-2xl bg-white" />}
      {overview && overview.semesters.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          This department has no elective subjects. Electives are subjects with category ELECTIVE and an elective group.
        </p>
      )}

      {overview && overview.semesters.length > 0 && (
        <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
          {overview.semesters.map((s) => (
            <button
              key={s.semester}
              onClick={() => setSemester(s.semester)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${
                semester === s.semester ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Semester {s.semester}
              <span className="ml-1.5 text-xs font-medium text-slate-400">{s.groups.length} group{s.groups.length > 1 ? "s" : ""}</span>
            </button>
          ))}
        </div>
      )}

      {semester && !data && overview?.semesters.length > 0 && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          {missing > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800">
              <Icon name="alert" className="h-4 w-4" />
              {missing} student{missing > 1 ? "s have" : " has"} no elective chosen yet.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Tick the elective each student studies. “All” gives one subject to every student – then change the few who study the other one, and Save.
          </p>

          {/* one row per student, one column per elective subject (grouped) */}
          <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-800 text-left text-xs text-white">
                    <th rowSpan={2} className="border-r border-slate-600 px-3 py-2">Sl.</th>
                    <th rowSpan={2} className="border-r border-slate-600 px-3 py-2">Student</th>
                    {data.groups.map((g) => (
                      <th key={g.group} colSpan={g.subjects.length} className="border-b border-r border-slate-600 px-3 py-1.5 text-center">
                        Elective group {g.group}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-slate-700 text-xs text-white">
                    {data.groups.flatMap((g) =>
                      g.subjects.map((s) => {
                        const n = data.students.filter((st) => choices[st._id]?.[g.group] === s._id).length;
                        return (
                          <th key={s._id} className="min-w-[150px] border-r border-slate-600 px-2 py-1.5 text-center align-top font-normal">
                            <p className="font-bold">{s.code}</p>
                            <p className="line-clamp-2 text-[10px] text-slate-300">{s.name}</p>
                            <p className="mt-1 flex items-center justify-center gap-1.5">
                              <span className="rounded bg-slate-600 px-1.5 py-0.5 text-[10px] tabular-nums">{n} students</span>
                              <button onClick={() => setAll(g.group, s._id, s.code)} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-900 hover:bg-slate-200" title={`Give ${s.code} to all`}>
                                All
                              </button>
                            </p>
                          </th>
                        );
                      })
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((st, n) => {
                    const none = data.groups.some((g) => !choices[st._id]?.[g.group]);
                    return (
                      <tr key={st._id} className={none ? "bg-orange-50/50" : n % 2 ? "bg-slate-50/60" : ""}>
                        <td className="border-r border-slate-100 px-3 py-2 text-xs tabular-nums text-slate-400">{n + 1}</td>
                        <td className="border-r border-slate-100 px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            {st.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={st.imageUrl} alt={st.name} className="h-10 w-10 shrink-0 cursor-zoom-in rounded-full border border-slate-200 object-cover" />
                            ) : (
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-500">
                                {String(st.name || "S").charAt(0)}
                              </span>
                            )}
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{st.name}</p>
                              <p className="text-xs tabular-nums text-slate-500">
                                {st.registerNumber}
                                {String(st.admissionType || "").startsWith("lateral") && <span className="ml-1.5 rounded bg-violet-100 px-1 text-[10px] text-violet-800">Lateral</span>}
                                {st.admissionType === "branch-change" && <span className="ml-1.5 rounded bg-teal-100 px-1 text-[10px] text-teal-800">Branch change</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        {data.groups.flatMap((g) =>
                          g.subjects.map((s) => {
                            const on = choices[st._id]?.[g.group] === s._id;
                            const dirty = (original[st._id]?.[g.group] || "") !== (choices[st._id]?.[g.group] || "");
                            return (
                              <td key={s._id} className={`border-r border-slate-100 px-2 py-2 text-center ${on ? (dirty ? "bg-blue-50" : "bg-emerald-50") : ""}`}>
                                <label className="inline-flex cursor-pointer items-center justify-center p-1.5">
                                  <input
                                    type="radio"
                                    name={`${st._id}-${g.group}`}
                                    checked={on}
                                    onChange={() => setChoice(st._id, g.group, s._id)}
                                    className="h-5 w-5 accent-emerald-600"
                                    aria-label={`${st.name}: ${s.code}`}
                                  />
                                </label>
                              </td>
                            );
                          })
                        )}
                      </tr>
                    );
                  })}
                  {data.students.length === 0 && (
                    <tr>
                      <td colSpan={2 + data.groups.reduce((a, g) => a + g.subjects.length, 0)} className="px-4 py-8 text-center text-slate-500">
                        No active students in semester {semester}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {changed.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">
              {changed.length} change{changed.length > 1 ? "s" : ""} not saved
            </p>
            <button
              onClick={() => setChoices(original)}
              disabled={saving}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white"
            >
              Discard
            </button>
            <button onClick={save} disabled={saving} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
