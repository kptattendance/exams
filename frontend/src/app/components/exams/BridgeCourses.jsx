"use client";

// Tick which lateral students take each bridge course.
// Bridge courses are different for PUC, ITI (same course) and ITI (cross course)
// students, and for every department.

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";

const TYPES = [
  ["lateral-puc", "PUC"],
  ["lateral-iti", "ITI same"],
  ["lateral-iti-cross", "ITI cross"],
];

export default function BridgeCourses({ canManage = true }) {
  const api = useApi();
  const toast = useToast();
  const [subjects, setSubjects] = useState(null);
  const [changes, setChanges] = useState({}); // id -> [types]
  const [dept, setDept] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/exams/setup/bridge-courses");
      setSubjects(Array.isArray(r.data?.data) ? r.data.data : []);
    } catch (e) {
      setSubjects([]);
      toast.error(errMsg(e, "Could not load bridge courses."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const typesOf = (s) => changes[s._id] ?? s.forAdmissionTypes ?? [];
  const toggle = (s, t) => {
    const cur = typesOf(s);
    const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    setChanges((c) => ({ ...c, [s._id]: TYPES.map(([k]) => k).filter((k) => next.includes(k)) }));
  };

  const departments = useMemo(
    () => [...new Set((subjects || []).map((s) => String(s.department).toLowerCase()))],
    [subjects]
  );
  const shown = (subjects || []).filter((s) => !dept || String(s.department).toLowerCase() === dept);
  const grouped = useMemo(() => {
    const g = {};
    for (const s of shown) {
      const k = `${String(s.department).toLowerCase()}|${s.semester}`;
      (g[k] ||= []).push(s);
    }
    return Object.entries(g);
  }, [shown]);

  const dirty = Object.keys(changes).filter((id) => {
    const s = subjects?.find((x) => x._id === id);
    return s && JSON.stringify(changes[id]) !== JSON.stringify(s.forAdmissionTypes || []);
  });
  const unset = (subjects || []).filter((s) => typesOf(s).length === 0).length;

  const save = async () => {
    setSaving(true);
    try {
      const r = await api("put", "/exams/setup/bridge-courses", {
        updates: dirty.map((id) => ({ id, forAdmissionTypes: changes[id] })),
      });
      toast.success(`${r.data.message} Refresh registration in the exam to apply.`, 7000);
      setChanges({});
      await load();
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Bridge courses</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
        Tick which lateral students study each bridge course. Exam registration uses this together with the student’s
        department, so a branch-changed student automatically gets his new department’s bridge courses.
      </p>

      {subjects && subjects.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setDept("")}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!dept ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
          >
            All
          </button>
          {departments.map((d) => (
            <button
              key={d}
              onClick={() => setDept(d)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${dept === d ? "bg-slate-950 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
            >
              {d.toUpperCase()}
            </button>
          ))}
          {unset > 0 && (
            <span className="ml-auto rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-800">
              {unset} not set yet
            </span>
          )}
        </div>
      )}

      {subjects === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}
      {subjects && subjects.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No bridge courses yet. Add subjects with category BRIDGE on the Subjects page.
        </p>
      )}

      <div className="mt-5 space-y-5">
        {grouped.map(([key, list]) => {
          const [d, sem] = key.split("|");
          return (
            <div key={key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
                <p className="font-semibold text-slate-900">
                  {d.toUpperCase()} · Semester {sem}
                  <span className="ml-2 text-sm font-normal text-slate-500">{deptLabel(d)}</span>
                </p>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((s) => {
                  const types = typesOf(s);
                  const changed = dirty.includes(s._id);
                  return (
                    <li key={s._id} className={`flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center ${changed ? "bg-blue-50/50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">
                          {s.code} <span className="font-normal text-slate-600">{s.name}</span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {s.theoryExamMax > 0 ? "Written exam" : "Practical only"}
                          {types.length === 0 && <span className="ml-2 font-semibold text-orange-700">Not set – goes to all laterals</span>}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {TYPES.map(([t, label]) => {
                          const on = types.includes(t);
                          return (
                            <button
                              key={t}
                              disabled={!canManage}
                              onClick={() => toggle(s, t)}
                              aria-pressed={on}
                              className={`flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-default ${
                                on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400"
                              }`}
                            >
                              {on && <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      {canManage && dirty.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">
              {dirty.length} change{dirty.length > 1 ? "s" : ""} not saved
            </p>
            <button onClick={() => setChanges({})} disabled={saving} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
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
