"use client";

// Practical marks entry by the two examiners, on the internal examiner's login.
//   1. the external examiner types his secret code → the marks sheet opens
//   2. one agreed mark per student (or Absent / Malpractice)
//   3. the external examiner types the code again → submitted, final

import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { batchState, when } from "./practicalShared";

export default function PracticalEntry({ pad = true }) {
  const api = useApi();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/practicals/my");
      setList(r.data.data);
    } catch (e) {
      setList([]);
      toast.error(errMsg(e, "Could not load your batches."));
    }
  }, [api, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const wrap = pad ? "mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-7" : "";

  if (openId)
    return (
      <div className={wrap}>
        <Sheet
          id={openId}
          onClose={() => {
            setOpenId(null);
            load();
          }}
        />
      </div>
    );

  return (
    <div className={wrap}>
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Practical marks entry</h2>
      <p className="mt-1 text-sm text-slate-500">Batches where you are the internal examiner.</p>

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {list === null && <div className="h-40 animate-pulse" />}
        {list?.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No practical batch is given to you yet. The HOD fixes the batches and dates of your examiner set.</p>}
        <ul className="divide-y divide-slate-100">
          {list?.map((b) => {
            const st = b.status === "SUBMITTED" ? batchState(b) : b.codeLocked ? batchState(b) : { label: "Enter marks", chip: "bg-blue-50 text-blue-700" };
            return (
              <li key={b._id}>
                <button onClick={() => setOpenId(b._id)} className="flex w-full flex-col gap-2 px-4 py-3.5 text-left hover:bg-slate-50 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">
                      {b.code} <span className="font-normal text-slate-600">{b.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {b.label} · {b.count} students · {when(b)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      External examiner: {b.external.name}
                      {b.external.college && `, ${b.external.college}`} · {b.examName}
                    </p>
                  </div>
                  <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-center ${st.chip}`}>{st.label}</span>
                  <Icon name="chevronRight" className="hidden h-5 w-5 text-slate-300 sm:block" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Sheet({ id, onClose }) {
  const api = useApi();
  const toast = useToast();
  const [b, setB] = useState(null);
  const [rows, setRows] = useState({}); // registerNumber -> { attendance, marks }
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const refs = useRef([]);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/practicals/batches/${id}`);
      const d = r.data.data;
      setB(d);
      setRows(Object.fromEntries(d.students.map((s) => [s.registerNumber, { attendance: s.attendance, marks: s.marks ?? "" }])));
      setErrors({});
      setCode("");
    } catch (e) {
      toast.error(errMsg(e, "Could not open the batch."));
      onClose();
    }
  }, [api, id, toast, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  if (!b) return <div className="h-64 animate-pulse rounded-2xl bg-white" />;

  const done = b.status === "SUBMITTED";

  const check = (r) => {
    if (!r?.attendance) return "not entered";
    if (r.attendance !== "PRESENT") return "";
    if (String(r.marks).trim() === "") return "marks?";
    const n = Number(r.marks);
    if (!Number.isInteger(n)) return "whole marks only";
    if (n < 0 || n > b.max) return `0–${b.max}`;
    return "";
  };
  const entered = b.students.filter((s) => !check(rows[s.registerNumber])).length;
  const count = (a) => b.students.filter((s) => rows[s.registerNumber]?.attendance === a).length;
  const payload = () =>
    Object.fromEntries(b.students.map((s) => [s.registerNumber, { attendance: rows[s.registerNumber]?.attendance || null, marks: rows[s.registerNumber]?.marks ?? "" }]));
  const setRow = (reg, patch) => {
    setRows((x) => ({ ...x, [reg]: { ...x[reg], ...patch } }));
    if (errors[reg]) setErrors((x) => ({ ...x, [reg]: "" }));
  };

  const unlock = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("post", `/practicals/batches/${id}/unlock`, { code });
      toast.success("Marks sheet opened.");
      await load();
    } catch (err) {
      toast.error(errMsg(err, "Could not open the sheet."));
      setCode("");
    }
    setBusy(false);
  };

  const saveDraft = async () => {
    setBusy(true);
    try {
      const r = await api("put", `/practicals/batches/${id}/marks`, { rows: payload() });
      toast.success(r.data.message);
    } catch (e) {
      const list = e?.response?.data?.errors;
      if (list) setErrors(Object.fromEntries(list.map((x) => [x.registerNumber, x.error])));
      toast.error(errMsg(e, "Could not save the draft."));
    }
    setBusy(false);
  };

  const askSubmit = () => {
    const errs = {};
    for (const s of b.students) {
      const e = check(rows[s.registerNumber]);
      if (e) errs[s.registerNumber] = e;
    }
    setErrors(errs);
    const n = Object.keys(errs).length;
    if (n) return toast.error(`${n} student${n > 1 ? "s are" : " is"} not entered yet. Every student needs marks, Absent or Malpractice.`);
    setCode("");
    setConfirming(true);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/practicals/batches/${id}/submit`, { rows: payload(), code });
      toast.success(r.data.message, 8000);
      setConfirming(false);
      await load();
    } catch (e) {
      const list = e?.response?.data?.errors;
      if (list) {
        setErrors(Object.fromEntries(list.map((x) => [x.registerNumber, x.error])));
        setConfirming(false);
      }
      toast.error(errMsg(e, "Could not submit."));
      setCode("");
    }
    setBusy(false);
  };

  return (
    <div className="pb-28">
      <button onClick={onClose} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <Icon name="chevronLeft" className="h-4 w-4" />
        My batches
      </button>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {b.code} <span className="font-semibold text-slate-600">{b.name}</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        {b.label} · {b.count} students · {when(b)} · marks out of {b.max}
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Internal: <b className="text-slate-900">{b.internal.name}</b> · External: <b className="text-slate-900">{b.external.name}</b>
        {b.external.college && `, ${b.external.college}`}
      </p>

      <a href={`/print/practical/${b.exam}?batch=${b._id}`} target="_blank" rel="noreferrer" className={`${btn.secondary} mt-4`}>
        <Icon name="download" className="h-4 w-4" />
        {done ? "Print the mark list for both signatures" : "Print blank mark list"}
      </a>

      {/* ---------------------------------------------------- submitted */}
      {done && (
        <>
          <p className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <b>Submitted and final.</b> {b.summary.present} present, {b.summary.absent} absent, {b.summary.malpractice} malpractice. Print the mark list, sign it with the external
            examiner and hand it to the exam section. Any correction can be made only by the Admin.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {b.students.map((s, i) => (
                <li key={s.registerNumber} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-7 text-xs tabular-nums text-slate-400">{i + 1}</span>
                  <span className="w-28 font-semibold tabular-nums text-slate-900">{s.registerNumber}</span>
                  <span className="min-w-0 flex-1 text-slate-700">{s.name}</span>
                  <span className="font-bold tabular-nums text-slate-950">{s.attendance === "PRESENT" ? s.marks : s.attendance === "ABSENT" ? "Absent" : "Malpractice"}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {/* ---------------------------------------------------- locked */}
      {!done && !b.unlocked && (
        <form onSubmit={unlock} className="mt-5 max-w-md rounded-2xl border border-slate-200 bg-white p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-700">
            <Icon name="lock" className="h-6 w-6" />
          </span>
          <h3 className="mt-3 text-lg font-bold tracking-tight text-slate-950">External examiner&apos;s code</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The marks sheet opens only when <b>{b.external.name}</b> types the secret code sent to him by the COE office. The external examiner should type it himself.
          </p>
          {b.codeLocked ? (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Too many wrong tries. Ask the COE office to issue a new code.</p>
          ) : !b.codeIssued ? (
            <p className="mt-4 rounded-xl bg-orange-50 px-4 py-3 text-sm text-orange-900">The COE office has not issued the code yet.</p>
          ) : (
            <>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6-digit code"
                aria-label="External examiner's secret code"
                className={`${field} mt-4 h-12 text-center text-xl font-bold tracking-[0.4em]`}
              />
              <button disabled={busy || code.trim().length < 6} className={`${btn.primary} mt-3 w-full`}>
                {busy ? "Checking…" : "Open the marks sheet"}
              </button>
            </>
          )}
        </form>
      )}

      {/* ---------------------------------------------------- entry */}
      {!done && b.unlocked && (
        <>
          <p className="mt-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            Type the agreed mark for each student (whole marks, out of {b.max}), or mark him <b>AB</b> (absent) or <b>MP</b> (malpractice). Press Enter to go to the next student.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {b.students.map((s, i) => {
                const r = rows[s.registerNumber] || {};
                const typed = r.attendance === "PRESENT" && String(r.marks).trim() !== "" ? check(r) : "";
                const err = errors[s.registerNumber] || typed;
                const off = r.attendance === "ABSENT" || r.attendance === "MALPRACTICE";
                const toggle = (a) => setRow(s.registerNumber, r.attendance === a ? { attendance: null, marks: "" } : { attendance: a, marks: "" });
                return (
                  <li key={s.registerNumber} className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 ${err ? "bg-red-50" : ""}`}>
                    <span className="w-7 text-xs tabular-nums text-slate-400">{i + 1}</span>
                    <span className="w-28 font-bold tabular-nums text-slate-900">{s.registerNumber}</span>
                    <span className="min-w-0 flex-1 basis-40 text-sm text-slate-700">
                      {s.name}
                      {s.department && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{s.department.toUpperCase()}</span>}
                    </span>
                    <span className="w-24 text-right text-xs text-red-600">{err}</span>
                    <input
                      ref={(el) => (refs.current[i] = el)}
                      inputMode="numeric"
                      disabled={off}
                      value={off ? "" : r.marks ?? ""}
                      placeholder={off ? (r.attendance === "ABSENT" ? "AB" : "MP") : ""}
                      onChange={(e) => setRow(s.registerNumber, { marks: e.target.value, attendance: e.target.value.trim() === "" ? null : "PRESENT" })}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        // next student who is not absent / malpractice
                        for (let k = i + 1; k < b.students.length; k++) {
                          if (!refs.current[k]?.disabled) return refs.current[k].focus();
                        }
                      }}
                      aria-label={`Marks for ${s.registerNumber}`}
                      className={`h-10 w-20 rounded-xl border px-3 text-right text-base font-semibold tabular-nums outline-none focus:ring-4 focus:ring-slate-100 disabled:bg-slate-100 ${
                        err ? "border-red-400" : "border-slate-300 focus:border-slate-500"
                      }`}
                    />
                    {[
                      ["ABSENT", "AB"],
                      ["MALPRACTICE", "MP"],
                    ].map(([a, short]) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggle(a)}
                        aria-pressed={r.attendance === a}
                        title={a === "ABSENT" ? "Absent" : "Malpractice"}
                        className={`h-10 w-11 rounded-xl border text-xs font-bold ${
                          r.attendance === a ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {short}
                      </button>
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="fixed inset-x-0 bottom-20 z-40 px-4 lg:bottom-6 lg:left-[268px]">
            <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-slate-950 px-4 py-3 text-white shadow-2xl">
              <p className="flex-1 text-sm">
                {entered} of {b.students.length} entered
              </p>
              <button onClick={saveDraft} disabled={busy} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white disabled:opacity-50">
                Save draft
              </button>
              <button onClick={askSubmit} disabled={busy} className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-slate-100 disabled:opacity-50">
                Submit
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={busy}
        title="Submit the marks?"
        subtitle={`${b.label} · ${count("PRESENT")} present · ${count("ABSENT")} absent · ${count("MALPRACTICE")} malpractice`}
        footer={
          <>
            <button onClick={() => setConfirming(false)} disabled={busy} className={btn.secondary}>
              Go back and check
            </button>
            <button onClick={submit} disabled={busy || code.trim().length < 6} className={btn.primary}>
              {busy ? "Submitting…" : "Submit – final"}
            </button>
          </>
        }
      >
        <p className="rounded-xl bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-900">
          <b>This is final.</b> After submitting, neither examiner can change a mark. Only the Admin can make a correction.
        </p>
        <label className="mt-4 block">
          <span className="text-sm font-medium text-slate-700">
            External examiner ({b.external.name}): type your secret code again to confirm these marks
          </span>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={`${field} mt-2 h-12 text-center text-xl font-bold tracking-[0.4em]`}
          />
        </label>
      </Modal>
    </div>
  );
}
