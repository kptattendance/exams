"use client";

// HOD: the practical exams his board conducts (for the students of every branch).
//   The COE allots the examiner sets of the department. The HOD contacts them,
//   then: pick a subject → say how many batches → move students if needed →
//   fix date / session / lab (and the examiner set) → Save.
//   A time table with a clash is not saved.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, batchState, branches, dept, examinersOf, usePracticalExams, when } from "./practicalShared";

export default function PracticalBatches() {
  const api = useApi();
  const toast = useToast();
  const { exams, examId, setExamId, department } = usePracticalExams();
  const [data, setData] = useState(null);
  const [elsewhere, setElsewhere] = useState([]); // other boards' batches with our students
  const [open, setOpen] = useState(null); // subject code

  const load = useCallback(async () => {
    if (!examId) return;
    setData(null);
    try {
      const r = await api("get", `/practicals/${examId}/subjects`);
      setData(r.data);
      const own = r.data.department;
      // the list above still works if this second request fails
      api("get", `/practicals/${examId}/batches`, undefined, { params: { branch: own } })
        .then((b) => setElsewhere(b.data.data.filter((x) => x.department !== own && x.own?.length)))
        .catch(() => setElsewhere([]));
    } catch (e) {
      setData({ data: [], panels: [] });
      toast.error(errMsg(e, "Could not load the practical subjects."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (open)
    return (
      <SubjectBatches
        examId={examId}
        code={open}
        onClose={() => {
          setOpen(null);
          load();
        }}
      />
    );

  const list = data?.data;
  const panels = data?.panels || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical exam batches</h2>
      <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />
      {department && <p className="mt-1 text-sm text-slate-500">Practical exams conducted by the {dept(department)} department, for the students of every branch</p>}

      {exams && exams.length === 0 && <NoExam />}
      {examId && data === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${panels.length ? "border-slate-200 bg-white text-slate-600" : "border-orange-200 bg-orange-50 text-orange-900"}`}>
          {panels.length === 0 ? (
            <p>
              <b>The COE has not allotted examiners to your department yet.</b> You can make the batches now. Fix the dates after the examiners are allotted – you will get an email.
            </p>
          ) : (
            <>
              <p className="font-semibold text-slate-900">Your examiners (allotted by the COE) – contact them and fix the dates</p>
              <ul className="mt-1 space-y-1">
                {panels.map((p) => (
                  <li key={p._id}>
                    <b className="text-slate-900">Set {p.number}</b> · Internal: {p.internal.name}
                    {p.internal.phone && ` (${p.internal.phone})`} · External: {p.external.name}
                    {p.external.college && `, ${p.external.college}`}
                    {(p.external.phone || p.external.email) && ` (${[p.external.phone, p.external.email].filter(Boolean).join(", ")})`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {list && (
        <>
          {list.length > 0 && (
            <h3 className="mt-7 text-lg font-bold tracking-tight text-slate-950">Practical exams you conduct</h3>
          )}
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {list.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No practical exams for your board. Students must be registered for the examination first.</p>}
            <ul className="divide-y divide-slate-100">
              {list.map((s) => {
                const left = s.candidates - s.assigned;
                const chip =
                  s.batches === 0
                    ? { label: "Make batches", cls: "bg-orange-50 text-orange-700" }
                    : s.submitted === s.batches
                    ? { label: "Marks submitted", cls: "bg-emerald-50 text-emerald-700" }
                    : s.dated < s.batches
                    ? { label: "Fix the dates", cls: "bg-orange-50 text-orange-700" }
                    : { label: "Time table fixed", cls: "bg-blue-50 text-blue-700" };
                return (
                  <li key={s.code}>
                    <button onClick={() => setOpen(s.code)} className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-slate-50 sm:flex-row sm:items-center">
                      <div className="w-20 shrink-0 text-xs font-semibold text-slate-500">Sem {s.semester ?? "–"}</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-950">
                          {s.code} <span className="font-normal text-slate-600">{s.name}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {s.candidates} student{s.candidates === 1 ? "" : "s"} permitted
                          {s.branches.length > 0 && ` (${branches(s.branches)})`}
                          {s.registered > s.candidates && ` · ${s.registered - s.candidates} not permitted`}
                          {s.batches > 0 && ` · ${s.batches} batch${s.batches > 1 ? "es" : ""}`}
                          {s.batches > 0 && left > 0 && <span className="font-semibold text-orange-700"> · {left} not in any batch</span>}
                        </p>
                      </div>
                      <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-center ${chip.cls}`}>{chip.label}</span>
                      <Icon name="chevronRight" className="hidden h-5 w-5 text-slate-300 sm:block" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {(list.length > 0 || elsewhere.length > 0) && (
            <a href={`/print/practical/${examId}?sheet=timetable&branch=${department}`} target="_blank" rel="noreferrer" className={`${btn.secondary} mt-4`}>
              <Icon name="download" className="h-4 w-4" />
              Print practical time table (your exams and your students)
            </a>
          )}

          <h3 className="mt-8 text-lg font-bold tracking-tight text-slate-950">Your students in other boards&apos; practical exams</h3>
          <p className="mt-1 text-sm text-slate-500">These are conducted by the other board&apos;s HOD. You cannot change them; tell your students the date and lab.</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {elsewhere.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">None of your students is in another board&apos;s batch yet.</p>}
            <ul className="divide-y divide-slate-100">
              {elsewhere.map((b) => (
                <li key={b._id} className="px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">
                        {b.code} <span className="font-normal text-slate-600">{b.name}</span> · Batch {b.number}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        <b className={b.date ? "text-slate-900" : "text-orange-700"}>{when(b)}</b> · conducted by {dept(b.department)}
                      </p>
                    </div>
                    <span className="self-start rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 sm:self-center">
                      {b.own.length} of your student{b.own.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs font-semibold text-blue-700">Show the students</summary>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{b.own.map((s) => `${s.registerNumber} ${s.name}`).join(" · ")}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function SubjectBatches({ examId, code, onClose }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const path = `/practicals/${examId}/subjects/${encodeURIComponent(code)}`;

  const [data, setData] = useState(null);
  const [batches, setBatches] = useState([]); // working copy
  const [count, setCount] = useState("1");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clashes, setClashes] = useState([]);

  const load = useCallback(async () => {
    try {
      const r = await api("get", path);
      setData(r.data.data);
      setBatches(r.data.data.batches.map((b) => ({ ...b, students: b.students.map((s) => String(s.registration)) })));
      setDirty(false);
      setClashes([]);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the subject."));
      onClose();
    }
  }, [api, path, toast, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="mx-auto mt-6 h-64 max-w-5xl animate-pulse rounded-2xl bg-white" />;

  const { subject, candidates, panels } = data;
  const byId = new Map(candidates.map((c) => [String(c.registration), c]));
  const placed = new Set(batches.flatMap((b) => b.students));
  const unassigned = candidates.filter((c) => !placed.has(String(c.registration)));
  const open = batches.filter((b) => b.status !== "SUBMITTED");
  const n = Math.min(Math.max(1, Number(count) || 1), Math.max(1, candidates.length));
  const sizes = Array.from({ length: n }, (_, k) => Math.floor(candidates.length / n) + (k < candidates.length % n ? 1 : 0));
  const mixed = new Set(candidates.map((c) => c.department)).size > 1;

  const change = (fn) => {
    setBatches((list) => fn(list.map((b) => ({ ...b, students: [...b.students] }))));
    setDirty(true);
  };
  const setField = (number, key, value) => change((list) => list.map((b) => (b.number === number ? { ...b, [key]: value } : b)));
  const move = (id, to) =>
    change((list) => {
      for (const b of list) if (b.status !== "SUBMITTED") b.students = b.students.filter((x) => x !== id);
      const target = list.find((b) => b.number === Number(to));
      if (target) target.students.push(id);
      for (const b of list) b.students.sort((x, y) => (byId.get(x)?.registerNumber || "").localeCompare(byId.get(y)?.registerNumber || ""));
      return list;
    });
  const addBatch = () =>
    change((list) => [
      ...list,
      { number: Math.max(0, ...list.map((b) => b.number)) + 1, status: "OPEN", date: "", session: "", lab: "", panel: panels.length === 1 ? panels[0]._id : null, students: [], isNew: true },
    ]);

  // A time table with a clash is refused: the server lists every clash
  const failed = (e, fallback) => {
    setClashes(e?.response?.data?.clashes || []);
    toast.error(errMsg(e, fallback), 8000);
  };

  const make = async () => {
    if (batches.length) {
      const ok = await confirm({
        title: "Make the batches again?",
        message: `The ${candidates.length} students will be divided again into ${n} batch${n > 1 ? "es" : ""} in register-number order. Changes you made by moving students are lost. Dates are kept.`,
        confirmText: "Make batches again",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const r = await api("post", `${path}/split`, { count: n });
      toast.success(r.data.message, 6000);
      await load();
    } catch (e) {
      failed(e, "Could not make the batches.");
    }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("put", `${path}/batches`, {
        batches: open.map((b) => ({ number: b.number, date: b.date, session: b.session, lab: b.lab, panel: b.panel, students: b.students })),
      });
      toast.success(r.data.message, 6000);
      await load();
    } catch (e) {
      failed(e, "Could not save the batches.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6 lg:px-7">
      <button onClick={onClose} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <Icon name="chevronLeft" className="h-4 w-4" />
        All practical subjects
      </button>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {subject.code} <span className="font-semibold text-slate-600">{subject.name}</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {candidates.length} student{candidates.length === 1 ? "" : "s"} permitted{mixed && " from several branches"} · practical marks out of {subject.max} · {subject.board} board
      </p>

      {candidates.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No student is permitted to take this practical exam yet. A student is permitted when he is eligible and the fee is paid.
        </p>
      ) : (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">How many batches?</span>
            <input type="number" min="1" max={candidates.length} value={count} onChange={(e) => setCount(e.target.value)} className={`${field} mt-1 w-28`} />
          </label>
          <p className="flex-1 pb-2.5 text-sm text-slate-600">
            {candidates.length} students → <b className="text-slate-900">{sizes.join(" + ")}</b>
            <span className="text-slate-400"> · any size is allowed{mixed && ", branches can be mixed"}</span>
          </p>
          <button onClick={make} disabled={busy} className={batches.length ? btn.secondary : btn.primary}>
            {batches.length ? "Make batches again" : "Make batches"}
          </button>
        </div>
      )}

      {clashes.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-sm font-semibold text-red-900">Not saved – the time table has {clashes.length === 1 ? "a clash" : `${clashes.length} clashes`}. Change the date, session, lab or examiner set.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900">
            {clashes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {unassigned.length > 0 && batches.length > 0 && (
        <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-orange-900">
            {unassigned.length} student{unassigned.length > 1 ? "s are" : " is"} not in any batch – choose a batch for each.
          </p>
          <ul className="mt-2 divide-y divide-orange-100">
            {unassigned.map((c) => (
              <StudentRow key={c.registration} c={c} batches={open} onMove={(to) => move(String(c.registration), to)} />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {batches.map((b) => {
          const done = b.status === "SUBMITTED";
          const panel = panels.find((p) => p._id === b.panel);
          const st = b.isNew ? { label: "New", chip: "bg-slate-100 text-slate-600" } : batchState({ ...b, allotted: done || Boolean(panel) });
          const saved = data.batches.find((x) => x.number === b.number);
          return (
            <section key={b.number} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
                <h3 className="text-base font-bold text-slate-950">Batch {b.number}</h3>
                <span className="text-sm text-slate-500">
                  {b.students.length} student{b.students.length === 1 ? "" : "s"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${st.chip}`}>{st.label}</span>
                {!b.isNew && (
                  <a href={`/print/practical/${examId}?batch=${b._id}`} target="_blank" rel="noreferrer" className={`${btn.small} ml-auto`}>
                    <Icon name="download" className="h-4 w-4" />
                    Print mark list
                  </a>
                )}
              </div>

              <div className="grid gap-3 px-4 py-3 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Date</span>
                  <input type="date" disabled={done} value={b.date || ""} onChange={(e) => setField(b.number, "date", e.target.value)} className={`${field} mt-1`} />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Session</span>
                  <select disabled={done} value={b.session || ""} onChange={(e) => setField(b.number, "session", e.target.value)} className={`${field} mt-1`}>
                    <option value="">Choose</option>
                    <option value="FN">Morning</option>
                    <option value="AN">Afternoon</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Lab / room</span>
                  <input disabled={done} value={b.lab || ""} onChange={(e) => setField(b.number, "lab", e.target.value)} placeholder="e.g. Computer Lab 2" className={`${field} mt-1`} />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 px-4 py-2.5 text-sm text-slate-600">
                {done ? (
                  <span>
                    Internal: <b className="text-slate-900">{b.internal.name}</b> · External: <b className="text-slate-900">{b.external.name}</b>
                    {b.external.college && `, ${b.external.college}`}
                  </span>
                ) : panels.length === 0 ? (
                  <span className="text-slate-500">Examiners will be allotted by the COE.</span>
                ) : (
                  <>
                    {panels.length > 1 && (
                      <select value={b.panel || ""} onChange={(e) => setField(b.number, "panel", e.target.value || null)} aria-label={`Examiner set of batch ${b.number}`} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-semibold text-slate-800">
                        <option value="">Choose the examiner set</option>
                        {panels.map((p) => (
                          <option key={p._id} value={p._id}>
                            Set {p.number}
                          </option>
                        ))}
                      </select>
                    )}
                    {panel ? <span>{examinersOf(panel)}</span> : <span className="font-semibold text-orange-700">Choose which examiner set conducts this batch.</span>}
                  </>
                )}
              </div>

              <ul className="divide-y divide-slate-100 border-t border-slate-100">
                {b.students.length === 0 && <li className="px-4 py-4 text-sm text-slate-500">No students. An empty batch is removed when you save.</li>}
                {b.students.map((id) => {
                  // A submitted batch keeps a student whose eligibility changed later.
                  // (In an open batch the server removes him automatically.)
                  const old = saved?.students.find((s) => String(s.registration) === id);
                  const c = byId.get(id) || old;
                  if (!c) return null;
                  return (
                    <StudentRow
                      key={id}
                      c={c}
                      current={b.number}
                      batches={done ? [] : open}
                      onMove={(to) => move(id, to)}
                      result={done && old ? (old.attendance === "PRESENT" ? `${old.marks} / ${subject.max}` : old.attendance === "ABSENT" ? "Absent" : "Malpractice") : ""}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {batches.length > 0 && (
        <button onClick={addBatch} className={`${btn.secondary} mt-4`}>
          <Icon name="plus" className="h-4 w-4" />
          Add one more batch
        </button>
      )}

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
          <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
            <p className="flex-1 text-sm">You have changes that are not saved.</p>
            <button onClick={load} disabled={busy} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white">
              Discard
            </button>
            <button onClick={save} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50">
              {busy ? "Checking and saving…" : "Save batches"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRow({ c, current, batches, onMove, result }) {
  const others = batches.filter((b) => b.number !== current);
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
      <span className="w-28 font-semibold tabular-nums text-slate-900">{c.registerNumber}</span>
      <span className="min-w-0 flex-1 text-slate-700">
        {c.name}
        {c.department && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{String(c.department).toUpperCase()}</span>}
        {c.kind === "BACKLOG" && <span className="ml-1 rounded bg-orange-50 px-1.5 py-0.5 text-[11px] font-semibold text-orange-700">Back paper</span>}
      </span>
      {result && <span className="text-xs font-semibold text-slate-600">{result}</span>}
      {others.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && onMove(e.target.value)}
          aria-label={`Move ${c.registerNumber} to another batch`}
          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
        >
          <option value="">{current ? "Move to…" : "Put in…"}</option>
          {others.map((b) => (
            <option key={b.number} value={b.number}>
              Batch {b.number}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
