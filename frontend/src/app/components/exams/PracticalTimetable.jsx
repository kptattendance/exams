"use client";

// HOD: practical exam time table as a grid – dates (rows) × the four sessions
// (columns). In each cell the HOD picks a subject's batch, sees its register
// numbers, sets the lab and the examiner set. The batches themselves are made
// on "Practical batches". Save checks clashes like the batch page.
// After saving: two PDFs – for students (date, time, register numbers) and for
// the HOD (examiners with phone numbers).

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, PracticalSteps, SLOTS, dept, sessionLabel, usePracticalExams } from "./practicalShared";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const dayName = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
const dateText = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const isSunday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay() === 0;

const planOf = (b) => ({ date: b.date || "", session: b.session || "", lab: b.lab || "", panel: b.panel ? String(b.panel) : "" });
const samePlan = (a, b) => a.date === b.date && a.session === b.session && a.lab === b.lab && a.panel === b.panel;

export default function PracticalTimetable() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId, department } = usePracticalExams();
  const [data, setData] = useState(null);
  const [plan, setPlan] = useState({}); // batchId -> { date, session, lab, panel }
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [skipSunday, setSkipSunday] = useState(true);
  const [busy, setBusy] = useState(false);
  const [clashes, setClashes] = useState([]);

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const r = await api("get", `/practicals/${examId}/schedule`);
      setData(r.data);
      setPlan(Object.fromEntries(r.data.batches.map((b) => [b._id, planOf(b)])));
      setClashes([]);
      const dates = r.data.batches.map((b) => b.date).filter(Boolean).sort();
      const start = dates[0] || iso(new Date());
      setFrom((f) => f || start);
      setTo((t) => t || (dates.length ? dates[dates.length - 1] : addDays(start, 13)));
    } catch (e) {
      setData({ batches: [], panels: [] });
      toast.error(errMsg(e, "Could not load the practical time table."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const batches = useMemo(() => data?.batches || [], [data]);
  const panels = data?.panels || [];

  // Rows: every date from → to (Sundays optional) and any date already used
  const dates = useMemo(() => {
    const out = new Set();
    if (from && to && from <= to) for (let d = from, n = 0; d <= to && n < 120; d = addDays(d, 1), n++) if (!skipSunday || !isSunday(d)) out.add(d);
    for (const p of Object.values(plan)) if (p.date) out.add(p.date);
    return [...out].sort();
  }, [from, to, skipSunday, plan]);

  if (exams && exams.length === 0)
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
        <NoExam />
      </div>
    );

  const changed = batches.filter((b) => b.status !== "SUBMITTED" && plan[b._id] && !samePlan(plan[b._id], planOf(b)));
  const dirty = changed.length > 0;
  const unplaced = batches.filter((b) => !(plan[b._id]?.date && plan[b._id]?.session));
  const inCell = (date, session) => batches.filter((b) => plan[b._id]?.date === date && plan[b._id]?.session === session);

  const update = (id, patch) => setPlan((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const place = (id, date, session) => {
    const cur = plan[id] || {};
    // with a single examiner set there is nothing to choose
    update(id, { date, session, panel: cur.panel || (panels.length === 1 ? panels[0]._id : "") });
  };

  // subjects → their batches, for the cell's drop-down
  const subjects = [];
  for (const b of batches) {
    let s = subjects.find((x) => x.code === b.code);
    if (!s) subjects.push((s = { code: b.code, name: b.name, semester: b.semester, batches: [] }));
    s.batches.push(b);
  }

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("put", `/practicals/${examId}/schedule`, {
        department: data.department,
        items: changed.map((b) => ({ batchId: b._id, ...plan[b._id], panel: plan[b._id].panel || null })),
      });
      toast.success(r.data.message, 6000);
      await load();
    } catch (e) {
      setClashes(e?.response?.data?.clashes || []);
      toast.error(errMsg(e, "Could not save the time table."), 8000);
    }
    setBusy(false);
  };

  const pdf = (sheet) => `/print/practical/${examId}?sheet=${sheet}&department=${data?.department || department}&auto=1`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical exam time table</h2>
      <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
      {department && <p className="mt-1 text-sm text-slate-500">Practical exams conducted by the {dept(department)} department</p>}

      {examId && data === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && <PracticalSteps here={2} done={{ batches: batches.length > 0, timetable: batches.length > 0 && unplaced.length === 0 && !dirty }} />}

      {data && (
        <>
          {batches.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
              No batches yet. Make the batches first on{" "}
              <a href="/hod/practical" className="font-semibold text-blue-700 underline">
                Practical batches
              </a>
              , then come back to fix the time table.
            </p>
          ) : (
            <>
              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">From date</span>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-1`} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">To date</span>
                  <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className={`${field} mt-1`} />
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
                  <input type="checkbox" checked={skipSunday} onChange={(e) => setSkipSunday(e.target.checked)} className="h-4 w-4" />
                  Leave out Sundays
                </label>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <a href={dirty ? undefined : pdf("tt-students")} target="_blank" rel="noreferrer" aria-disabled={dirty} className={`${btn.secondary} ${dirty ? "pointer-events-none opacity-40" : ""}`}>
                    <Icon name="download" className="h-4 w-4" />
                    PDF for students
                  </a>
                  <a href={dirty ? undefined : pdf("tt-examiners")} target="_blank" rel="noreferrer" aria-disabled={dirty} className={`${btn.secondary} ${dirty ? "pointer-events-none opacity-40" : ""}`}>
                    <Icon name="download" className="h-4 w-4" />
                    PDF for HOD (examiners)
                  </a>
                </div>
              </div>
              {dirty && <p className="mt-2 text-xs text-orange-700">Save the time table to download the PDFs.</p>}

              {panels.length === 0 && (
                <p className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                  <b>The COE has not allotted examiners to your department yet.</b> You can fix dates now and choose the examiners later.
                </p>
              )}

              <p className="mt-3 text-sm text-slate-600">
                <b className="text-slate-900">{batches.length - unplaced.length}</b> of {batches.length} batches placed
                {unplaced.length > 0 && <span className="font-semibold text-orange-700"> · {unplaced.length} not in the time table yet</span>}
              </p>

              {clashes.length > 0 && (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
                  <p className="text-sm font-semibold text-red-900">Not saved – {clashes.length === 1 ? "a clash" : `${clashes.length} clashes`}. Change the date, session, lab or examiner set.</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
                    {clashes.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="w-36 border-b border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Date / day</th>
                      {SLOTS.map((s) => (
                        <th key={s.code} className="border-b border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700 last:border-r-0">
                          {s.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((d) => (
                      <tr key={d} className="align-top">
                        <td className={`border-b border-r border-slate-200 px-3 py-2.5 ${isSunday(d) ? "bg-orange-50" : ""}`}>
                          <p className="font-semibold text-slate-900">{dateText(d)}</p>
                          <p className="text-xs text-slate-500">{dayName(d)}</p>
                        </td>
                        {SLOTS.map((s) => (
                          <Cell
                            key={s.code}
                            entries={inCell(d, s.code)}
                            plan={plan}
                            panels={panels}
                            subjects={subjects}
                            unplaced={unplaced}
                            onAdd={(id) => place(id, d, s.code)}
                            onChange={update}
                            onRemove={(id) => update(id, { date: "", session: "" })}
                          />
                        ))}
                      </tr>
                    ))}
                    {dates.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                          Choose the from and to dates.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* batches fixed earlier in the old morning / afternoon sessions */}
              {batches.some((b) => ["FN", "AN"].includes(plan[b._id]?.session)) && (
                <p className="mt-3 text-xs text-slate-500">
                  Some batches are still in the old {"“"}Morning / Afternoon{"”"} sessions:{" "}
                  {batches
                    .filter((b) => ["FN", "AN"].includes(plan[b._id]?.session))
                    .map((b) => `${b.label} (${dateText(plan[b._id].date)} ${sessionLabel(plan[b._id].session)})`)
                    .join(", ")}
                  . Add them to a slot above to move them.
                </p>
              )}
              <p className="mt-2 text-xs text-slate-500">
                <b>Note:</b> {SLOTS[2].label} and {SLOTS[3].label} overlap by half an hour, so the same students, lab or examiners cannot be in both.
              </p>
            </>
          )}
        </>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">
              {changed.length} batch{changed.length === 1 ? "" : "es"} changed – not saved yet.
            </p>
            <button onClick={load} disabled={busy} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              Discard
            </button>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50">
              {busy ? "Checking and saving…" : "Save time table"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({ entries, plan, panels, subjects, unplaced, onAdd, onChange, onRemove }) {
  const free = new Set(unplaced.map((b) => b._id));
  const options = subjects.map((s) => ({ ...s, batches: s.batches.filter((b) => free.has(b._id)) })).filter((s) => s.batches.length);
  return (
    <td className="border-b border-r border-slate-200 p-2 last:border-r-0">
      <div className="space-y-2">
        {entries.map((b) => (
          <Entry key={b._id} b={b} p={plan[b._id]} panels={panels} onChange={(patch) => onChange(b._id, patch)} onRemove={() => onRemove(b._id)} />
        ))}
        {options.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && onAdd(e.target.value)}
            aria-label="Add a subject batch"
            className="h-9 w-full rounded-lg border border-dashed border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600 hover:border-slate-400"
          >
            <option value="">+ Subject / batch…</option>
            {options.map((s) => (
              <optgroup key={s.code} label={`${s.code} – ${s.name}`}>
                {s.batches.map((b) => (
                  <option key={b._id} value={b._id}>
                    {s.code} · Batch {b.number} ({b.count} students)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        )}
      </div>
    </td>
  );
}

function Entry({ b, p, panels, onChange, onRemove }) {
  const [show, setShow] = useState(false);
  const done = b.status === "SUBMITTED";
  const panel = panels.find((x) => String(x._id) === p.panel);
  return (
    <div className={`rounded-xl border p-2 ${done ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50/50"}`}>
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-xs leading-snug">
          <b className="text-slate-950">
            {b.code} · Batch {b.number}
          </b>
          <span className="block truncate text-slate-600" title={b.name}>
            {b.name}
          </span>
        </p>
        {!done && (
          <button onClick={onRemove} aria-label={`Remove ${b.label} from this slot`} className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-red-600">
            <Icon name="close" className="h-4 w-4" />
          </button>
        )}
      </div>

      <button onClick={() => setShow((v) => !v)} className="mt-1 text-[11px] font-semibold text-blue-700">
        {show ? "Hide" : "Show"} {b.count} register numbers
      </button>
      {show && (
        <p className="mt-1 max-h-32 overflow-y-auto rounded bg-white px-1.5 py-1 text-[11px] leading-5 tabular-nums text-slate-700">
          {b.students.map((s) => s.registerNumber).join(", ")}
        </p>
      )}

      {done ? (
        <p className="mt-1 text-[11px] font-semibold text-emerald-700">Marks submitted – cannot be moved</p>
      ) : (
        <>
          <input value={p.lab} onChange={(e) => onChange({ lab: e.target.value })} placeholder="Lab / room" aria-label={`Lab of ${b.label}`} className="mt-1.5 h-8 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs" />
          {panels.length > 0 && (
            <select
              value={p.panel}
              onChange={(e) => onChange({ panel: e.target.value })}
              aria-label={`Examiners of ${b.label}`}
              className={`mt-1.5 h-8 w-full rounded-lg border bg-white px-1.5 text-xs ${p.panel ? "border-slate-300" : "border-orange-400 text-orange-700"}`}
            >
              <option value="">Choose examiners…</option>
              {panels.map((x) => (
                <option key={x._id} value={x._id}>
                  Set {x.number}: {x.internal.name} / {x.external.name}
                </option>
              ))}
            </select>
          )}
          {panel && (
            <p className="mt-1 text-[10.5px] leading-snug text-slate-600">
              Int: {panel.internal.name}
              {panel.internal.phone && ` (${panel.internal.phone})`}
              <br />
              Ext: {panel.external.name}
              {panel.external.phone && ` (${panel.external.phone})`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
