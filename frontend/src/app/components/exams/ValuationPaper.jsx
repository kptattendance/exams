"use client";

// One paper's valuation (ATS coding) – kept simple:
//   status   packets are made automatically after the exam; decoding is automatic
//            when every packet is typed and checked
//   print    packet labels (COE), award lists, ATS sheet (confidential, COE)
//   packets  one per room diary: valuer, typing status
//   marks    after decoding
//   more     attendance corrections, paper maximum (rarely needed)

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { downloadBlob, errMsg, useApi } from "./shared";
import { useIsAdmin } from "../useRole";

const PACKET = {
  PENDING: { label: "Marks not typed", chip: "bg-slate-100 text-slate-600" },
  FIRST_DONE: { label: "Typed once", chip: "bg-blue-50 text-blue-700" },
  MISMATCH: { label: "Mismatch – check", chip: "bg-red-50 text-red-700" },
  VERIFIED: { label: "Done", chip: "bg-emerald-50 text-emerald-700" },
};

export default function ValuationPaper({ examId, code, backHref, canManage = false }) {
  const api = useApi();
  const toast = useToast();
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/exams/${examId}/valuation/${encodeURIComponent(code)}`);
      setD(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the paper."));
    }
  }, [api, examId, code, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (method, path, body) => {
    setBusy(true);
    try {
      const r = await api(method, `/exams/${examId}/valuation${path}`, body);
      toast.success(r.data.message || "Done.", 6000);
      await load();
      return true;
    } catch (e) {
      toast.error(errMsg(e, "Could not complete."), 8000);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (!d) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6 lg:px-7">
        <div className="h-20 animate-pulse rounded-2xl bg-white" />
        <div className="h-64 animate-pulse rounded-2xl bg-white" />
      </div>
    );
  }

  const { paper, packets } = d;
  const enc = encodeURIComponent(code);
  const printBase = `/print/valuation/${examId}/${enc}`;
  const done = packets.filter((p) => p.status === "VERIFIED").length;
  const typedAny = packets.some((p) => p.status !== "PENDING");
  const slot = paper.date
    ? `${new Date(`${paper.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, ${paper.session === "AN" ? "afternoon" : "morning"}`
    : "date not fixed";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-16 sm:px-6 lg:px-7">
      <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
        <Icon name="chevronLeft" className="h-4 w-4" />
        All papers
      </Link>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
        {paper.code} <span className="font-semibold text-slate-600">{paper.name}</span>
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Exam on {slot} · {d.candidates.length} candidates · valued out of {paper.rawMax}, reduced to {paper.seeMax || paper.rawMax}
      </p>

      {/* ---------------- where it stands ---------------- */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
        {paper.decoded ? (
          <Status tone="green" title="Decoded – marks are saved for results">
            Done automatically on {new Date(paper.decodedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
          </Status>
        ) : !paper.coded ? (
          <Status tone={d.waiting ? "orange" : "slate"} title={d.waiting ? "Waiting" : "Packets are made after the exam"}>
            {d.waiting || `Every room diary becomes one packet automatically when the exam (${slot}) is over. Nothing to press.`}
          </Status>
        ) : (
          <Status tone="blue" title={`Valuation: ${done} of ${packets.length} packets typed and checked`}>
            When the last packet is done the paper is decoded automatically. Nothing to press.
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-100">
              <span className="block h-full rounded-full bg-blue-600" style={{ width: `${packets.length ? (done / packets.length) * 100 : 0}%` }} />
            </span>
          </Status>
        )}

        {paper.coded && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canManage && (
              <a href={`/print/packet-labels/${examId}?code=${enc}`} target="_blank" rel="noreferrer" className={btn.primary}>
                <Icon name="download" className="h-4 w-4" />
                Packet labels
              </a>
            )}
            <a href={`${printBase}?sheet=award`} target="_blank" rel="noreferrer" className={btn.secondary}>
              <Icon name="report" className="h-4 w-4" />
              Award lists
            </a>
            {canManage && (
              <a href={`${printBase}?sheet=coding`} target="_blank" rel="noreferrer" className={btn.secondary}>
                <Icon name="lock" className="h-4 w-4" />
                ATS sheet (confidential)
              </a>
            )}
          </div>
        )}
      </section>

      {/* ---------------- packets ---------------- */}
      {paper.coded && packets.length > 0 && (
        <Packets
          d={d}
          busy={busy}
          canManage={canManage && !paper.decoded}
          onValuer={(p, valuer) => run("patch", `/packets/${p._id}`, { valuer })}
          onReopen={(p, reason) => run("post", `/packets/${p._id}/reopen`, { reason })}
        />
      )}

      {/* ---------------- marks (after decoding) ---------------- */}
      {paper.decoded && canManage && <Marks examId={examId} code={code} />}

      {/* ---------------- rarely needed ---------------- */}
      {!paper.decoded && (
        <details className="mt-5 rounded-2xl border border-slate-200 bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-slate-700">
            More: correct attendance{canManage && !typedAny ? " · question paper maximum" : ""}
          </summary>
          <div className="space-y-5 border-t border-slate-100 px-5 py-4">
            <Attendance d={d} busy={busy} onSave={(body) => run("post", `/${enc}/attendance`, body)} />
            {canManage && !typedAny && <PaperMax paper={paper} busy={busy} onSave={(body) => run("patch", `/${enc}`, body)} />}
          </div>
        </details>
      )}
    </div>
  );
}

function Status({ tone, title, children }) {
  const c = { green: "bg-emerald-600", blue: "bg-blue-600", orange: "bg-orange-500", slate: "bg-slate-400" }[tone];
  return (
    <div className="flex gap-3">
      <span className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${c}`} />
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-950">{title}</p>
        <div className="mt-0.5 text-sm text-slate-600">{children}</div>
      </div>
    </div>
  );
}

function Packets({ d, busy, canManage, onValuer, onReopen }) {
  const isAdmin = useIsAdmin(); // reopening wipes typed marks: Admin only
  const [reopen, setReopen] = useState(null);
  const [reason, setReason] = useState("");
  return (
    <section className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2.5">Packet</th>
            <th className="px-4 py-2.5">Room</th>
            <th className="px-4 py-2.5 text-right">Scripts</th>
            <th className="px-4 py-2.5">Valuer</th>
            <th className="px-4 py-2.5">Marks</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {d.packets.map((p) => (
            <tr key={p._id}>
              <td className="px-4 py-2 font-bold tabular-nums text-slate-900">{p.number}</td>
              <td className="px-4 py-2 text-slate-600">{p.room}</td>
              <td className="px-4 py-2 text-right tabular-nums">{p.count}</td>
              <td className="px-4 py-2">
                <ValuerInput p={p} disabled={busy || !canManage} onSave={onValuer} />
              </td>
              <td className="px-4 py-2 whitespace-nowrap">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PACKET[p.status].chip}`}>{PACKET[p.status].label}</span>
                {canManage && isAdmin && p.status === "VERIFIED" && (
                  <button onClick={() => setReopen(p)} className="ml-2 text-xs font-semibold text-slate-500 hover:text-red-600">
                    Reopen
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Modal
        open={Boolean(reopen)}
        onClose={() => setReopen(null)}
        title={`Reopen ${reopen?.number}?`}
        subtitle="Its marks are cleared and must be typed again."
        footer={
          <>
            <button onClick={() => setReopen(null)} className={btn.secondary}>
              Cancel
            </button>
            <button
              disabled={reason.trim().length < 3}
              onClick={async () => {
                if (await onReopen(reopen, reason)) {
                  setReopen(null);
                  setReason("");
                }
              }}
              className={btn.danger}
            >
              Reopen packet
            </button>
          </>
        }
      >
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Reason</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. valuer corrected the total of one script" className={`${field} mt-1.5`} />
        </label>
      </Modal>
    </section>
  );
}

function ValuerInput({ p, disabled, onSave }) {
  const [v, setV] = useState(p.valuer || "");
  return (
    <input
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (p.valuer || "") && onSave(p, v)}
      placeholder="Valuer name"
      className="h-8 w-full min-w-[9rem] rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-slate-400 disabled:border-transparent disabled:bg-transparent"
    />
  );
}

function Attendance({ d, busy, onSave }) {
  const initialAbsent = d.candidates.filter((c) => c.attendance === "ABSENT").map((c) => c.registerNumber);
  const initialMal = d.candidates.filter((c) => c.attendance === "MALPRACTICE").map((c) => c.registerNumber);
  const [absent, setAbsent] = useState(initialAbsent.join(", "));
  const [mal, setMal] = useState(initialMal.join(", "));
  const list = (t) => t.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  const known = useMemo(() => new Set(d.candidates.map((c) => c.registerNumber)), [d.candidates]);
  const unknown = [...list(absent), ...list(mal)].filter((x) => !known.has(x));
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">Attendance</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {initialAbsent.length} absent · {initialMal.length} malpractice. The Chief Examiner marks absentees on the exam day; correct them here until that packet&apos;s marks are
        typed.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Absent – register numbers</span>
          <textarea value={absent} onChange={(e) => setAbsent(e.target.value)} rows={2} className={`${field} mt-1 h-auto py-2 uppercase`} />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">Malpractice – register numbers</span>
          <textarea value={mal} onChange={(e) => setMal(e.target.value)} rows={2} className={`${field} mt-1 h-auto py-2 uppercase`} />
        </label>
      </div>
      <button disabled={busy || unknown.length > 0} onClick={() => onSave({ absent: list(absent), malpractice: list(mal) })} className={`${btn.secondary} mt-3`}>
        Save attendance
      </button>
      {unknown.length > 0 && <span className="ml-3 text-sm text-red-600">Not a candidate: {unknown.join(", ")}</span>}
    </div>
  );
}

function PaperMax({ paper, busy, onSave }) {
  const [rawMax, setRawMax] = useState(paper.rawMax);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block">
        <span className="text-sm font-semibold text-slate-900">Question paper maximum</span>
        <input type="number" value={rawMax} onChange={(e) => setRawMax(e.target.value)} className={`${field} mt-1 w-32`} />
      </label>
      <button disabled={busy || Number(rawMax) === paper.rawMax} onClick={() => onSave({ rawMax: Number(rawMax) })} className={btn.secondary}>
        Save
      </button>
      <span className="text-xs text-slate-500">Marks are reduced to the subject&apos;s maximum ({paper.seeMax || paper.rawMax}) when decoded.</span>
    </div>
  );
}

function Marks({ examId, code }) {
  const api = useApi();
  const toast = useToast();
  const [marks, setMarks] = useState(null);
  useEffect(() => {
    api("get", `/exams/${examId}/valuation/${encodeURIComponent(code)}/marks`)
      .then((r) => setMarks(r.data.data))
      .catch((e) => toast.error(errMsg(e, "Could not load the marks.")));
  }, [api, examId, code, toast]);
  if (!marks) return null;
  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold text-slate-950">Marks</p>
        <button
          onClick={() => downloadBlob(api, `/exams/${examId}/valuation/${encodeURIComponent(code)}/marks`, { format: "xlsx" }, `SEE_${code}.xlsx`).catch(() => toast.error("Could not download."))}
          className={btn.secondary}
        >
          <Icon name="download" className="h-4 w-4" />
          Marks Excel
        </button>
      </div>
      <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold text-slate-500">
            <tr>
              <th className="px-3 py-2">Register no.</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">ATS</th>
              <th className="px-3 py-2 text-right">/ {marks.paper.rawMax}</th>
              <th className="px-3 py-2 text-right">/ {marks.paper.seeMax}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {marks.rows.map((r) => (
              <tr key={r.registerNumber}>
                <td className="px-3 py-1.5 font-semibold tabular-nums">{r.registerNumber}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.name}</td>
                <td className="px-3 py-1.5 tabular-nums text-slate-500">{r.ats}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.attendance === "PRESENT" ? r.raw : r.attendance === "ABSENT" ? "AB" : "MP"}</td>
                <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${r.marks !== null && r.marks < (marks.paper.seeMin || 0) ? "text-red-600" : ""}`}>
                  {r.marks ?? "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
