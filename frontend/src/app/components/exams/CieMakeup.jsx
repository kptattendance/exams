"use client";

// Supplementary semester – CIE make-up for NE students (KPT 5.5).
//   COE    : opens a round after the even-semester results, sets the last date to register
//   office : registers a student for an NE course with the exam-fee receipt,
//            enters the make-up CIE
// CIE at or above the minimum -> the course comes back in the next exam as an
// eligible back paper with the new CIE.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { useRole } from "../useRole";
import CollegeSelect, { EveningTag, matchesCollege } from "../ui/CollegeFilter";
import { DEPARTMENTS, errMsg, useApi } from "./shared";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function CieMakeup() {
  const api = useApi();
  const toast = useToast();
  const isCoe = ["coe", "acoe", "admin"].includes(useRole());
  const [rounds, setRounds] = useState(null);
  const [roundId, setRoundId] = useState("");
  const [data, setData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [registering, setRegistering] = useState(null);
  const [dept, setDept] = useState("");
  const [college, setCollege] = useState("");
  const [q, setQ] = useState("");

  const loadRounds = useCallback(async () => {
    try {
      const r = await api("get", "/cie-makeup/rounds");
      setRounds(r.data.data);
      setRoundId((id) => id || r.data.data[0]?._id || "");
    } catch (e) {
      setRounds([]);
      toast.error(errMsg(e, "Could not load the rounds."));
    }
  }, [api, toast]);

  const load = useCallback(async () => {
    if (!roundId) return setData(null);
    try {
      const r = await api("get", `/cie-makeup/rounds/${roundId}`);
      setData(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the round."));
    }
  }, [api, roundId, toast]);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);
  useEffect(() => {
    load();
  }, [load]);

  const match = useCallback(
    (x) =>
      (!dept || x.department === dept) &&
      matchesCollege(college, x.registerNumber) &&
      (!q.trim() || `${x.registerNumber} ${x.name} ${x.code}`.toLowerCase().includes(q.trim().toLowerCase())),
    [dept, college, q]
  );
  const entries = useMemo(() => (data?.entries || []).filter(match), [data, match]);
  const open = useMemo(() => (data?.candidates || []).filter(match), [data, match]);
  const replace = (e) => setData((d) => ({ ...d, entries: d.entries.map((x) => (x._id === e._id ? e : x)) }));
  const closed = data?.round?.lastDate && new Date() > new Date(new Date(data.round.lastDate).setHours(23, 59, 59, 999));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">CIE make-up (supplementary semester)</h2>
      <p className="mt-1 text-sm text-slate-500">
        For students with NE (CIE below the minimum), after the even-semester results – KPT 5.5. Not for seminar, project, internship or practical courses.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {rounds && rounds.length > 0 && (
          <select value={roundId} onChange={(e) => setRoundId(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
            {rounds.map((r) => (
              <option key={r._id} value={r._id}>
                {r.name} · {r.registered} registered
              </option>
            ))}
          </select>
        )}
        {data?.round && <LastDate round={data.round} canEdit={isCoe} onSaved={load} />}
        {isCoe && (
          <button onClick={() => setCreating(true)} className={`${btn.secondary} ml-auto`}>
            + Open a new round
          </button>
        )}
      </div>

      {rounds && rounds.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No supplementary semester round yet. {isCoe ? "Open one after the even-semester results." : "The COE opens it after the even-semester results."}
        </p>
      )}

      {roundId && !data && <div className="mt-4 h-48 animate-pulse rounded-2xl bg-white" />}

      {data && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no., name or course" className="h-10 w-60 rounded-xl border border-slate-200 bg-white px-3 text-sm" />
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <CollegeSelect value={college} onChange={setCollege} />
          </div>

          <Section title={`Registered (${entries.length})`} hint="Enter the make-up CIE marks after the make-up tests.">
            {entries.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Nobody registered yet.</p>
            ) : (
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Course</th>
                    <th className="px-3 py-2.5 text-right">CIE before</th>
                    <th className="px-3 py-2.5">Fee</th>
                    <th className="px-3 py-2.5">Make-up CIE</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e) => (
                    <EntryRow key={e._id} e={e} isCoe={isCoe} onChanged={replace} onRemoved={load} />
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title={`NE – not registered yet (${open.length})`} hint="Students whose latest result in the course is NE.">
            {open.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No one left to register.</p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {open.map((c) => (
                    <tr key={`${c.student}|${c.subject}`}>
                      <td className="px-3 py-2.5">
                        <b className="tabular-nums">{c.registerNumber}</b>
                        <EveningTag registerNumber={c.registerNumber} />
                        <span className="block text-xs text-slate-500">{c.name}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <b>{c.code}</b>
                        <span className="block text-xs text-slate-500">
                          {c.subjectName} · Sem {c.subjectSemester}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">
                        CIE {c.originalCie ?? "—"}/{c.cieMax} · needs {c.cieMin}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button onClick={() => setRegistering(c)} disabled={closed} className={btn.small} title={closed ? "Registration is closed" : ""}>
                          Register
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}

      {creating &&
        createPortal(
          <NewRound
            onClose={() => setCreating(false)}
            onSaved={(r) => {
              setCreating(false);
              setRoundId(r._id);
              loadRounds();
            }}
          />,
          document.body
        )}
      {registering &&
        createPortal(
          <RegisterModal
            roundId={roundId}
            c={registering}
            onClose={() => setRegistering(null)}
            onSaved={() => {
              setRegistering(null);
              load();
            }}
          />,
          document.body
        )}
    </div>
  );
}

const Section = ({ title, hint, children }) => (
  <div className="mt-5">
    <p className="text-sm font-semibold text-slate-900">
      {title} <span className="font-normal text-slate-500">· {hint}</span>
    </p>
    <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white">{children}</div>
  </div>
);

function LastDate({ round, canEdit, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [value, setValue] = useState(round.lastDate ? String(round.lastDate).slice(0, 10) : "");
  if (!canEdit) return <span className="text-xs text-slate-500">{round.lastDate ? `Register by ${fmt(round.lastDate)}` : "No last date"}</span>;
  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      Last date to register
      <input
        type="date"
        value={value}
        onChange={async (e) => {
          setValue(e.target.value);
          try {
            const r = await api("put", `/cie-makeup/rounds/${round._id}`, { lastDate: e.target.value });
            toast.success(r.data.message);
            onSaved();
          } catch (err) {
            toast.error(errMsg(err, "Could not save the date."));
          }
        }}
        className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm"
      />
    </label>
  );
}

function EntryRow({ e, isCoe, onChanged, onRemoved }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [marks, setMarks] = useState(e.marks ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = String(marks) !== String(e.marks ?? "");

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/cie-makeup/entries/${e._id}/marks`, { marks });
      if (r.data.data.passed) toast.success(r.data.message, 9000);
      else toast.info(r.data.message, 9000);
      onChanged(r.data.data);
    } catch (err) {
      toast.error(errMsg(err, "Could not save the marks."));
    }
    setBusy(false);
  };
  const remove = async () => {
    const ok = await confirm({ title: "Remove this registration?", message: `${e.registerNumber} · ${e.code}\n\nOnly for a registration made by mistake.`, confirmText: "Remove", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("delete", `/cie-makeup/entries/${e._id}`);
      toast.success(r.data.message);
      onRemoved();
    } catch (err) {
      toast.error(errMsg(err, "Could not remove."));
    }
  };

  return (
    <tr>
      <td className="px-3 py-2.5">
        <b className="tabular-nums">{e.registerNumber}</b>
        <EveningTag registerNumber={e.registerNumber} />
        <span className="block text-xs text-slate-500">{e.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <b>{e.code}</b>
        <span className="block text-xs text-slate-500">
          {e.subjectName} · Sem {e.subjectSemester}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-600">
        {e.originalCie ?? "—"}/{e.cieMax}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600">
        {e.fee?.amount != null && <b className="text-slate-900">₹{e.fee.amount} </b>}
        {e.fee?.receiptNo}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max={e.cieMax}
            step="0.5"
            value={marks}
            onChange={(ev) => setMarks(ev.target.value)}
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm tabular-nums"
          />
          <span className="text-xs text-slate-500">/ {e.cieMax}</span>
          {dirty ? (
            <button onClick={save} disabled={busy} className={btn.small}>
              {busy ? "…" : "Save"}
            </button>
          ) : e.marks != null ? (
            <span className={`text-xs font-semibold ${e.passed ? "text-emerald-700" : "text-red-700"}`}>{e.passed ? "Made up" : `Below ${e.cieMin}`}</span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        {isCoe && e.marks == null && (
          <button onClick={remove} className="text-xs font-semibold text-red-600 hover:underline">
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

function NewRound({ onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [name, setName] = useState(`Supplementary semester ${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`);
  const [academicYear, setAcademicYear] = useState("");
  const [lastDate, setLastDate] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", "/cie-makeup/rounds", { name, academicYear, lastDate });
      toast.success(r.data.message);
      onSaved(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not open the round."));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Open a supplementary semester"
      subtitle="CIE make-up for NE students (KPT 5.5)"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || name.trim().length < 3} className={btn.primary}>
            {busy ? "Saving…" : "Open"}
          </button>
        </>
      }
    >
      <label className="block">
        <span className="text-sm font-semibold text-slate-800">Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1.5`} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Academic year</span>
          <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} placeholder="2026-27" className={`${field} mt-1.5`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Last date to register</span>
          <input type="date" value={lastDate} onChange={(e) => setLastDate(e.target.value)} className={`${field} mt-1.5`} />
        </label>
      </div>
    </Modal>
  );
}

function RegisterModal({ roundId, c, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [receiptNo, setReceiptNo] = useState("");
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/cie-makeup/rounds/${roundId}/register`, { student: c.student, subject: c.subject, receiptNo, amount, paidOn });
      toast.success(r.data.message);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not register."));
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Register for CIE make-up"
      subtitle={`${c.registerNumber} · ${c.name} · ${c.code}`}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !receiptNo.trim()} className={btn.primary}>
            {busy ? "Saving…" : "Register"}
          </button>
        </>
      }
    >
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {c.subjectName} · CIE {c.originalCie ?? "—"}/{c.cieMax}, needs {c.cieMin}.
      </p>
      <label className="mt-3 block">
        <span className="text-sm font-semibold text-slate-800">Exam fee receipt / challan no.</span>
        <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} autoFocus className={`${field} mt-1.5 font-mono`} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Fee (₹)</span>
          <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1.5`} />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Paid on</span>
          <input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} className={`${field} mt-1.5`} />
        </label>
      </div>
    </Modal>
  );
}
