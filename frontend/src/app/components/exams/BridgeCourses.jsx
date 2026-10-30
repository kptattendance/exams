"use client";

// Tick which lateral students take each bridge course.
// Bridge courses are different for PUC, ITI (same course) and ITI (cross course)
// students, and for every department.
// One table: a row per bridge course, a tick column per kind of lateral student;
// filters for department, semester, students and a search.

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
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
  const [sem, setSem] = useState("");
  const [forType, setForType] = useState(""); // a type | "NONE" (not set yet)
  const [q, setQ] = useState("");
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

  const departments = useMemo(() => [...new Set((subjects || []).map((s) => String(s.department).toLowerCase()))].sort(), [subjects]);
  const semesters = useMemo(() => [...new Set((subjects || []).map((s) => s.semester))].sort((a, b) => a - b), [subjects]);

  const shown = (subjects || [])
    .filter(
      (s) =>
        (!dept || String(s.department).toLowerCase() === dept) &&
        (!sem || String(s.semester) === sem) &&
        (!forType || (forType === "NONE" ? typesOf(s).length === 0 : typesOf(s).includes(forType))) &&
        (!q || `${s.code} ${s.name}`.toLowerCase().includes(q.toLowerCase()))
    )
    .sort((a, b) => String(a.department).localeCompare(String(b.department)) || a.semester - b.semester || String(a.code).localeCompare(String(b.code)));

  // tick / untick one kind of student for every subject shown
  const setAll = (t, on) =>
    setChanges((c) => {
      const next = { ...c };
      for (const s of shown) {
        const cur = next[s._id] ?? s.forAdmissionTypes ?? [];
        const list = on ? [...new Set([...cur, t])] : cur.filter((x) => x !== t);
        next[s._id] = TYPES.map(([k]) => k).filter((k) => list.includes(k));
      }
      return next;
    });

  const dirty = Object.keys(changes).filter((id) => {
    const s = subjects?.find((x) => x._id === id);
    return s && JSON.stringify(changes[id]) !== JSON.stringify(s.forAdmissionTypes || []);
  });
  const unset = (subjects || []).filter((s) => typesOf(s).length === 0).length;
  const filtered = Boolean(q || dept || sem || forType);

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

  const sel = "h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Bridge courses</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
        Tick which lateral students study each bridge course. Exam registration uses this together with the student’s
        department, so a branch-changed student automatically gets his new department’s bridge courses.
      </p>

      {subjects === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}
      {subjects && subjects.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No bridge courses yet. Add subjects with category BRIDGE on the Subjects page.
        </p>
      )}

      {subjects && subjects.length > 0 && (
        <>
          {/* filters */}
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code or subject name" className={`${sel} w-56 px-3`} />
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={sel} aria-label="Department">
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d.toUpperCase()} – {deptLabel(d)}
                </option>
              ))}
            </select>
            <select value={sem} onChange={(e) => setSem(e.target.value)} className={sel} aria-label="Semester">
              <option value="">All semesters</option>
              {semesters.map((x) => (
                <option key={x} value={x}>
                  Semester {x}
                </option>
              ))}
            </select>
            <select value={forType} onChange={(e) => setForType(e.target.value)} className={sel} aria-label="Students">
              <option value="">For any students</option>
              {TYPES.map(([t, label]) => (
                <option key={t} value={t}>
                  For {label} students
                </option>
              ))}
              <option value="NONE">Not set yet</option>
            </select>
            {filtered && (
              <button
                onClick={() => {
                  setQ("");
                  setDept("");
                  setSem("");
                  setForType("");
                }}
                className="text-xs font-semibold text-blue-700 hover:underline"
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto flex gap-2 text-xs">
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                {shown.length} of {subjects.length}
              </span>
              {unset > 0 && <span className="rounded-lg bg-orange-50 px-2.5 py-1 font-semibold text-orange-800">{unset} not set yet</span>}
            </span>
          </div>

          {/* the table */}
          <div className="mt-3 max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="w-12 px-3 py-2.5">Sl.</th>
                  <th className="w-20 px-3 py-2.5">Dept</th>
                  <th className="w-16 px-3 py-2.5">Sem</th>
                  <th className="px-3 py-2.5">Subject</th>
                  <th className="w-28 px-3 py-2.5">Exam</th>
                  {TYPES.map(([t, label]) => {
                    const all = shown.length > 0 && shown.every((s) => typesOf(s).includes(t));
                    return (
                      <th key={t} className="w-28 px-3 py-2.5 text-center">
                        <span className="block">{label}</span>
                        {canManage && shown.length > 0 && (
                          <label className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium normal-case text-slate-500" title={`Tick ${label} for every subject shown`}>
                            <input type="checkbox" checked={all} onChange={() => setAll(t, !all)} className="h-3.5 w-3.5" />
                            all shown
                          </label>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((s, i) => {
                  const types = typesOf(s);
                  const changed = dirty.includes(s._id);
                  return (
                    <tr key={s._id} className={`border-t border-slate-100 ${changed ? "bg-blue-50/70" : types.length === 0 ? "bg-orange-50/70" : i % 2 ? "bg-slate-50/50" : ""}`}>
                      <td className="px-3 py-2 tabular-nums text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800">{String(s.department).toUpperCase()}</td>
                      <td className="px-3 py-2 tabular-nums">{s.semester}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold text-slate-900">{s.code}</p>
                        <p className="text-xs text-slate-600">{s.name}</p>
                        {types.length === 0 && <p className="text-[11px] font-semibold text-orange-700">Not set – goes to all laterals</p>}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${s.theoryExamMax > 0 ? "bg-indigo-50 text-indigo-800" : "bg-teal-50 text-teal-800"}`}>
                          {s.theoryExamMax > 0 ? "Written" : "Practical only"}
                        </span>
                      </td>
                      {TYPES.map(([t, label]) => {
                        const on = types.includes(t);
                        return (
                          <td key={t} className="px-3 py-2 text-center">
                            <button
                              disabled={!canManage}
                              onClick={() => toggle(s, t)}
                              aria-pressed={on}
                              aria-label={`${s.code} for ${label} students`}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:cursor-default ${
                                on ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent hover:border-slate-500"
                              }`}
                            >
                              <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      No bridge course matches the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-orange-200" /> not set yet (goes to all laterals)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-200" /> changed, not saved
            </span>
          </p>
        </>
      )}

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
