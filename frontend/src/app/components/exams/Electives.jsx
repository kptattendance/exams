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
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.groups.map((g) => (
              <div key={g.group} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold text-slate-500">Group {g.group}</p>
                <ul className="mt-2 space-y-2">
                  {g.subjects.map((s) => {
                    const n = data.students.filter((st) => choices[st._id]?.[g.group] === s._id).length;
                    return (
                      <li key={s._id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">
                          <b>{s.code}</b> <span className="text-slate-600">{s.name}</span>
                        </span>
                        <span className="tabular-nums text-xs text-slate-500">{n}</span>
                        <button onClick={() => setAll(g.group, s._id, s.code)} className={btn.small} title={`Give ${s.code} to all`}>
                          All
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {missing > 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-xl bg-orange-50 px-3 py-2 text-sm font-medium text-orange-800">
              <Icon name="alert" className="h-4 w-4" />
              {missing} student{missing > 1 ? "s have" : " has"} no elective chosen yet.
            </p>
          )}

          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                    <th className="px-4 py-2.5">Student</th>
                    {data.groups.map((g) => (
                      <th key={g.group} className="px-3 py-2.5">
                        Group {g.group}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((st) => (
                    <tr key={st._id}>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-slate-900">{st.name}</p>
                        <p className="text-xs tabular-nums text-slate-500">{st.registerNumber}</p>
                      </td>
                      {data.groups.map((g) => {
                        const v = choices[st._id]?.[g.group] || "";
                        const dirty = (original[st._id]?.[g.group] || "") !== v;
                        return (
                          <td key={g.group} className="px-3 py-2">
                            <select
                              value={v}
                              onChange={(e) => setChoice(st._id, g.group, e.target.value)}
                              className={`h-10 w-full rounded-xl border px-2 text-sm ${
                                dirty ? "border-blue-500 bg-blue-50" : v ? "border-slate-200 bg-white" : "border-orange-300 bg-orange-50"
                              }`}
                            >
                              <option value="">– not chosen –</option>
                              {g.subjects.map((s) => (
                                <option key={s._id} value={s._id}>
                                  {s.code} {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {data.students.length === 0 && (
                    <tr>
                      <td colSpan={data.groups.length + 1} className="px-4 py-8 text-center text-slate-500">
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
