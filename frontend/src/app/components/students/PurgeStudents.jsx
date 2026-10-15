"use client";

// Admin: delete students together with ALL their records.
//   1. shows what will be removed and emails a 6-digit code to the admin
//   2. the admin types the code → everything is deleted and logged
// <PurgeStudents ids={[...]} onClose={…} onDeleted={(ids) => …} />
// <PurgeLog onClose={…} />

import { useEffect, useState } from "react";

import Modal from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { errMsg, useApi } from "../exams/shared";

const err = (e, fallback) => e?.response?.data?.message || errMsg(e, fallback);
const fmt = (d) => new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

const LINES = [
  ["registrations", "exam registration(s)"],
  ["answerScripts", "answer script record(s) (also taken out of valuation packets)"],
  ["results", "result(s)"],
  ["electives", "elective choice(s)"],
  ["iaSheets", "Final IA sheet(s) – the student's row"],
  ["attendanceSheets", "Final attendance sheet(s) – the student's row"],
];

export default function PurgeStudents({ ids, onClose, onDeleted }) {
  const api = useApi();
  const toast = useToast();
  const [step, setStep] = useState("start"); // start → code → done
  const [busy, setBusy] = useState(false);
  const [request, setRequest] = useState(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const sendCode = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api("post", "/students/purge/request", { ids });
      setRequest(r.data);
      setStep("code");
    } catch (e) {
      setError(err(e, "Could not start the deletion."));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api("post", "/students/purge/confirm", { requestId: request.requestId, code });
      toast.success(r.data.message);
      if (r.data.warnings?.length) toast.info(`Done, with notes: ${r.data.warnings.join("; ")}`, 10000);
      onDeleted?.(r.data.deletedIds || []);
      onClose();
    } catch (e) {
      setError(err(e, "Could not delete."));
    } finally {
      setBusy(false);
    }
  };

  const s = request?.summary;
  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title="Delete with all records"
      subtitle={`${ids.length} student${ids.length === 1 ? "" : "s"} selected`}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          {step === "start" ? (
            <button onClick={sendCode} disabled={busy} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              {busy ? "Checking…" : "Send code to my email"}
            </button>
          ) : (
            <button
              onClick={confirm}
              disabled={busy || code.trim().length !== 6}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Deleting…" : "Delete permanently"}
            </button>
          )}
        </>
      }
    >
      {step === "start" && (
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            This removes the students <b>and everything linked to them</b>: exam registrations, answer scripts, results, electives,
            their rows in the Final IA and attendance sheets, their photo and any login.
          </p>
          <p>Use it only to correct a wrong entry. A 6-digit code will be emailed to you to confirm, and the deletion is logged.</p>
        </div>
      )}

      {step === "code" && s && (
        <div className="space-y-3 text-sm">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
            <p className="font-semibold">Will be deleted:</p>
            <ul className="mt-1 list-disc pl-5 text-xs leading-5">
              <li>
                {s.students.length} student{s.students.length === 1 ? "" : "s"}
                {s.students.length <= 5 && `: ${s.students.map((x) => x.registerNumber).join(", ")}`}
              </li>
              {LINES.filter(([k]) => s[k] > 0).map(([k, label]) => (
                <li key={k}>
                  {s[k]} {label}
                </li>
              ))}
            </ul>
          </div>
          <label className="block text-slate-700">
            Code sent to <b>{request.sentTo}</b> (valid {request.minutes} minutes)
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder="6-digit code"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-center text-lg font-bold tracking-[0.4em] outline-none focus:border-slate-500"
            />
          </label>
        </div>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  );
}

export function PurgeLog({ onClose }) {
  const api = useApi();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("get", "/students/purge/log")
      .then((r) => setItems(r.data.data))
      .catch((e) => setError(err(e, "Could not load the log.")));
  }, [api]);

  return (
    <Modal open onClose={onClose} title="Student deletion log" subtitle="Requests and deletions with all records" wide>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {!items && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {items && items.length === 0 && <p className="text-sm text-slate-500">Nothing has been deleted this way.</p>}
      {items && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Who</th>
                <th className="py-2 pr-3">What</th>
                <th className="py-2">Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {items.map((l) => (
                <tr key={l._id}>
                  <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{fmt(l.at)}</td>
                  <td className="py-2 pr-3 text-slate-700">{l.by}</td>
                  <td className="py-2 pr-3">
                    {l.action === "STUDENTS_PURGED" ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">Deleted</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">Code sent</span>
                    )}
                    {l.warnings?.length > 0 && <p className="mt-1 text-amber-700">{l.warnings.join("; ")}</p>}
                  </td>
                  <td className="py-2 text-slate-700">
                    {l.count} · {l.students.slice(0, 6).map((x) => x.registerNumber).join(", ")}
                    {l.students.length > 6 && ` +${l.students.length - 6} more`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
