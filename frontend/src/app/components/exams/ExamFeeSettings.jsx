"use client";

// COE: the exam fee of one examination – per current-semester subject, per
// back paper, and late fees that grow with the date. The HOD's "Exam fee
// list" uses these to tell each student what to pay.

import { useState } from "react";

import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

const day = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function ExamFeeSettings({ exam, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const f = exam.fees || {};
  const [perSubject, setPerSubject] = useState(f.perSubject ?? 350);
  const [backPaper, setBackPaper] = useState(f.backPaper ?? 200);
  const [slabs, setSlabs] = useState((f.lateFees || []).map((s) => ({ ...s })));
  const [busy, setBusy] = useState(false);

  const setSlab = (i, k, v) => setSlabs((list) => list.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const sorted = [...slabs].filter((s) => s.from).sort((a, b) => a.from.localeCompare(b.from));

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("patch", `/exams/${exam._id}`, {
        fees: { perSubject: Number(perSubject), backPaper: Number(backPaper), lateFees: slabs.map((s) => ({ from: s.from, amount: Number(s.amount) })) },
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
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Per subject (current semester)</span>
            <input type="number" min="0" value={perSubject} onChange={(e) => setPerSubject(e.target.value)} className={`${field} mt-1.5`} />
            <span className="mt-1 block text-xs text-slate-500">Regular, elective and bridge courses.</span>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Per back paper</span>
            <input type="number" min="0" value={backPaper} onChange={(e) => setBackPaper(e.target.value)} className={`${field} mt-1.5`} />
          </label>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">Late fee</p>
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
          <b>Example:</b> 6 subjects + 1 back paper = 6 × {perSubject || 0} + 1 × {backPaper || 0} = Rs {6 * (Number(perSubject) || 0) + (Number(backPaper) || 0)}
          {sorted.map((s) => (
            <span key={s.from} className="block">
              from {day(s.from)}: + Rs {Number(s.amount) || 0} late fee = Rs {6 * (Number(perSubject) || 0) + (Number(backPaper) || 0) + (Number(s.amount) || 0)}
            </span>
          ))}
          <span className="block text-slate-500">Only subjects the student may write are charged (not ANS / NE).</span>
        </div>
      </div>
    </Modal>
  );
}
