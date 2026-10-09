"use client";

// One paper's valuation, in four simple steps:
//   1 Attendance   2 Coding & packets   3 Valuation   4 Decode

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { downloadBlob, errMsg, useApi } from "./shared";

const PACKET = {
  PENDING: { label: "Not typed", chip: "bg-slate-100 text-slate-600" },
  FIRST_DONE: { label: "Typed once", chip: "bg-blue-50 text-blue-700" },
  MISMATCH: { label: "Mismatch – check", chip: "bg-red-50 text-red-700" },
  VERIFIED: { label: "Done", chip: "bg-emerald-50 text-emerald-700" },
};
const ROUND = { 1: "1st valuation", 2: "2nd valuation", 3: "3rd valuation" };

export default function ValuationPaper({ examId, code, backHref, canManage = false }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
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

  const run = async (method, path, body, okMsg) => {
    setBusy(true);
    try {
      const r = await api(method, `/exams/${examId}/valuation${path}`, body);
      toast.success(r.data.message || okMsg || "Done.", 6000);
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

  const { paper } = d;
  const printBase = `/print/valuation/${examId}/${encodeURIComponent(code)}`;
  const enc = encodeURIComponent(code);
  const packets = d.packets;
  const allDone = packets.length > 0 && packets.every((p) => p.status === "VERIFIED");

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
        {d.exam.name} · valued out of {paper.rawMax}, reduced to {paper.seeMax || paper.rawMax}
        {paper.date && ` · exam on ${new Date(`${paper.date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
      </p>

      <div className="mt-6 space-y-4">
        {/* ---------------- 1. Attendance ---------------- */}
        <Step n={1} title="Attendance" done={paper.coded}>
          <Attendance d={d} printHref={`${printBase}?sheet=attendance`} locked={paper.coded} onSave={(body) => run("post", `/${enc}/attendance`, body)} busy={busy} />
        </Step>

        {/* ---------------- 2. Coding ---------------- */}
        <Step n={2} title="Coding & packets" done={paper.coded} disabled={false}>
          {!paper.coded ? (
            <div>
              <p className="text-sm text-slate-600">
                Every present script gets a random <b>dummy number</b> and scripts are bundled into packets of about {paper.packetSize}. Valuers and
                the exam clerk see only dummy numbers.
              </p>
              {canManage ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    disabled={busy || !d.present}
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Generate dummy numbers?",
                        message: `${d.present} present scripts will be coded into packets.\n\nAttendance is locked after this.`,
                        confirmText: "Generate",
                      });
                      if (ok) run("post", `/${enc}/coding`);
                    }}
                    className={btn.primary}
                  >
                    Generate dummy numbers & packets
                  </button>
                  <PaperSettings paper={paper} onSave={(body) => run("patch", `/${enc}`, body)} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">The COE generates the dummy numbers.</p>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm text-slate-600">
                {d.present} scripts · {packets.filter((p) => p.round === 1).length} packets
              </span>
              {canManage && (
                <a href={`${printBase}?sheet=coding`} target="_blank" rel="noreferrer" className={btn.secondary}>
                  <Icon name="lock" className="h-4 w-4" />
                  Coding sheet (confidential)
                </a>
              )}
              <a href={`${printBase}?sheet=award&round=1`} target="_blank" rel="noreferrer" className={btn.secondary}>
                <Icon name="report" className="h-4 w-4" />
                Print award lists
              </a>
              {canManage && !paper.decoded && packets.every((p) => p.status === "PENDING") && (
                <button
                  disabled={busy}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Undo coding?",
                      message: "All dummy numbers and packets of this paper are removed. Printed award lists become invalid.",
                      confirmText: "Undo coding",
                      tone: "danger",
                    });
                    if (ok) run("post", `/${enc}/coding/undo`);
                  }}
                  className={btn.danger}
                >
                  Undo coding
                </button>
              )}
            </div>
          )}
        </Step>

        {/* ---------------- 3. Valuation ---------------- */}
        <Step n={3} title="Valuation & marks entry" done={allDone && !d.summary.NEEDS_THIRD} disabled={!paper.coded}>
          {paper.coded && (
            <Packets
              d={d}
              canManage={canManage && !paper.decoded}
              printBase={printBase}
              busy={busy}
              onValuer={(p, valuer) => run("patch", `/packets/${p._id}`, { valuer })}
              onSecond={(packetIds) => run("post", `/${enc}/second`, packetIds === "all" ? { all: true } : { packetIds })}
              onThird={() => run("post", `/${enc}/third`)}
              onReopen={(p, reason) => run("post", `/packets/${p._id}/reopen`, { reason })}
            />
          )}
        </Step>

        {/* ---------------- 4. Decode ---------------- */}
        <Step n={4} title="Decode" done={paper.decoded} disabled={!paper.coded}>
          {paper.coded && (
            <Decode
              d={d}
              canManage={canManage}
              allDone={allDone}
              busy={busy}
              examId={examId}
              code={code}
              onDecode={async () => {
                const ok = await confirm({
                  title: `Decode ${paper.code}?`,
                  message: "Dummy numbers are matched back to register numbers and the marks are saved for results. Marks entry for this paper is locked after this.",
                  confirmText: "Decode",
                  requireText: "DECODE",
                });
                if (ok) run("post", `/${enc}/decode`);
              }}
            />
          )}
        </Step>
      </div>
    </div>
  );
}

function Step({ n, title, done, disabled, children }) {
  return (
    <section className={`rounded-2xl border bg-white p-5 ${disabled ? "border-slate-100 opacity-60" : "border-slate-200"}`}>
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            done ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
          }`}
        >
          {done ? <Icon name="check" className="h-4 w-4" strokeWidth={2.5} /> : n}
        </span>
        <h3 className="font-bold text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Attendance({ d, printHref, locked, onSave, busy }) {
  const initialAbsent = d.candidates.filter((c) => c.attendance === "ABSENT").map((c) => c.registerNumber);
  const initialMal = d.candidates.filter((c) => c.attendance === "MALPRACTICE").map((c) => c.registerNumber);
  const [absent, setAbsent] = useState(initialAbsent.join(", "));
  const [mal, setMal] = useState(initialMal.join(", "));
  const list = (t) => t.split(/[\s,;]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);
  const known = useMemo(() => new Set(d.candidates.map((c) => c.registerNumber)), [d.candidates]);
  const unknown = [...list(absent), ...list(mal)].filter((x) => !known.has(x));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-2 text-sm text-slate-600">
          <b className="text-slate-900">{d.candidates.length}</b> candidates permitted ·{" "}
          <b className="text-slate-900">{initialAbsent.length}</b> absent · <b className="text-slate-900">{initialMal.length}</b> malpractice
        </span>
        <a href={printHref} target="_blank" rel="noreferrer" className={btn.secondary}>
          <Icon name="report" className="h-4 w-4" />
          Print attendance sheet
        </a>
      </div>
      {locked ? (
        <p className="mt-3 text-xs text-slate-500">Attendance is locked because the paper is coded.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Absent – register numbers</span>
            <textarea value={absent} onChange={(e) => setAbsent(e.target.value)} rows={3} placeholder="103CS25004, 103CS25017" className={`${field} mt-1.5 h-auto py-2 uppercase`} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-800">Malpractice – register numbers</span>
            <textarea value={mal} onChange={(e) => setMal(e.target.value)} rows={3} className={`${field} mt-1.5 h-auto py-2 uppercase`} />
          </label>
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <button disabled={busy || unknown.length > 0} onClick={() => onSave({ absent: list(absent), malpractice: list(mal) })} className={btn.primary}>
              Save attendance
            </button>
            {unknown.length > 0 && <span className="text-sm text-red-600">Not a candidate: {unknown.join(", ")}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function PaperSettings({ paper, onSave }) {
  const [open, setOpen] = useState(false);
  const [rawMax, setRawMax] = useState(paper.rawMax);
  const [size, setSize] = useState(paper.packetSize);
  return (
    <>
      <button onClick={() => setOpen(true)} className={btn.secondary}>
        Paper out of {paper.rawMax} · packets of {paper.packetSize}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Paper settings"
        footer={
          <>
            <button onClick={() => setOpen(false)} className={btn.secondary}>
              Cancel
            </button>
            <button
              onClick={async () => {
                if (await onSave({ rawMax: Number(rawMax), packetSize: Number(size) })) setOpen(false);
              }}
              className={btn.primary}
            >
              Save
            </button>
          </>
        }
      >
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">Question paper maximum</span>
          <input type="number" value={rawMax} onChange={(e) => setRawMax(e.target.value)} className={`${field} mt-1.5`} />
          <span className="mt-1 block text-xs text-slate-500">Marks are reduced to the subject’s theory maximum ({paper.seeMax}) when decoded.</span>
        </label>
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-slate-800">Scripts per packet</span>
          <input type="number" value={size} onChange={(e) => setSize(e.target.value)} className={`${field} mt-1.5`} />
        </label>
      </Modal>
    </>
  );
}

function Packets({ d, canManage, printBase, busy, onValuer, onSecond, onThird, onReopen }) {
  const [picked, setPicked] = useState([]);
  const [reopen, setReopen] = useState(null);
  const [reason, setReason] = useState("");
  const rounds = [1, 2, 3].filter((r) => d.packets.some((p) => p.round === r));
  const secondOf = new Set(d.packets.filter((p) => p.round === 2).map((p) => p.number.replace(/-V2$/, "")));
  const firstNoSecond = d.packets.filter((p) => p.round === 1 && !secondOf.has(p.number));

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700">{d.summary.DONE || 0} scripts final</span>
        <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{d.summary.WAITING || 0} waiting for marks</span>
        {d.summary.NEEDS_THIRD > 0 && <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">{d.summary.NEEDS_THIRD} need 3rd valuation</span>}
      </div>

      {rounds.map((r) => (
        <div key={r} className="mb-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900">{ROUND[r]}</p>
            <a href={`${printBase}?sheet=award&round=${r}`} target="_blank" rel="noreferrer" className={btn.small}>
              <Icon name="report" className="h-3.5 w-3.5" /> Award lists
            </a>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <ul className="divide-y divide-slate-100">
              {d.packets
                .filter((p) => p.round === r)
                .map((p) => (
                  <li key={p._id} className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-center">
                    {canManage && r === 1 && !secondOf.has(p.number) && (
                      <input
                        type="checkbox"
                        checked={picked.includes(p._id)}
                        onChange={(e) => setPicked((x) => (e.target.checked ? [...x, p._id] : x.filter((y) => y !== p._id)))}
                        className="h-4 w-4 accent-blue-600"
                        aria-label={`Choose ${p.number} for second valuation`}
                      />
                    )}
                    <span className="w-44 font-semibold tabular-nums text-slate-900">{p.number}</span>
                    <span className="w-20 text-xs text-slate-500">{p.count} scripts</span>
                    <ValuerInput p={p} onSave={onValuer} disabled={!canManage && false} />
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PACKET[p.status].chip}`}>{PACKET[p.status].label}</span>
                    {canManage && p.status === "VERIFIED" && (
                      <button onClick={() => setReopen(p)} className="text-xs font-semibold text-slate-500 hover:text-red-600">
                        Reopen
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ))}

      {canManage && (
        <div className="flex flex-wrap gap-2">
          {firstNoSecond.length > 0 && (
            <>
              <button disabled={busy || !picked.length} onClick={() => onSecond(picked).then(() => setPicked([]))} className={btn.secondary}>
                Send {picked.length || ""} chosen for 2nd valuation
              </button>
              <button disabled={busy} onClick={() => onSecond("all")} className={btn.secondary}>
                Send all for 2nd valuation
              </button>
            </>
          )}
          {d.summary.NEEDS_THIRD > 0 && (
            <button disabled={busy} onClick={onThird} className={btn.primary}>
              Create 3rd valuation packets ({d.summary.NEEDS_THIRD})
            </button>
          )}
        </div>
      )}

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
    </div>
  );
}

function ValuerInput({ p, onSave }) {
  const [v, setV] = useState(p.valuer || "");
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== (p.valuer || "") && onSave(p, v)}
      placeholder="Valuer name"
      className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-sm outline-none focus:border-slate-400"
    />
  );
}

function Decode({ d, canManage, allDone, busy, onDecode, examId, code }) {
  const api = useApi();
  const toast = useToast();
  const [marks, setMarks] = useState(null);
  const { paper } = d;

  useEffect(() => {
    if (!paper.decoded || !canManage) return;
    api("get", `/exams/${examId}/valuation/${encodeURIComponent(code)}/marks`)
      .then((r) => setMarks(r.data.data))
      .catch(() => {});
  }, [api, examId, code, paper.decoded, canManage]);

  if (!paper.decoded) {
    const blockers = [];
    if (!allDone) blockers.push("all packets must be typed and checked");
    if (d.summary.NEEDS_THIRD) blockers.push(`${d.summary.NEEDS_THIRD} scripts need a 3rd valuation`);
    return (
      <div>
        <p className="text-sm text-slate-600">
          When every packet is done, the COE decodes the paper: dummy numbers are matched back to register numbers and marks are reduced to{" "}
          {paper.seeMax || paper.rawMax}.
        </p>
        {blockers.length > 0 && <p className="mt-2 text-sm font-semibold text-orange-700">Not yet: {blockers.join("; ")}.</p>}
        {canManage && (
          <button disabled={busy || blockers.length > 0} onClick={onDecode} className={`${btn.primary} mt-3`}>
            <Icon name="key" className="h-4 w-4" />
            Decode {paper.code}
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-emerald-700">
        Decoded on {new Date(paper.decodedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}. Marks are saved for results.
      </p>
      {canManage && marks && (
        <>
          <button
            onClick={() =>
              downloadBlob(api, `/exams/${examId}/valuation/${encodeURIComponent(code)}/marks`, { format: "xlsx" }, `SEE_${code}.xlsx`).catch(() =>
                toast.error("Could not download.")
              )
            }
            className={`${btn.secondary} mt-3`}
          >
            <Icon name="download" className="h-4 w-4" />
            Marks Excel
          </button>
          <div className="mt-3 max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">Register no.</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-2 py-2 text-right">V1</th>
                  <th className="px-2 py-2 text-right">V2</th>
                  <th className="px-2 py-2 text-right">V3</th>
                  <th className="px-2 py-2 text-right">/ {marks.paper.rawMax}</th>
                  <th className="px-3 py-2 text-right">/ {marks.paper.seeMax}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {marks.rows.map((r) => (
                  <tr key={r.registerNumber}>
                    <td className="px-3 py-1.5 font-semibold tabular-nums">{r.registerNumber}</td>
                    <td className="px-3 py-1.5 text-slate-600">{r.name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.v1 ?? ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.v2 ?? ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.v3 ?? ""}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.attendance === "PRESENT" ? r.raw : r.attendance === "ABSENT" ? "AB" : "MP"}</td>
                    <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${r.marks !== null && r.marks < (marks.paper.seeMin || 0) ? "text-red-600" : ""}`}>
                      {r.marks ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
