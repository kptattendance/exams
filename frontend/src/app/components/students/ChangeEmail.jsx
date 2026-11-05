"use client";

// Admin: "Change email" for one student. The server changes the email of the
// student's login account (the same account – the old email is deleted from
// it) and of the student record together.

import { useState } from "react";
import { createPortal } from "react-dom";

import Modal, { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "../exams/shared";

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// common slips: gamil / gmial / gmali / gnail / gmail.con …
const looksMistyped = (e) => /@(gamil|gmial|gmali|gnail|gmal|gmai)\.|@gmail\.(con|co|cm|om)$/i.test(e);

export default function ChangeEmailButton({ student, onChanged, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"}
      >
        Change email
      </button>
      {open && createPortal(<EmailModal student={student} onClose={() => setOpen(false)} onChanged={onChanged} />, document.body)}
    </>
  );
}

function EmailModal({ student, onClose, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const clean = email.replace(/\s+/g, "").toLowerCase();
  const valid = EMAIL_RX.test(clean) && clean !== String(student.email || "").toLowerCase();

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("put", `/students/${student._id}/email`, { email: clean });
      toast.success(r.data.message || "Email changed.", 7000);
      onChanged?.(r.data.data);
      onClose();
    } catch (e) {
      toast.error(errMsg(e, "Could not change the email."), 9000);
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Change email"
      subtitle={`${student.name || ""}${student.registerNumber ? ` · ${student.registerNumber}` : ""}`}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !valid} className={btn.primary}>
            {busy ? "Saving…" : "Change email"}
          </button>
        </>
      }
    >
      <p className="text-xs font-semibold text-slate-500">Email now</p>
      <p className="mt-0.5 break-all text-sm font-semibold text-slate-900">{student.email || "—"}</p>
      <label className="mt-4 block">
        <span className="text-sm font-semibold text-slate-800">New email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          placeholder="name@gmail.com"
          className="mt-1.5 block h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      {clean && looksMistyped(clean) && <p className="mt-1.5 text-xs font-semibold text-amber-700">Check the spelling – did you mean @gmail.com?</p>}
      <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
        The student&apos;s login account stays the same; only its email changes. The old email is removed from the login, so the student signs in with the new email
        from now on. Nothing else (photo, exam registration, fees) changes.
      </p>
    </Modal>
  );
}
