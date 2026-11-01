"use client";

// Written-exam timetable – laid out like the sheet it is written on:
//   one row per exam day, a Morning and an Afternoon column, the papers in
//   the cells. Click a paper (from "Papers without a date" or a cell), then
//   click the cell it goes to. × takes it out again. Save → Publish.
// A published timetable can still be changed directly (no "draft" step);
// it must stay without clashes. "List" shows the same papers as a table.
// Clashes (a student with two papers at the same time) show up immediately.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { T } from "../ui/table";

const SESSION = { FN: "Morning", AN: "Afternoon" };

const fmtDay = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : "";

// Same rule as the server (services/exams/timetable.js), run here so problems
// appear the moment a date is changed.
function check(entries, papers, studentCodes) {
  const slotOf = new Map(entries.filter((e) => e.date && e.session).map((e) => [e.code, e]));
  const clashes = new Map();
  const sameDay = new Map();
  for (const idxs of studentCodes) {
    const bySlot = new Map();
    const byDay = new Map();
    for (const i of idxs) {
      const code = papers[i]?.code;
      const e = code && slotOf.get(code);
      if (!e) continue;
      const k = `${e.date}|${e.session}`;
      bySlot.set(k, [...(bySlot.get(k) || []), code]);
      byDay.set(e.date, [...(byDay.get(e.date) || []), code]);
    }
    for (const [k, codes] of bySlot) {
      if (codes.length < 2) continue;
      const key = `${k}|${codes.sort().join(",")}`;
      const [date, session] = k.split("|");
      const c = clashes.get(key) || { date, session, codes, students: 0 };
      c.students++;
      clashes.set(key, c);
    }
    for (const [date, codes] of byDay) {
      if (codes.length < 2 || new Set(codes.map((c) => slotOf.get(c).session)).size < 2) continue;
      const key = `${date}|${codes.sort().join(",")}`;
      const d = sameDay.get(key) || { date, codes, students: 0 };
      d.students++;
      sameDay.set(key, d);
    }
  }
  return {
    clashes: [...clashes.values()].sort((a, b) => a.date.localeCompare(b.date)),
    sameDay: [...sameDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    unscheduled: papers.filter((p) => !slotOf.has(p.code)).map((p) => p.code),
  };
}

export default function Timetable({ examId: fixedExamId, canManage = false, backHref, printBase = "/print/timetable" }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();

  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState(fixedExamId || "");
  const [data, setData] = useState(null);
  const [rows, setRows] = useState({}); // code -> { date, session }
  const [sessions, setSessions] = useState(null);
  const [busy, setBusy] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  // List filters (they do not change the timetable itself)
  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [only, setOnly] = useState(""); // "" | "NO_DATE" | "CLASH"
  const [view, setView] = useState("sheet"); // "sheet" | "list"
  const [picked, setPicked] = useState(null); // paper code being placed / moved
  const [extraDays, setExtraDays] = useState([]); // empty days added on the sheet

  useEffect(() => {
    if (fixedExamId) return;
    (async () => {
      try {
        const r = await api("get", "/exams");
        const list = Array.isArray(r.data?.data) ? r.data.data : [];
        setExams(list);
        if (list[0]) setExamId((id) => id || list[0]._id);
      } catch (e) {
        setExams([]);
        toast.error(errMsg(e, "Could not load examinations."));
      }
    })();
  }, [api, toast, fixedExamId]);

  const apply = (d) => {
    setData(d);
    setRows(Object.fromEntries(d.entries.map((e) => [e.code, { date: e.date, session: e.session, drawing: Boolean(e.drawing) }])));
    setSessions(d.sessions);
  };

  const load = useCallback(async () => {
    if (!examId) return;
    setData(null);
    try {
      const r = await api("get", `/exams/${examId}/timetable`);
      apply(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the timetable."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const entries = useMemo(
    () => Object.entries(rows).filter(([, v]) => v.date).map(([code, v]) => ({ code, date: v.date, session: v.session || "FN", drawing: Boolean(v.drawing) })),
    [rows]
  );
  const problems = useMemo(() => (data ? check(entries, data.papers, data.studentCodes) : null), [entries, data]);
  const clashCodes = useMemo(() => new Set((problems?.clashes || []).flatMap((c) => c.codes)), [problems]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const saved = JSON.stringify([...data.entries].sort((a, b) => a.code.localeCompare(b.code)));
    const now = JSON.stringify([...entries].sort((a, b) => a.code.localeCompare(b.code)));
    return saved !== now || JSON.stringify(sessions) !== JSON.stringify(data.sessions);
  }, [data, entries, sessions]);

  const setRow = (code, patch) => setRows((r) => ({ ...r, [code]: { session: "FN", ...(r[code] || {}), ...patch } }));

  const save = async () => {
    if (data?.published) {
      const ok = await confirm({
        title: "Save the published timetable?",
        message: "The new dates are used at once – on hall tickets printed from now on. Hall tickets already printed show the old dates.",
        confirmText: "Save",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api("put", `/exams/${examId}/timetable`, { entries, sessions });
      apply(r.data.data);
      toast.success("Timetable saved.");
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
    setBusy(false);
  };

  const publish = async (on) => {
    if (dirty) return toast.info("Save your changes first.");
    const ok = await confirm(
      on
        ? {
            title: "Publish the timetable?",
            message: "It becomes final and will be printed on hall tickets. You can still unpublish it to make changes.",
            confirmText: "Publish",
          }
        : {
            title: "Move back to draft?",
            message: "Use this only to correct a mistake. Hall tickets already printed will show the old dates.",
            confirmText: "Move to draft",
            tone: "danger",
          }
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/timetable/publish`, { publish: on });
      apply(r.data.data);
      toast.success(r.data.message);
    } catch (e) {
      toast.error(errMsg(e, "Could not change."), 8000);
    }
    setBusy(false);
  };

  const exam = data?.exam || exams?.find((e) => e._id === examId);
  const published = data?.published;
  const locked = !canManage;

  // papers grouped: Semester 1, Semester 3, … then back papers only
  const departments = useMemo(
    () => [...new Set((data?.papers || []).flatMap((p) => p.departments.map((d) => d.toUpperCase())))].sort(),
    [data]
  );

  const groups = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const g = new Map();
    for (const p of data.papers) {
      if (q && !`${p.code} ${p.name}`.toLowerCase().includes(q)) continue;
      if (dept && !p.departments.some((d) => d.toUpperCase() === dept)) continue;
      if (only === "NO_DATE" && rows[p.code]?.date) continue;
      if (only === "CLASH" && !clashCodes.has(p.code)) continue;
      const label = p.departments.length === 0 ? "Back papers only" : `Semester ${p.semesters.join(" / ")}`;
      if (!g.has(label)) g.set(label, []);
      g.get(label).push(p);
    }
    return [...g.entries()].sort(([a], [b]) => (a.startsWith("Back") ? 1 : b.startsWith("Back") ? -1 : a.localeCompare(b)));
  }, [data, search, dept, only, rows, clashCodes]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      {backHref && (
        <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <Icon name="chevronLeft" className="h-4 w-4" />
          Back to the examination
        </Link>
      )}

      {/* ---------------- header ---------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-slate-950">Time table</h2>
            {data && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                }`}
              >
                {published ? "Published" : "Draft"}
              </span>
            )}
          </div>
          {fixedExamId || !exams || exams.length <= 1 ? (
            <p className="mt-1 text-sm text-slate-500">{exam ? `${exam.name} · ${exam.academicYear}` : " "}</p>
          ) : (
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="mt-2 h-10 max-w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
            >
              {exams.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} · {e.academicYear}
                </option>
              ))}
            </select>
          )}
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            <a href={`${printBase}/${examId}`} target="_blank" rel="noreferrer" className={btn.secondary}>
              <Icon name="report" className="h-4 w-4" />
              Print
            </a>
            {canManage &&
              (published ? (
                <button onClick={() => publish(false)} disabled={busy} className={btn.secondary} title="Only if the timetable must be taken back">
                  Unpublish
                </button>
              ) : (
                <button onClick={() => publish(true)} disabled={busy} className={btn.primary}>
                  <Icon name="check" className="h-4 w-4" strokeWidth={2.25} />
                  Publish
                </button>
              ))}
          </div>
        )}
      </div>

      {exams && exams.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has been created yet.
        </p>
      )}
      {examId && !data && <div className="mt-6 h-72 animate-pulse rounded-2xl bg-white" />}

      {data && data.papers.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No written papers yet. Register students for this exam first.
        </p>
      )}

      {data && data.papers.length > 0 && (
        <>
          {/* ---------------- session times ---------------- */}
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
            {["FN", "AN"].map((k) => (
              <span key={k} className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{SESSION[k]}</span>
                <input
                  type="time"
                  value={sessions[k].start}
                  disabled={locked}
                  onChange={(e) => setSessions((s) => ({ ...s, [k]: { ...s[k], start: e.target.value } }))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm disabled:bg-transparent disabled:border-transparent"
                />
                –
                <input
                  type="time"
                  value={sessions[k].end}
                  disabled={locked}
                  onChange={(e) => setSessions((s) => ({ ...s, [k]: { ...s[k], end: e.target.value } }))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm disabled:bg-transparent disabled:border-transparent"
                />
              </span>
            ))}
          </div>

          {/* ---------------- problems ---------------- */}
          <Problems problems={problems} total={data.papers.length} />

          {/* ---------------- fill automatically ---------------- */}
          {canManage && (
            <AutoFill
              open={autoOpen}
              setOpen={setAutoOpen}
              examId={examId}
              entries={entries}
              onFilled={(list) => {
                // the "drawing" ticks stay as they were
                setRows((old) => Object.fromEntries(list.map((e) => [e.code, { date: e.date, session: e.session, drawing: Boolean(old[e.code]?.drawing) }])));
                setAutoOpen(false);
              }}
            />
          )}

          {/* ---------------- sheet / list ---------------- */}
          <div className="mt-6 inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white text-sm font-semibold">
            {[
              ["sheet", "Sheet (by date)"],
              ["list", "List (by subject)"],
            ].map(([k, l]) => (
              <button key={k} onClick={() => setView(k)} className={`px-4 py-2 ${view === k ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {l}
              </button>
            ))}
          </div>

          {view === "sheet" && (
            <Sheet
              papers={data.papers}
              rows={rows}
              sessions={sessions}
              clashCodes={clashCodes}
              canEdit={!locked}
              picked={picked}
              setPicked={setPicked}
              extraDays={extraDays}
              setExtraDays={setExtraDays}
              place={(code, date, session) => {
                setRow(code, { date, session });
                setPicked(null);
              }}
              remove={(code) => {
                setRow(code, { date: "" });
                setPicked(null);
              }}
            />
          )}

          {view === "list" && (
          <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
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
            <select value={only} onChange={(e) => setOnly(e.target.value)} className={T.field}>
              <option value="">All papers</option>
              <option value="NO_DATE">Without a date</option>
              <option value="CLASH">With a clash</option>
            </select>
            {(search || dept || only) && (
              <button
                onClick={() => {
                  setSearch("");
                  setDept("");
                  setOnly("");
                }}
                className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mt-4 space-y-5">
            {groups.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">No paper matches.</p>
            )}
            {groups.map(([label, papers]) => (
              <section key={label}>
                <h3 className="mb-2 text-sm font-bold text-slate-900">
                  {label} <span className="font-normal text-slate-400">· {papers.length} papers</span>
                </h3>
                <div className={T.wrap}>
                  <table className={T.table}>
                    <thead>
                      <tr className={T.headRow}>
                        <th className={T.thNum}>Sl.</th>
                        <th className={T.th}>Subject</th>
                        <th className={T.th}>Departments</th>
                        <th className={`${T.th} text-right`}>Students</th>
                        <th className={T.th}>Date</th>
                        <th className={T.th}>Session</th>
                        <th className={T.th} title="A drawing paper gets one hour more: 9–1 in the morning, 1–5 in the afternoon">
                          Drawing (+1 h)
                        </th>
                      </tr>
                    </thead>
                    <tbody className={T.body}>
                      {papers.map((p, i) => {
                        const v = rows[p.code] || {};
                        const bad = clashCodes.has(p.code);
                        return (
                          <tr key={p.code} className={`${T.row} ${bad ? "bg-red-50/70" : ""}`}>
                            <td className={T.tdNum}>{i + 1}</td>
                            <td className={T.td}>
                              <p className="font-semibold text-slate-950">
                                {p.code}
                                {bad && <span className={`${T.pill} ml-2 bg-red-100 text-red-700`}>Clash</span>}
                              </p>
                              <p className="max-w-[18rem] truncate text-xs text-slate-500">{p.name}</p>
                            </td>
                            <td className={`${T.td} text-xs text-slate-600`}>
                              {p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "Back paper"}
                            </td>
                            <td className={`${T.td} text-right text-xs tabular-nums text-slate-600`}>
                              {p.candidates}
                              {p.backlog > 0 && p.departments.length > 0 && <span className="block text-[11px] text-slate-400">{p.backlog} back</span>}
                            </td>
                            <td className={T.td}>
                              <input
                                type="date"
                                value={v.date || ""}
                                disabled={locked}
                                onChange={(e) => setRow(p.code, { date: e.target.value })}
                                className={`h-8 w-36 rounded-lg border px-2 text-xs text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50 ${
                                  !v.date ? "border-orange-300 bg-orange-50" : "border-slate-300 bg-white"
                                }`}
                                aria-label={`Date for ${p.code}`}
                              />
                            </td>
                            <td className={T.td}>
                              <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                                {["FN", "AN"].map((k) => (
                                  <button
                                    key={k}
                                    type="button"
                                    disabled={locked || !v.date}
                                    onClick={() => setRow(p.code, { session: k })}
                                    className={`h-8 px-2.5 text-[11px] font-semibold transition disabled:cursor-default ${
                                      v.date && (v.session || "FN") === k ? "bg-slate-950 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                                    }`}
                                  >
                                    {SESSION[k]}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td className={T.td}>
                              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={Boolean(v.drawing)}
                                  disabled={locked || !v.date}
                                  onChange={(e) => setRow(p.code, { drawing: e.target.checked })}
                                  className="h-4 w-4"
                                  aria-label={`${p.code} is a drawing paper`}
                                />
                                {v.drawing && v.date ? (
                                  <span className="font-semibold text-violet-700">{(v.session || "FN") === "AN" ? "1–5 PM" : "9 AM–1 PM"}</span>
                                ) : (
                                  ""
                                )}
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          </>
          )}

          {published && canManage && (
            <p className="mt-6 text-sm text-slate-500">This timetable is published. You can still change it – Save asks once, then the new dates are used.</p>
          )}
        </>
      )}

      {/* ---------------- save bar ---------------- */}
      {canManage && dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">Changes not saved</p>
            <button onClick={() => apply(data)} disabled={busy} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              Discard
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// colour of a paper chip by semester (back-paper-only papers amber)
const SEM_CHIP = {
  1: "border-sky-300 bg-sky-50 text-sky-900",
  2: "border-cyan-300 bg-cyan-50 text-cyan-900",
  3: "border-indigo-300 bg-indigo-50 text-indigo-900",
  4: "border-violet-300 bg-violet-50 text-violet-900",
  5: "border-emerald-300 bg-emerald-50 text-emerald-900",
  6: "border-teal-300 bg-teal-50 text-teal-900",
};
const chipColour = (p) => (!p.departments.length ? "border-amber-300 bg-amber-50 text-amber-900" : SEM_CHIP[p.semesters[0]] || "border-slate-300 bg-white text-slate-900");

function Chip({ p, picked, clash, onPick, onRemove, canEdit }) {
  return (
    <span
      className={`group inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${chipColour(p)} ${clash ? "!border-red-500 ring-2 ring-red-200" : ""} ${
        picked ? "ring-2 ring-slate-900" : ""
      }`}
      title={`${p.code} – ${p.name}\n${p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "Back papers"} · ${p.candidates} students`}
    >
      <button type="button" onClick={onPick} disabled={!canEdit} className="min-w-0 text-left">
        <b>{p.code}</b>
        <span className="ml-1 hidden truncate opacity-75 sm:inline">{p.name.length > 26 ? `${p.name.slice(0, 26)}…` : p.name}</span>
        <span className="ml-1 text-[10px] opacity-70">({p.candidates})</span>
      </button>
      {canEdit && onRemove && (
        <button type="button" onClick={onRemove} className="rounded px-0.5 text-sm leading-none opacity-50 hover:opacity-100" aria-label={`Remove ${p.code} from this day`}>
          ×
        </button>
      )}
    </span>
  );
}

// The timetable as it is written on paper: a row per day, Morning | Afternoon
function Sheet({ papers, rows, sessions, clashCodes, canEdit, picked, setPicked, extraDays, setExtraDays, place, remove }) {
  const [newDay, setNewDay] = useState("");
  const byCode = useMemo(() => new Map(papers.map((p) => [p.code, p])), [papers]);
  const days = useMemo(
    () => [...new Set([...Object.values(rows).filter((v) => v.date).map((v) => v.date), ...extraDays])].sort(),
    [rows, extraDays]
  );
  const inCell = (date, session) =>
    Object.entries(rows)
      .filter(([code, v]) => v.date === date && (v.session || "FN") === session && byCode.has(code))
      .map(([code]) => byCode.get(code))
      .sort((a, b) => (a.semesters[0] || 9) - (b.semesters[0] || 9) || a.code.localeCompare(b.code));
  const waiting = papers.filter((p) => !rows[p.code]?.date);
  const waitingGroups = useMemo(() => {
    const g = new Map();
    for (const p of waiting) {
      const label = !p.departments.length ? "Back papers only" : `Sem ${p.semesters.join("/")}`;
      if (!g.has(label)) g.set(label, []);
      g.get(label).push(p);
    }
    return [...g.entries()].sort(([a], [b]) => (a.startsWith("Back") ? 1 : b.startsWith("Back") ? -1 : a.localeCompare(b, undefined, { numeric: true })));
  }, [waiting]);
  const pickedPaper = picked && byCode.get(picked);
  const time = (k) => `${sessions[k].start} – ${sessions[k].end}`;

  return (
    <div className="mt-4 space-y-4">
      {/* papers still without a date */}
      <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-3">
        <p className="text-sm font-semibold text-orange-900">
          Papers without a date ({waiting.length})
          {canEdit && waiting.length > 0 && <span className="ml-2 font-normal text-orange-800">– click one, then click the day and session it goes to</span>}
        </p>
        {waiting.length === 0 ? (
          <p className="mt-1 text-xs text-emerald-700">Every paper has a date.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {waitingGroups.map(([label, list]) => (
              <div key={label} className="flex flex-wrap items-center gap-1.5">
                <span className="w-24 shrink-0 text-[11px] font-semibold uppercase text-orange-800">{label}</span>
                {list.map((p) => (
                  <Chip key={p.code} p={p} canEdit={canEdit} picked={picked === p.code} onPick={() => setPicked(picked === p.code ? null : p.code)} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {pickedPaper && (
        <p className="sticky top-2 z-20 rounded-xl bg-slate-950 px-4 py-2.5 text-sm text-white shadow-lg">
          Placing <b>{pickedPaper.code}</b> {pickedPaper.name} – click a Morning / Afternoon box below.
          <button onClick={() => setPicked(null)} className="ml-3 font-semibold text-slate-300 underline hover:text-white">
            Cancel
          </button>
        </p>
      )}

      {/* the sheet */}
      <div className="overflow-x-auto rounded-2xl border border-slate-300 bg-white">
        <table className="w-full min-w-[680px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
              <th className="w-36 border-b border-r border-slate-300 px-3 py-2">Date</th>
              <th className="border-b border-r border-slate-300 px-3 py-2">
                Morning <span className="font-normal normal-case text-slate-500">{time("FN")}</span>
              </th>
              <th className="border-b border-slate-300 px-3 py-2">
                Afternoon <span className="font-normal normal-case text-slate-500">{time("AN")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-sm text-slate-500">
                  No exam days yet. Add the first day below (or use “Fill empty dates automatically”).
                </td>
              </tr>
            )}
            {days.map((d) => {
              const dt = new Date(`${d}T00:00:00`);
              const sunday = dt.getDay() === 0;
              return (
                <tr key={d} className="align-top">
                  <td className={`border-b border-r border-slate-300 px-3 py-2 ${sunday ? "bg-red-50" : ""}`}>
                    <p className="font-bold text-slate-900">{dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                    <p className={`text-xs ${sunday ? "font-semibold text-red-600" : "text-slate-500"}`}>{dt.toLocaleDateString("en-IN", { weekday: "long" })}</p>
                  </td>
                  {["FN", "AN"].map((k) => {
                    const list = inCell(d, k);
                    const target = canEdit && pickedPaper;
                    return (
                      <td
                        key={k}
                        onClick={target ? () => place(picked, d, k) : undefined}
                        className={`border-b border-slate-300 px-2 py-2 ${k === "FN" ? "border-r" : ""} ${target ? "cursor-pointer bg-emerald-50/60 hover:bg-emerald-100" : ""}`}
                      >
                        <div className="flex min-h-[2.25rem] flex-wrap gap-1.5" onClick={(e) => target && e.target === e.currentTarget && place(picked, d, k)}>
                          {list.map((p) => (
                            <span key={p.code} onClick={(e) => target && e.stopPropagation()}>
                              <Chip
                                p={p}
                                canEdit={canEdit}
                                clash={clashCodes.has(p.code)}
                                picked={picked === p.code}
                                onPick={() => setPicked(picked === p.code ? null : p.code)}
                                onRemove={() => remove(p.code)}
                              />
                            </span>
                          ))}
                          {target && <span className="self-center text-xs font-semibold text-emerald-700">+ place here</span>}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-700">Add exam day</span>
          <input type="date" value={newDay} onChange={(e) => setNewDay(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" />
          <button
            type="button"
            disabled={!newDay}
            onClick={() => {
              setExtraDays((list) => [...new Set([...list, newDay])]);
              setNewDay("");
            }}
            className={btn.secondary}
          >
            Add
          </button>
          <span className="text-xs text-slate-500">Colours: Sem 1 blue · Sem 3 indigo · Sem 5 green · back papers amber · red border = clash. Hover a paper for its departments.</span>
        </div>
      )}
    </div>
  );
}

function Problems({ problems, total }) {
  if (!problems) return null;
  const { clashes, sameDay, unscheduled } = problems;
  if (!clashes.length && !unscheduled.length) {
    return (
      <p className="mt-5 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        <Icon name="check" className="h-4 w-4" strokeWidth={2.5} />
        All {total} papers have a date and no student has two papers at the same time.
        {sameDay.length > 0 && <span className="font-normal text-emerald-700"> ({sameDay.length} cases of two papers on one day)</span>}
      </p>
    );
  }
  return (
    <div className="mt-5 space-y-2">
      {clashes.map((c, i) => (
        <p key={i} className="flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <b>Clash on {fmtDay(c.date)} {SESSION[c.session].toLowerCase()}:</b> {c.codes.join(" and ")} — {c.students} student
            {c.students > 1 ? "s write" : " writes"} both.
          </span>
        </p>
      ))}
      {unscheduled.length > 0 && (
        <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <b>{unscheduled.length}</b> of {total} papers have no date yet.
        </p>
      )}
    </div>
  );
}

function AutoFill({ open, setOpen, examId, entries, onFilled }) {
  const api = useApi();
  const toast = useToast();
  const [start, setStart] = useState("");
  const [holiday, setHoliday] = useState("");
  const [holidays, setHolidays] = useState([]);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/timetable/suggest`, { startDate: start, holidays, entries });
      const { entries: list, unplaced } = r.data.data;
      onFilled(list);
      toast.success(
        unplaced.length ? `Dates filled. ${unplaced.length} papers could not be placed – set them by hand.` : "Dates filled. Check them, then Save.",
        6000
      );
    } catch (e) {
      toast.error(errMsg(e, "Could not fill dates."));
    }
    setBusy(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 text-sm font-semibold text-blue-700 hover:underline">
        Fill empty dates automatically…
      </button>
    );
  }
  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">Fill empty dates automatically</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Each paper gets the first free day for all its students. Sundays are skipped. Dates you already set are kept. Nothing is
        saved until you click Save.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">First exam date</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} mt-1 h-10 w-44`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Holidays to skip</span>
          <span className="mt-1 flex gap-2">
            <input type="date" value={holiday} onChange={(e) => setHoliday(e.target.value)} className={`${field} h-10 w-44`} />
            <button
              type="button"
              onClick={() => {
                if (holiday && !holidays.includes(holiday)) setHolidays([...holidays, holiday].sort());
                setHoliday("");
              }}
              className={btn.secondary}
            >
              Add
            </button>
          </span>
        </label>
      </div>
      {holidays.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {holidays.map((h) => (
            <button
              key={h}
              onClick={() => setHolidays(holidays.filter((x) => x !== h))}
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
              title="Remove"
            >
              {fmtDay(h)} ✕
            </button>
          ))}
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button onClick={run} disabled={busy || !start} className={btn.primary}>
          {busy ? "Working…" : "Fill dates"}
        </button>
        <button onClick={() => setOpen(false)} className={btn.secondary}>
          Close
        </button>
      </div>
    </div>
  );
}
