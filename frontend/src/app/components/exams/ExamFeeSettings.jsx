"use client";

// COE: the exam fee of one examination (DTE circular). Charged per SEMESTER
// EXAM a student writes: 1 or 2 subjects of that semester, or 3 or more (the
// full semester), plus the marks card fee, plus a late fee per semester exam
// that grows with the date. Bridge courses are a separate exam. The HOD's
// "Exam fee list" uses these to tell each student what to pay.

import { useState } from "react";

import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

// DTE circular BTE/03/EP/2026 dated 31.07.2026 (Nov/Dec 2026 exam)
const CIRCULAR_2026 = [
  { from: "2026-09-10", amount: 50 },
  { from: "2026-09-21", amount: 100 },
  { from: "2026-09-30", amount: 200 },
  { from: "2026-10-09", amount: 400 },
  { from: "2026-10-19", amount: 2000 },
];

export default function ExamFeeSettings({ exam, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const f = exam.fees || {};
  const [upTo2, setUpTo2] = useState(f.upTo2 ?? 200);
  const [threePlus, setThreePlus] = useState(f.threePlus ?? 300);
  const [marksCard, setMarksCard] = useState(f.marksCard ?? 50);
  const [slabs, setSlabs] = useState((f.lateFees || []).map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);

  const setSlab = (i, k, v) => setSlabs((list) => list.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const sorted = [...slabs].filter((s) => s.from).sort((a, b) => a.from.localeCompare(b.from));
  const n = (v) => Number(v) || 0;
  const full = n(threePlus) + n(marksCard);
  const small = n(upTo2) + n(marksCard);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("patch", `/exams/${exam._id}`, {
        fees: { upTo2: n(upTo2), threePlus: n(threePlus), marksCard: n(marksCard), lateFees: slabs.map((s) => ({ from: s.from, amount: Number(s.amount) })) },
      });
      toast.success("Exam fee saved. HODs see it in their Exam fee list.");
      onSaved(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not save the exam fee."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Exam fee"
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy} className={btn.primary}>
            Save
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-xs text-slate-500">Charged for each semester exam a student writes (his current semester, each back-paper semester, and the bridge courses separately).</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">1 or 2 subjects</span>
            <input type="number" min="0" value={upTo2} onChange={(e) => setUpTo2(e.target.value)} className={`${field} mt-1.5`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">3+ subjects / full sem</span>
            <input type="number" min="0" value={threePlus} onChange={(e) => setThreePlus(e.target.value)} className={`${field} mt-1.5`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Marks card</span>
            <input type="number" min="0" value={marksCard} onChange={(e) => setMarksCard(e.target.value)} className={`${field} mt-1.5`} />
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="mr-auto text-sm font-semibold text-slate-800">Late fee (per semester exam)</p>
            <button type="button" onClick={() => setSlabs(CIRCULAR_2026.map((s) => ({ ...s })))} className={btn.small}>
              Fill from circular 31-07-2026
            </button>
          </div>
          <p className="text-xs text-slate-500">Each amount applies from its date onwards (the latest one counts). Before the first date there is no late fee.</p>
          <div className="mt-2 space-y-2">
            {slabs.map((s, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-600">From</span>
                <input type="date" value={s.from || ""} onChange={(e) => setSlab(i, "from", e.target.value)} className={`${field} w-44`} />
                <span className="text-sm text-slate-600">Rs</span>
                <input type="number" min="0" value={s.amount ?? ""} onChange={(e) => setSlab(i, "amount", e.target.value)} className={`${field} w-32`} />
                <button type="button" onClick={() => setSlabs((list) => list.filter((_, j) => j !== i))} className={btn.small}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setSlabs((list) => [...list, { from: "", amount: "" }])} className={btn.small}>
              + Add late fee
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
          <b>Example:</b> full semester = {n(threePlus)} + {n(marksCard)} = <b>Rs {full}</b> · one back paper of another semester = {n(upTo2)} + {n(marksCard)} = <b>Rs {small}</b> · both
          together Rs {full + small}
          {sorted.map((s) => (
            <span key={s.from} className="block">
              from {day(s.from)}: + Rs {n(s.amount)} for each semester exam = Rs {full + small + 2 * n(s.amount)}
            </span>
          ))}
          <span className="block text-slate-500">Every registered subject is counted, also ANS / NE – the fee is collected before eligibility is announced and is not refunded.</span>
        </div>
      </div>
    </Modal>
  );
}
