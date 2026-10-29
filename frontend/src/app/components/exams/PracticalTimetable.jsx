"use client";

// HOD: practical batches AND time table on one screen.
//   A grid of dates (rows) × the four sessions (columns). "+ Add batch" in a
//   cell: choose the subject, tick the register numbers (30 at a time), the lab
//   and the examiner set → Save. Click a batch to change or delete it.
//   Saving uses the same subject-wise save as the batch page
//   (PUT /practicals/:id/subjects/:code/batches): the same clash checks and
//   the same emails to the examiners.
//   After every student is placed: PDF for students and PDF of examiners.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, SLOTS, dept, sessionLabel, usePracticalExams } from "./practicalShared";

const BATCH_SIZE = 30; // usual size of a batch (a lab); not a hard rule

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const dayName = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
const dateText = (s) => new Date(`${s}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const isSunday = (s) => new Date(`${s}T00:00:00Z`).getUTCDay() === 0;
const range = (list) => (list.length > 2 ? `${list[0]} … ${list[list.length - 1]}` : list.join(", "));

export default function PracticalTimetable() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId, department } = usePracticalExams();
  const [data, setData] = useState(null); // schedule: batches, panels, check
  const [subjects, setSubjects] = useState([]); // practical subjects with counts
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [skipSunday, setSkipSunday] = useState(true);
  const [edit, setEdit] = useState(null); // { code?, number?, date, session }

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const [r, s] = await Promise.all([api("get", `/practicals/${examId}/schedule`), api("get", `/practicals/${examId}/subjects`)]);
      setData(r.data);
      setSubjects(s.data.data || []);
      const dates = r.data.batches.map((b) => b.date).filter(Boolean).sort();
      const start = dates[0] || iso(new Date());
      setFrom((f) => f || start);
      setTo((t) => t || (dates.length ? dates[dates.length - 1] : addDays(start, 13)));
    } catch (e) {
      setData({ batches: [], panels: [], check: [] });
      toast.error(errMsg(e, "Could not load the practical time table."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const batches = useMemo(() => data?.batches || [], [data]);

  // Rows: every date from → to (Sundays optional) and any date already used
  const dates = useMemo(() => {
    const out = new Set();
    if (from && to && from <= to) for (let d = from, n = 0; d <= to && n < 120; d = addDays(d, 1), n++) if (!skipSunday || !isSunday(d)) out.add(d);
    for (const b of batches) if (b.date) out.add(b.date);
    return [...out].sort();
  }, [from, to, skipSunday, batches]);

  if (exams && exams.length === 0)
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
        <NoExam />
      </div>
    );

  const inCell = (date, session) => batches.filter((b) => b.date === date && b.session === session);
  const unplaced = batches.filter((b) => !(b.date && SLOTS.some((s) => s.code === b.session)));
  const left = subjects.reduce((n, s) => n + Math.max(s.candidates - s.assigned, 0), 0);
  const ready = subjects.length > 0 && left === 0 && unplaced.length === 0;
  const pdf = (sheet) => `/print/practical/${examId}?sheet=${sheet}&department=${data?.department || department}&auto=1`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-16 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical batches &amp; time table</h2>
      <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
      {department && <p className="mt-1 text-sm text-slate-500">Practical exams conducted by the {dept(department)} department</p>}

      {examId && data === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          {/* how to – three short lines */}
          <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
            {[
              ["1", "Click + Add batch in a date and time.", false],
              ["2", "Choose the subject, tick the register numbers (30 at a time), lab and examiners → Save.", false],
              ["3", "When every student is placed, download the PDFs.", ready],
            ].map(([n, text, done]) => (
              <li key={n} className={`flex gap-2.5 rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}`}>{done ? "✓" : n}</span>
                <span className="text-slate-700">{text}</span>
              </li>
            ))}
          </ol>

          {/* every subject: how many students are still to be placed */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="flex-1 text-sm font-semibold text-slate-900">Subjects and students left to place</p>
              <a href={pdf("tt-students")} target="_blank" rel="noreferrer" className={btn.small}>
                <Icon name="download" className="h-4 w-4" />
                PDF for students
              </a>
              <a href={pdf("tt-examiners")} target="_blank" rel="noreferrer" className={btn.small}>
                <Icon name="download" className="h-4 w-4" />
                PDF for HOD (examiners)
              </a>
            </div>
            {subjects.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No practical exams for your board. Students must be registered for the examination first.</p>
            ) : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((s) => {
                  const rest = Math.max(s.candidates - s.assigned, 0);
                  const notPermitted = s.registered - s.candidates;
                  return (
                    <li key={s.code} className={`rounded-xl border px-3 py-2 text-sm ${rest ? "border-orange-200 bg-orange-50/70" : "border-emerald-200 bg-emerald-50/60"}`}>
                      <p className="font-semibold text-slate-900">
                        {s.code} <span className="font-normal text-slate-600">{s.name}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {s.assigned} of {s.candidates} placed · {s.batches} batch{s.batches === 1 ? "" : "es"}
                        {rest > 0 ? <b className="text-orange-700"> · {rest} left</b> : s.candidates > 0 && <b className="text-emerald-700"> · all placed ✓</b>}
                      </p>
                      {notPermitted > 0 && <p className="text-[11px] text-slate-500">{notPermitted} not permitted (eligibility / fee) – listed in the HOD PDF</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* batches made earlier without a date / with the old morning-afternoon sessions */}
          {unplaced.length > 0 && (
            <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
              <p className="font-semibold">Batches without a time slot – click one to give it a date and time:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {unplaced.map((b) => (
                  <button
                    key={b._id}
                    onClick={() => setEdit({ code: b.code, number: b.number, date: b.date || "", session: "" })}
                    className="rounded-lg border border-orange-300 bg-white px-2.5 py-1 text-xs font-semibold text-orange-900 hover:bg-orange-100"
                  >
                    {b.code} · Batch {b.number} ({b.count}){b.date ? ` · ${dateText(b.date)} ${sessionLabel(b.session)}` : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* date range */}
          <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end">
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
            <p className="pb-2.5 text-xs text-slate-500 sm:ml-auto">
              {SLOTS[2].label} and {SLOTS[3].label} overlap by half an hour.
            </p>
          </div>

          {/* the grid */}
          <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="w-36 border-b border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700">Date / day</th>
                  {SLOTS.map((s) => (
                    <th key={s.code} className="border-b border-r border-slate-200 px-3 py-2.5 font-semibold text-slate-700 last:border-r-0">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dates.map((d, i) => (
                  <tr key={d} className={`align-top ${i % 2 ? "bg-slate-50/60" : ""}`}>
                    <td className={`border-b border-r border-slate-200 px-3 py-2.5 ${isSunday(d) ? "bg-orange-50" : ""}`}>
                      <p className="font-semibold text-slate-900">{dateText(d)}</p>
                      <p className="text-xs text-slate-500">{dayName(d)}</p>
                    </td>
                    {SLOTS.map((s) => (
                      <td key={s.code} className="border-b border-r border-slate-200 p-2 last:border-r-0">
                        <div className="space-y-2">
                          {inCell(d, s.code).map((b) => (
                            <BatchCard key={b._id} b={b} panels={data.panels} onClick={() => setEdit({ code: b.code, number: b.number, date: d, session: s.code })} />
                          ))}
                          <button
                            onClick={() => setEdit({ date: d, session: s.code })}
                            disabled={subjects.length === 0}
                            className="flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:border-slate-500 hover:text-slate-800 disabled:opacity-40"
                          >
                            <Icon name="plus" className="h-3.5 w-3.5" />
                            Add batch
                          </button>
                        </div>
                      </td>
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

          <p className="mt-3 text-xs text-slate-500">
            Need the subject-wise list or your students in other boards&apos; exams?{" "}
            <a href="/hod/practical/subjects" className="font-semibold text-blue-700 underline">
              Open the subject-wise view
            </a>
          </p>
        </>
      )}

      {edit && (
        <BatchEditor
          examId={examId}
          subjects={subjects}
          start={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BatchCard({ b, panels, onClick }) {
  const done = b.status === "SUBMITTED";
  const panel = panels.find((p) => String(p._id) === String(b.panel || ""));
  const regs = b.students.map((s) => s.registerNumber);
  return (
    <button
      onClick={onClick}
      className={`block w-full rounded-xl border p-2 text-left text-xs leading-snug hover:shadow-sm ${done ? "border-emerald-200 bg-emerald-50" : "border-blue-200 bg-blue-50/60 hover:border-blue-400"}`}
    >
      <b className="text-slate-950">
        {b.code} · Batch {b.number}
      </b>
      <span className="block truncate text-slate-600" title={b.name}>
        {b.name}
      </span>
      <span className="mt-0.5 block font-semibold text-slate-800">
        {b.count} students{b.count < BATCH_SIZE && !done ? <span className="font-normal text-orange-700"> (less than {BATCH_SIZE})</span> : ""}
      </span>
      <span className="block tabular-nums text-slate-500">{range(regs)}</span>
      <span className="block text-slate-600">{b.lab ? `Lab: ${b.lab}` : <span className="text-orange-700">Lab not set</span>}</span>
      <span className="block text-slate-600">{panel ? `Set ${panel.number}: ${panel.internal.name} / ${panel.external.name}` : done ? "" : <span className="text-orange-700">Examiners not chosen</span>}</span>
      {done && <span className="block font-semibold text-emerald-700">Marks submitted</span>}
    </button>
  );
}

// Make a new batch in a slot, or change / delete one.
//   start: { code?, number?, date, session }
function BatchEditor({ examId, subjects, start, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [code, setCode] = useState(start.code || (subjects.length === 1 ? subjects[0].code : ""));
  const [detail, setDetail] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [lab, setLab] = useState("");
  const [panel, setPanel] = useState("");
  const [date, setDate] = useState(start.date || "");
  const [session, setSession] = useState(start.session || "");
  const [branch, setBranch] = useState("");
  const [size, setSize] = useState(String(BATCH_SIZE));
  const [last, setLast] = useState(null); // last clicked, for shift-click ranges
  const [busy, setBusy] = useState(false);
  const [clashes, setClashes] = useState([]);

  const path = code ? `/practicals/${examId}/subjects/${encodeURIComponent(code)}` : "";
  // the parent passes a new onClose each render; loading must not restart because of it
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!path) return;
    let live = true;
    setDetail(null);
    api("get", path)
      .then((r) => {
        if (!live) return;
        const d = r.data.data;
        setDetail(d);
        const mine = start.number ? d.batches.find((b) => b.number === start.number) : null;
        setPicked(new Set((mine?.students || []).map((s) => String(s.registration))));
        setLab(mine?.lab || "");
        setPanel(mine?.panel ? String(mine.panel) : d.panels.length === 1 ? String(d.panels[0]._id) : "");
      })
      .catch((e) => {
        toast.error(errMsg(e, "Could not load the subject."));
        closeRef.current();
      });
    return () => {
      live = false;
    };
  }, [api, path, start.number, toast]);

  const mine = detail && start.number ? detail.batches.find((b) => b.number === start.number) : null;
  const done = mine?.status === "SUBMITTED";
  // students already in another batch of this subject
  const taken = useMemo(() => {
    const m = new Map();
    for (const b of detail?.batches || []) if (b.number !== start.number) for (const s of b.students) m.set(String(s.registration), b.number);
    return m;
  }, [detail, start.number]);
  const candidates = detail?.candidates || [];
  const branches = [...new Set(candidates.map((c) => c.department))].sort();
  const shown = candidates.filter((c) => !taken.has(String(c.registration)) && (!branch || c.department === branch));
  const free = candidates.filter((c) => !taken.has(String(c.registration)));

  const toggle = (id, shift) => {
    setPicked((cur) => {
      const next = new Set(cur);
      if (shift && last) {
        const ids = shown.map((c) => String(c.registration));
        const [a, b] = [ids.indexOf(last), ids.indexOf(id)].sort((x, y) => x - y);
        if (a >= 0 && b >= 0) for (const x of ids.slice(a, b + 1)) next.add(x);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLast(id);
  };
  // the next N students (register-number order) that are not in any batch
  const selectNext = () => {
    const n = Math.max(1, Number(size) || BATCH_SIZE);
    setPicked(new Set(shown.slice(0, n).map((c) => String(c.registration))));
  };

  const save = async (remove = false) => {
    if (!detail) return;
    if (!remove && !picked.size) return toast.error("Tick at least one register number.");
    if (!remove && (!date || !session)) return toast.error("Choose the date and the time.");
    if (remove) {
      const ok = await confirm({
        title: `Delete ${code} batch ${start.number}?`,
        message: "Its students go back to “left to place”. You can put them in another batch.",
        confirmText: "Delete batch",
        tone: "danger",
      });
      if (!ok) return;
    }
    // the whole subject is saved together, as on the batch page
    const open = detail.batches.filter((b) => b.status !== "SUBMITTED");
    const list = open.map((b) => ({ number: b.number, date: b.date, session: b.session, lab: b.lab, panel: b.panel, students: b.students.map((s) => String(s.registration)) }));
    const me = { date, session, lab, panel: panel || null, students: remove ? [] : [...picked] };
    const at = list.findIndex((b) => b.number === start.number);
    if (start.number && at >= 0) list[at] = { ...list[at], ...me };
    else list.push({ number: Math.max(0, ...detail.batches.map((b) => b.number)) + 1, ...me });
    setBusy(true);
    try {
      const r = await api("put", `${path}/batches`, { batches: list });
      toast.success(remove ? "Batch deleted." : r.data.message, 6000);
      onSaved();
    } catch (e) {
      setClashes(e?.response?.data?.clashes || []);
      toast.error(errMsg(e, "Could not save the batch."), 8000);
      setBusy(false);
    }
  };

  const subject = subjects.find((s) => s.code === code);
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      wide
      title={start.number ? `${code} – Batch ${start.number}` : "Add a batch"}
      subtitle={date && session ? `${dateText(date)} (${dayName(date)}) · ${sessionLabel(session)}` : "Choose the date and time"}
      footer={
        <>
          {start.number && !done && (
            <button onClick={() => save(true)} disabled={busy || !detail} className={`${btn.secondary} mr-auto !text-red-700`}>
              <Icon name="trash" className="h-4 w-4" />
              Delete batch
            </button>
          )}
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            {done ? "Close" : "Cancel"}
          </button>
          {!done && (
            <button onClick={() => save(false)} disabled={busy || !detail || !picked.size} className={btn.primary}>
              {busy ? "Checking and saving…" : `Save batch (${picked.size} students)`}
            </button>
          )}
        </>
      }
    >
      {/* subject */}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Subject</span>
        <select value={code} disabled={Boolean(start.number)} onChange={(e) => setCode(e.target.value)} className={`${field} mt-1`}>
          <option value="">Choose the subject</option>
          {subjects.map((s) => (
            <option key={s.code} value={s.code}>
              {s.code} – {s.name} (Sem {s.semester ?? "–"}) · {Math.max(s.candidates - s.assigned, 0)} left
            </option>
          ))}
        </select>
      </label>

      {code && !detail && <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-100" />}

      {detail && done && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">The marks of this batch are submitted, so it cannot be changed.</p>
      )}

      {detail && !done && (
        <>
          {/* when, where, who */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Time</span>
              <select value={session} onChange={(e) => setSession(e.target.value)} className={`${field} mt-1`}>
                <option value="">Choose</option>
                {SLOTS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Lab / room</span>
              <input value={lab} onChange={(e) => setLab(e.target.value)} placeholder="e.g. Computer Lab 2" className={`${field} mt-1`} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Examiners</span>
              {detail.panels.length === 0 ? (
                <p className="mt-1 rounded-xl bg-orange-50 px-3 py-2.5 text-xs text-orange-800">Not allotted by the COE yet – you can choose later.</p>
              ) : (
                <select value={panel} onChange={(e) => setPanel(e.target.value)} className={`${field} mt-1`}>
                  <option value="">Choose the examiner set</option>
                  {detail.panels.map((p) => (
                    <option key={p._id} value={p._id}>
                      Set {p.number}: {p.internal.name} / {p.external.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          </div>

          {/* students */}
          <div className="mt-5 flex flex-wrap items-end gap-2">
            <p className="flex-1 text-sm font-medium text-slate-700">
              Register numbers <span className="font-normal text-slate-500">· {free.length} not in another batch{subject ? ` of ${subject.candidates} permitted` : ""}</span>
            </p>
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              Batch size
              <input type="number" min="1" value={size} onChange={(e) => setSize(e.target.value)} className="h-8 w-16 rounded-lg border border-slate-300 px-2 text-xs" />
            </label>
            <button onClick={selectNext} className={btn.small}>
              Select first {Math.max(1, Number(size) || BATCH_SIZE)}
            </button>
            <button onClick={() => setPicked(new Set(shown.map((c) => String(c.registration))))} className={btn.small}>
              All left
            </button>
            <button onClick={() => setPicked(new Set())} className={btn.small}>
              Clear
            </button>
          </div>
          {branches.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["", ...branches].map((b) => (
                <button key={b || "all"} onClick={() => setBranch(b)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${branch === b ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {b ? b.toUpperCase() : "All branches"}
                </button>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-slate-500">Tick one by one, or tick one and Shift + click another to tick all in between.</p>
          <div className="mt-2 grid max-h-64 grid-cols-2 gap-1.5 overflow-y-auto rounded-xl border border-slate-200 p-2 sm:grid-cols-4">
            {shown.map((c) => {
              const id = String(c.registration);
              const on = picked.has(id);
              return (
                <label
                  key={id}
                  title={c.name}
                  onClick={(e) => {
                    e.preventDefault();
                    toggle(id, e.shiftKey);
                  }}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs ${on ? "border-blue-400 bg-blue-50 font-semibold text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                >
                  <input type="checkbox" readOnly checked={on} className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{c.registerNumber}</span>
                </label>
              );
            })}
            {shown.length === 0 && <p className="col-span-full py-4 text-center text-xs text-slate-500">Every permitted student is already in a batch.</p>}
          </div>
          <p className={`mt-2 text-sm ${picked.size && picked.size < BATCH_SIZE && free.length > picked.size ? "font-semibold text-orange-700" : "text-slate-600"}`}>
            {picked.size} selected
            {picked.size > 0 && picked.size < BATCH_SIZE && free.length > picked.size && ` – a batch usually has at least ${BATCH_SIZE} students.`}
          </p>

          {clashes.length > 0 && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3" role="alert">
              <p className="text-sm font-semibold text-red-900">Not saved – change the date, time, lab or examiners:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-red-900">
                {clashes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
