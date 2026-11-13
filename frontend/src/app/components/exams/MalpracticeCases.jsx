"use client";

// Malpractice cases of an exam (KPT 10.2): every student marked Malpractice in
// a theory or practical exam. The COE records the Malpractice Enquiry
// Committee's decision; it is applied when the results are processed:
//   PSC  – the chosen subject(s) cancelled (fail; back paper next time)
//   PEC  – every subject of that semester cancelled; not promoted (Detained on publishing)
//   PEC+ – every subject of this exam cancelled; not promoted; debarment noted
// No malpractice: change him back to Present in the attendance and have the paper valued.

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";

const DECISIONS = [
  ["PSC", "PSC – Performance in Subject Cancelled", "Only the chosen subject(s) are cancelled (fail). They come back as back papers."],
  ["PEC", "PEC – Performance in Examination Cancelled", "Every subject of that semester in this exam is cancelled. Not promoted: he becomes Detained when the results are published."],
  ["PEC_PLUS", "PEC+ – All Semesters' Performance Cancelled", "Every subject he wrote in this exam is cancelled. Not promoted (Detained). The debarment is noted only."],
];
const LABEL = { PSC: "PSC", PEC: "PEC", PEC_PLUS: "PEC+" };

export default function MalpracticeCases({ examId, published, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [cases, setCases] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const r = await api("get", `/exams/${examId}/malpractice`);
      setCases(r.data.data || []);
    } catch (e) {
      setCases([]);
      if (e?.response?.status !== 403) toast.error(errMsg(e, "Could not load the malpractice cases."));
    }
  }, [api, examId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (!cases || cases.length === 0) return null;
  const pending = cases.filter((c) => !c.malpractice).length;

  return (
    <div className="mt-4 rounded-2xl border border-orange-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-950">
          Malpractice cases <span className="font-normal text-slate-500">(KPT 10.2)</span>
        </p>
        <p className="text-xs text-slate-500">
          {pending ? <b className="text-orange-700">{pending} waiting for the committee&apos;s decision</b> : "All decided"}
        </p>
      </div>
      <ul className="mt-2 divide-y divide-slate-100">
        {cases.map((c) => (
          <li key={c._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="w-28 font-semibold tabular-nums text-slate-950">{c.registerNumber}</span>
            <span className="min-w-0 flex-1">
              <span className="text-slate-800">{c.name}</span>
              <span className="block text-xs text-slate-500">
                Caught in: {c.caught.length ? c.caught.map((s) => `${s.code} (${s.parts.join(", ")})`).join(", ") : "—"}
              </span>
            </span>
            {c.malpractice ? (
              <span className="text-xs">
                <b className="rounded-md bg-red-50 px-1.5 py-0.5 text-red-700">{LABEL[c.malpractice.decision]}</b>
                <span className="ml-1.5 text-slate-500">
                  {c.malpractice.decision === "PSC" && c.malpractice.subjects.join(", ")}
                  {c.malpractice.decision === "PEC" && `Sem ${c.malpractice.semesters.join(", ")}`}
                  {c.malpractice.decision === "PEC_PLUS" && c.malpractice.debarExams ? `debarred ${c.malpractice.debarExams} exam(s)` : ""} · {c.malpractice.reference}
                </span>
              </span>
            ) : (
              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-xs font-semibold text-orange-700">Result withheld</span>
            )}
            <button onClick={() => setEditing(c)} className={btn.small}>
              {c.malpractice ? "Change" : "Record decision"}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        No malpractice found? Change him back to <b>Present</b> in the paper&apos;s attendance (valuation / practical batch) and have the paper valued. After recording
        a decision, press <b>Process again</b>.
      </p>
      {editing &&
        createPortal(
          <DecisionModal
            examId={examId}
            item={editing}
            published={published}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              load();
              onChanged?.();
            }}
          />,
          document.body
        )}
    </div>
  );
}

function DecisionModal({ examId, item, published, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const m = item.malpractice;
  const [decision, setDecision] = useState(m?.decision || "PSC");
  const [subjects, setSubjects] = useState(() => (m?.subjects?.length ? m.subjects : item.caught.map((s) => s.code)));
  const [reference, setReference] = useState(m?.reference || "");
  const [debar, setDebar] = useState(m?.debarExams ? String(m.debarExams) : "");
  const [note, setNote] = useState(m?.note || "");
  const [busy, setBusy] = useState(false);

  const save = async (remove = false) => {
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/registrations/${item._id}/malpractice`, remove ? { decision: "" } : { decision, subjects, reference, debarExams: debar, note });
      toast.success(r.data.message, 8000);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the decision."));
      setBusy(false);
    }
  };

  const toggle = (code) => setSubjects((list) => (list.includes(code) ? list.filter((x) => x !== code) : [...list, code]));
  const ok = reference.trim().length >= 3 && (decision !== "PSC" || subjects.length > 0);

  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title="Malpractice – committee's decision"
      subtitle={`${item.registerNumber} · ${item.name}`}
      footer={
        <>
          {m && (
            <button onClick={() => save(true)} disabled={busy} className={btn.danger}>
              Remove decision
            </button>
          )}
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={() => save(false)} disabled={busy || !ok} className={btn.primary}>
            {busy ? "Saving…" : "Save decision"}
          </button>
        </>
      }
    >
      {published && (
        <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
          The results are already published: saving corrects his published result now (Admin, with a reason).
        </p>
      )}
      <div className="space-y-2">
        {DECISIONS.map(([v, label, hint]) => (
          <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 ${decision === v ? "border-blue-600 bg-blue-50/60" : "border-slate-200"}`}>
            <input type="radio" checked={decision === v} onChange={() => setDecision(v)} className="mt-1 h-4 w-4 accent-blue-600" />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{label}</span>
              <span className="block text-xs leading-5 text-slate-500">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {decision === "PSC" && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-slate-800">Subject(s) cancelled</p>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {item.subjects.map((s) => (
              <label key={s.code} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={subjects.includes(s.code)} onChange={() => toggle(s.code)} className="h-4 w-4 accent-blue-600" />
                <span>
                  <b className="tabular-nums">{s.code}</b> <span className="text-xs text-slate-500">Sem {s.semester}</span>
                  {item.caught.some((x) => x.code === s.code) && <span className="ml-1 text-xs font-semibold text-red-700">caught</span>}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_9rem]">
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">MPEC reference (proceedings no. / date)</span>
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. MPEC/2026/04 dated 12-12-2026" className={`${field} mt-1.5`} />
        </label>
        {decision === "PEC_PLUS" && (
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Debarred for</span>
            <select value={debar} onChange={(e) => setDebar(e.target.value)} className={`${field} mt-1.5`}>
              <option value="">Not given</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} exam{n > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="mt-3 block">
        <span className="text-sm font-semibold text-slate-800">
          Note <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={`${field} mt-1.5`} />
      </label>
    </Modal>
  );
}
