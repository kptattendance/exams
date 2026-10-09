"use client";

// Written-exam timetable – kept deliberately simple:
//   one row per paper → pick a date and Morning / Afternoon → Save → Publish.
// Clashes (a student with two papers at the same time) show up immediately.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

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
    setRows(Object.fromEntries(d.entries.map((e) => [e.code, { date: e.date, session: e.session }])));
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
    () => Object.entries(rows).filter(([, v]) => v.date).map(([code, v]) => ({ code, date: v.date, session: v.session || "FN" })),
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
  const groups = useMemo(() => {
    if (!data) return [];
    const g = new Map();
    for (const p of data.papers) {
      const label = p.departments.length === 0 ? "Back papers only" : `Semester ${p.semesters.join(" / ")}`;
      if (!g.has(label)) g.set(label, []);
      g.get(label).push(p);
    }
    return [...g.entries()].sort(([a], [b]) => (a.startsWith("Back") ? 1 : b.startsWith("Back") ? -1 : a.localeCompare(b)));
  }, [data]);

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
                <button onClick={() => publish(false)} disabled={busy} className={btn.secondary}>
                  Move to draft
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
                  disabled={locked || published}
                  onChange={(e) => setSessions((s) => ({ ...s, [k]: { ...s[k], start: e.target.value } }))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm disabled:bg-transparent disabled:border-transparent"
                />
                –
                <input
                  type="time"
                  value={sessions[k].end}
                  disabled={locked || published}
                  onChange={(e) => setSessions((s) => ({ ...s, [k]: { ...s[k], end: e.target.value } }))}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm disabled:bg-transparent disabled:border-transparent"
                />
              </span>
            ))}
          </div>

          {/* ---------------- problems ---------------- */}
          <Problems problems={problems} total={data.papers.length} />

          {/* ---------------- fill automatically ---------------- */}
          {canManage && !published && (
            <AutoFill
              open={autoOpen}
              setOpen={setAutoOpen}
              examId={examId}
              entries={entries}
              onFilled={(list) => {
                setRows(Object.fromEntries(list.map((e) => [e.code, { date: e.date, session: e.session }])));
                setAutoOpen(false);
              }}
            />
          )}

          {/* ---------------- papers ---------------- */}
          <div className="mt-6 space-y-6">
            {groups.map(([label, papers]) => (
              <section key={label}>
                <h3 className="mb-2 text-sm font-bold text-slate-900">{label}</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <ul className="divide-y divide-slate-100">
                    {papers.map((p) => {
                      const v = rows[p.code] || {};
                      const bad = clashCodes.has(p.code);
                      return (
                        <li
                          key={p.code}
                          className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${bad ? "bg-red-50/70" : ""}`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-900">
                              {p.code} <span className="font-normal text-slate-600">{p.name}</span>
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {p.departments.length ? p.departments.map((d) => d.toUpperCase()).join(", ") : "Back paper"} ·{" "}
                              {p.candidates} students
                              {p.backlog > 0 && p.departments.length > 0 && ` (${p.backlog} back paper)`}
                              {bad && <span className="ml-2 font-semibold text-red-600">Clash</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={v.date || ""}
                              disabled={locked || published}
                              onChange={(e) => setRow(p.code, { date: e.target.value })}
                              className={`h-10 w-36 shrink-0 rounded-xl border px-2 text-sm text-slate-900 outline-none focus:border-slate-500 disabled:bg-slate-50 ${
                                !v.date ? "border-orange-300 bg-orange-50" : "border-slate-300 bg-white"
                              }`}
                              aria-label={`Date for ${p.code}`}
                            />
                            <div className="flex shrink-0 overflow-hidden rounded-xl border border-slate-200">
                              {["FN", "AN"].map((k) => (
                                <button
                                  key={k}
                                  type="button"
                                  disabled={locked || published || !v.date}
                                  onClick={() => setRow(p.code, { session: k })}
                                  className={`h-10 px-3 text-xs font-semibold transition disabled:cursor-default ${
                                    v.date && (v.session || "FN") === k ? "bg-slate-950 text-white" : "bg-white text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  {SESSION[k]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}
          </div>

          {published && canManage && (
            <p className="mt-6 text-sm text-slate-500">This timetable is published. To change a date, click “Move to draft” first.</p>
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
