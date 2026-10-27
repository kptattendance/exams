"use client";

// Fee verification for one examination.
//   Office / COE / Admin : record payments (one student, or upload Excel)
//   Exam Officer          : view only (who has not paid)
//
// Each student has a "Regular fee" (current-semester subjects) and one fee per
// back paper, ticked separately. "✓ Paid" (or ticking many students and
// "Mark as paid") marks them at once without any details, so the exam is
// never held up. Transactions (txn no., amount, date – two or more if the
// student paid in parts) can be added later, typed or read from a scanned
// receipt.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { ADMISSION_SHORT, downloadBlob, errMsg, useApi } from "./shared";
import { T } from "../ui/table";
import { scanReceipt } from "./receiptScan";

const FEE = {
  PAID: { label: "Paid", dot: "bg-emerald-500", text: "text-emerald-700" },
  PARTIAL: { label: "Partly paid", dot: "bg-orange-500", text: "text-orange-700" },
  UNPAID: { label: "Not paid", dot: "bg-red-500", text: "text-red-700" },
};

const today = () => new Date().toISOString().slice(0, 10);
const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function FeeDesk({ examId: fixedExamId, canEdit = false, backHref, initialStatus = "" }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();

  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState(fixedExamId || "");
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(initialStatus);
  const [cls, setCls] = useState("");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [paying, setPaying] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [picked, setPicked] = useState(() => new Set()); // registration ids ticked for "Mark as paid"
  const [bulkBusy, setBulkBusy] = useState(false);
  const searchRef = useRef(null);

  // exam list (for picking an exam and for class names)
  useEffect(() => {
    (async () => {
      try {
        const r = await api("get", "/exams");
        const list = Array.isArray(r.data?.data) ? r.data.data : [];
        setExams(list);
        if (!fixedExamId && list[0]) setExamId((id) => id || list[0]._id);
      } catch (e) {
        setExams([]);
        toast.error(errMsg(e, "Could not load examinations."));
      }
    })();
  }, [api, toast, fixedExamId]);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [query, status, cls, examId]);
  useEffect(() => setPicked(new Set()), [query, status, cls, examId, page]);

  const params = useMemo(() => {
    const p = { page, limit: 40 };
    if (status) p.status = status;
    if (query) p.q = query;
    if (cls === "backlog") p.department = "backlog";
    else if (cls) {
      const [d, s] = cls.split("-");
      p.department = d;
      p.semester = s;
    }
    return p;
  }, [page, status, query, cls]);

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const r = await api("get", `/exams/${examId}/fees`, undefined, { params });
      setData(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load fees."));
      setData({ data: [], total: 0, pages: 1, counts: {} });
    }
  }, [api, examId, params, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const exam = exams?.find((e) => e._id === examId);
  const classOptions = useMemo(() => {
    if (!exam) return [];
    const out = [];
    for (const s of exam.semesters) for (const d of ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"]) out.push([`${d}-${s}`, `${d.toUpperCase()} · Sem ${s}`]);
    out.push(["backlog", "Back papers only"]);
    return out;
  }, [exam]);

  const replace = (reg) => {
    setData((d) => ({ ...d, data: d.data.map((x) => (x._id === reg._id ? reg : x)) }));
  };

  // One click: every unpaid fee of this student, details can come later
  const quickPaid = async (reg) => {
    const keys = reg.items.filter((i) => !i.paid).map((i) => i.key);
    if (!keys.length) return;
    try {
      const r = await api("post", `/exams/${examId}/registrations/${reg._id}/fee`, { keys, paid: true, paidOn: today() });
      toast.success(r.data.message || "Marked as paid.");
      replace(r.data.data);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not mark as paid."));
    }
  };

  const markPickedPaid = async () => {
    const regIds = [...picked];
    const ok = await confirm({
      title: `Mark ${regIds.length} student${regIds.length === 1 ? "" : "s"} as paid?`,
      message: "All their unpaid fees will be marked paid. Transaction details can be added later from each student's Details.",
      confirmText: "Mark as paid",
    });
    if (!ok) return;
    setBulkBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/fees/mark-paid`, { regIds });
      toast.success(r.data.message);
      setPicked(new Set());
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not mark as paid."));
    }
    setBulkBusy(false);
  };

  const togglePick = (id) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const download = async (path, name, extra = {}) => {
    const classFilter = {};
    if (params.department) classFilter.department = params.department;
    if (params.semester) classFilter.semester = params.semester;
    try {
      await downloadBlob(api, `/exams/${examId}/fees/${path}`, { ...classFilter, ...extra }, name);
    } catch {
      toast.error("Could not download the Excel file.");
    }
  };

  const counts = data?.counts || {};
  const total = (counts.PAID || 0) + (counts.PARTIAL || 0) + (counts.UNPAID || 0);
  const items = data?.data || [];
  const pickable = items.filter((r) => r.items.some((i) => !i.paid)).map((r) => r._id);
  const allPicked = pickable.length > 0 && pickable.every((id) => picked.has(id));
  const sel = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      {backHref && (
        <Link href={backHref} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900">
          <Icon name="chevronLeft" className="h-4 w-4" />
          Back to the examination
        </Link>
      )}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Fee verification</h2>
          {fixedExamId || !exams || exams.length <= 1 ? (
            <p className="mt-1 text-sm text-slate-500">{exam ? `${exam.name} · ${exam.academicYear}` : " "}</p>
          ) : (
            <select value={examId} onChange={(e) => setExamId(e.target.value)} className={`${sel} mt-2 max-w-full`}>
              {exams.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.name} · {e.academicYear}
                </option>
              ))}
            </select>
          )}
        </div>
        {examId && (
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button onClick={() => setUploading(true)} className={btn.secondary}>
                <Icon name="report" className="h-4 w-4" />
                Upload Excel
              </button>
            )}
            <button onClick={() => download("export", "fees_pending.xlsx", { status: "PENDING" })} className={btn.secondary}>
              <Icon name="download" className="h-4 w-4" />
              Pending list
            </button>
          </div>
        )}
      </div>

      {exams && exams.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
          No examination has been created yet.
        </p>
      )}

      {examId && (
        <>
          {/* tiles */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile n={total} label="Students" active={!status} onClick={() => setStatus("")} />
            {["PAID", "PARTIAL", "UNPAID"].map((k) => (
              <Tile key={k} n={counts[k] || 0} label={FEE[k].label} dot={FEE[k].dot} active={status === k} onClick={() => setStatus(status === k ? "" : k)} />
            ))}
          </div>
          {total > 0 && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" title="Paid / partly paid / not paid">
              <div className="flex h-full">
                <span className="bg-emerald-500" style={{ width: `${((counts.PAID || 0) / total) * 100}%` }} />
                <span className="bg-orange-400" style={{ width: `${((counts.PARTIAL || 0) / total) * 100}%` }} />
              </div>
            </div>
          )}

          {/* search */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                placeholder="Register number or name"
                className={`${T.field} h-10 w-72 pl-8 text-sm`}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={cls} onChange={(e) => setCls(e.target.value)} className={T.field}>
                <option value="">All classes</option>
                {classOptions.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={T.field}>
                <option value="">Any status</option>
                <option value="PENDING">Not fully paid</option>
                <option value="UNPAID">Not paid</option>
                <option value="PARTIAL">Partly paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>

          {canEdit && (
            <p className="mt-3 text-xs text-slate-500">
              Tick students and click <b>Mark as paid</b>, or use <b>✓ Paid</b> on a row. Transaction no., amount and date can be added
              later under <b>Details</b> (type them or scan the receipt).
            </p>
          )}

          {canEdit && picked.size > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
              <span className="font-semibold text-blue-900">{picked.size} selected</span>
              <button onClick={() => setPicked(new Set())} className="text-xs font-semibold text-blue-700 hover:underline">
                Clear
              </button>
              <button onClick={markPickedPaid} disabled={bulkBusy} className={`${btn.primary} ml-auto py-2`}>
                <Icon name="check" className="h-4 w-4" />
                {bulkBusy ? "Saving…" : "Mark as paid"}
              </button>
            </div>
          )}

          {/* list */}
          <div className={`mt-4 ${T.wrap}`}>
            {data === null && <div className="h-48 animate-pulse" />}
            {data && items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {query ? `No registered student matches “${query}”.` : total === 0 ? "No students are registered for this exam yet." : "No students match these filters."}
              </p>
            )}
            {items.length > 0 && (
              <table className={T.table}>
                <thead>
                  <tr className={T.headRow}>
                    {canEdit && (
                      <th className={`${T.th} w-8`}>
                        <input
                          type="checkbox"
                          aria-label="Select all not-paid students on this page"
                          checked={allPicked}
                          disabled={!pickable.length}
                          onChange={() => setPicked(allPicked ? new Set() : new Set(pickable))}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </th>
                    )}
                    <th className={T.thNum}>Sl.</th>
                    <th className={T.th}>Student</th>
                    <th className={T.th}>Class</th>
                    <th className={T.th}>Fees</th>
                    <th className={T.th}>Status</th>
                    {canEdit && <th className={`${T.th} text-right`}>Action</th>}
                  </tr>
                </thead>
                <tbody className={T.body}>
                  {items.map((r, i) => (
                    <FeeRow
                      key={r._id}
                      sl={(page - 1) * 40 + i + 1}
                      reg={r}
                      canEdit={canEdit}
                      picked={picked.has(r._id)}
                      onPick={() => togglePick(r._id)}
                      onQuickPaid={() => quickPaid(r)}
                      onPay={() => setPaying(r)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {data && data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className={btn.small}>
                <Icon name="chevronLeft" className="h-4 w-4" /> Previous
              </button>
              <span className="text-slate-500">
                Page {page} of {data.pages}
              </span>
              <button disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)} className={btn.small}>
                Next <Icon name="chevronRight" className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {paying && (
        <PayModal
          examId={examId}
          reg={paying}
          onClose={() => setPaying(null)}
          onChanged={(reg) => {
            replace(reg);
            load();
          }}
          onSaved={(reg) => {
            replace(reg);
            setPaying(null);
            load(); // refresh counts
            setQ("");
            setTimeout(() => searchRef.current?.focus(), 50);
          }}
        />
      )}
      {uploading && (
        <UploadModal
          examId={examId}
          onClose={() => setUploading(false)}
          onTemplate={() => download("template", "fee_pending.xlsx")}
          onDone={() => {
            setUploading(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Tile({ n, label, dot, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border bg-white px-4 py-3 text-left transition hover:border-slate-300 ${active ? "border-blue-600 ring-4 ring-blue-50" : "border-slate-200"}`}
    >
      <p className="text-2xl font-bold tabular-nums tracking-tight text-slate-950">{n}</p>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
        {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
        {label}
      </p>
    </button>
  );
}

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function FeeRow({ sl, reg, canEdit, picked, onPick, onQuickPaid, onPay }) {
  const st = FEE[reg.feeStatus] || FEE.UNPAID;
  const unpaid = reg.items.filter((i) => !i.paid).length;
  const [busy, setBusy] = useState(false);
  const payments = reg.payments || [];
  return (
    <tr className={`${T.row} ${picked ? "bg-blue-50/50" : ""}`}>
      {canEdit && (
        <td className={T.td}>
          {unpaid > 0 && (
            <input type="checkbox" aria-label={`Select ${reg.name}`} checked={picked} onChange={onPick} className="h-4 w-4 accent-blue-600" />
          )}
        </td>
      )}
      <td className={T.tdNum}>{sl}</td>
      <td className={T.td}>
        <div className="flex items-center gap-2.5">
          {reg.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reg.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">
              {initials(reg.name)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-950">{reg.name}</p>
            <p className="text-[11px] font-semibold tabular-nums text-slate-500">{reg.registerNumber}</p>
          </div>
        </div>
      </td>
      <td className={`${T.td} whitespace-nowrap text-xs text-slate-600`}>
        {reg.department.toUpperCase()} · Sem {reg.semester}
        <p className="text-[11px] text-slate-400">{ADMISSION_SHORT[reg.admissionType] || reg.admissionType}</p>
      </td>
      <td className={T.td}>
        <div className="flex flex-wrap gap-1">
          {reg.items.map((i) => (
            <span
              key={i.key}
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${
                i.paid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-dashed border-slate-300 bg-white text-slate-600"
              }`}
              title={i.paid ? (i.receiptNo ? `Receipt ${i.receiptNo}, ${fmtDate(i.paidOn)} (${i.by})` : `Paid · ${fmtDate(i.paidOn)} (${i.by})`) : "Not paid"}
            >
              {i.paid ? <Icon name="check" className="h-3 w-3" strokeWidth={2.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
              {i.type === "REGULAR" ? "Regular" : `Back ${i.code}`}
              {i.paid && i.receiptNo && <span className="font-normal text-emerald-700/80">· {i.receiptNo}</span>}
              {(i.eligibility === "ANS" || i.eligibility === "NE") && i.type === "SUBJECT" && (
                <span className="font-normal text-red-600">· {i.eligibility}</span>
              )}
            </span>
          ))}
        </div>
      </td>
      <td className={T.td}>
        <span className={`${T.pill} bg-slate-50 ${st.text}`}>
          <span className={`${T.dot} ${st.dot}`} />
          {st.label}
        </span>
        {payments.length > 0 && (
          <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-600">
            {rupees(reg.amountPaid)} · {payments.length} txn{payments.length === 1 ? "" : "s"}
          </p>
        )}
      </td>
      {canEdit && (
        <td className={`${T.td} text-right`}>
          <div className="flex justify-end gap-1.5">
            {unpaid > 0 && (
              <button
                onClick={async () => {
                  setBusy(true);
                  await onQuickPaid();
                  setBusy(false);
                }}
                disabled={busy}
                title="Mark every unpaid fee of this student as paid"
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} />
                {busy ? "…" : "Paid"}
              </button>
            )}
            <button onClick={onPay} className={btn.small}>
              Details
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function PayModal({ examId, reg: initialReg, onClose, onSaved, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [reg, setReg] = useState(initialReg); // updated as transactions are added
  const unpaid = reg.items.filter((i) => !i.paid);
  const paid = reg.items.filter((i) => i.paid);
  const [keys, setKeys] = useState(() => unpaid.map((i) => i.key));
  const [receiptNo, setReceiptNo] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [removing, setRemoving] = useState(null); // item
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (k) => setKeys((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));
  const openKeys = keys.filter((k) => unpaid.some((i) => i.key === k));

  const changed = (r) => {
    setReg(r);
    onChanged?.(r);
  };

  const send = async (body, ok) => {
    setBusy(true);
    try {
      const r = await api("post", `/exams/${examId}/registrations/${reg._id}/fee`, body);
      toast.success(r.data.message || ok);
      onSaved(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={reg.name}
      subtitle={`${reg.registerNumber} · ${reg.department.toUpperCase()} Sem ${reg.semester}`}
      footer={
        removing ? (
          <>
            <button onClick={() => setRemoving(null)} disabled={busy} className={btn.secondary}>
              Back
            </button>
            <button
              onClick={() => send({ keys: [removing.key], paid: false, reason }, "Payment removed.")}
              disabled={busy || reason.trim().length < 3}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              Remove payment
            </button>
          </>
        ) : unpaid.length ? (
          <>
            <button onClick={onClose} disabled={busy} className={btn.secondary}>
              Cancel
            </button>
            <button
              onClick={() => send({ keys: openKeys, paid: true, receiptNo, paidOn }, "Payment recorded.")}
              disabled={busy || !openKeys.length}
              className={btn.primary}
            >
              {busy ? "Saving…" : `Mark ${openKeys.length} as paid`}
            </button>
          </>
        ) : (
          <button onClick={onClose} className={btn.secondary}>
            Close
          </button>
        )
      }
    >
      {removing ? (
        <div>
          <p className="text-sm text-slate-700">
            Remove the payment for <b>{removing.label}</b>
            {removing.receiptNo ? ` (receipt ${removing.receiptNo})` : ""}? Use this only if it was recorded by mistake.
          </p>
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-slate-800">Reason (kept in the record)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. Entered for the wrong student" className={`${field} mt-1.5`} />
          </label>
        </div>
      ) : (
        <>
          {unpaid.length > 0 && (
            <>
              <p className="text-sm font-semibold text-slate-800">Paying for</p>
              <div className="mt-2 space-y-2">
                {unpaid.map((i) => (
                  <label
                    key={i.key}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm ${keys.includes(i.key) ? "border-blue-600 bg-blue-50/60" : "border-slate-200"}`}
                  >
                    <input type="checkbox" checked={keys.includes(i.key)} onChange={() => toggle(i.key)} className="h-4 w-4 accent-blue-600" />
                    <span className="flex-1 font-medium text-slate-900">{i.label}</span>
                    {(i.eligibility === "ANS" || i.eligibility === "NE") && (
                      <span className="text-xs font-semibold text-red-600">Not permitted ({i.eligibility})</span>
                    )}
                  </label>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">
                    Receipt no. <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} autoFocus className={`${field} mt-1.5`} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Paid on</span>
                  <input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} className={`${field} mt-1.5`} />
                </label>
              </div>
            </>
          )}
          {paid.length > 0 && (
            <div className={unpaid.length ? "mt-6 border-t border-slate-100 pt-4" : ""}>
              <p className="text-sm font-semibold text-slate-800">Already paid</p>
              <ul className="mt-2 space-y-2">
                {paid.map((i) => (
                  <li key={i.key} className="flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm">
                    <Icon name="check" className="h-4 w-4 text-emerald-700" strokeWidth={2.5} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-slate-900">{i.label}</span>
                      <span className="block text-xs text-slate-600">
                        {i.receiptNo ? `Receipt ${i.receiptNo} · ` : ""}
                        {fmtDate(i.paidOn)} · {i.by}
                      </span>
                    </span>
                    <button onClick={() => setRemoving(i)} className="text-xs font-semibold text-red-600 hover:underline">
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Payments examId={examId} reg={reg} markKeys={openKeys} onChanged={changed} />
        </>
      )}
    </Modal>
  );
}

// Transactions of one student: add (typed or read from a scanned receipt) / remove
function Payments({ examId, reg, markKeys, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const blank = { txnNo: "", amount: "", paidOn: today(), note: "" };
  const [form, setForm] = useState(blank);
  const [source, setSource] = useState("MANUAL");
  const [alsoMark, setAlsoMark] = useState(true);
  const [scan, setScan] = useState(null); // null | number (progress) | "done"
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const payments = reg.payments || [];
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onScan = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScan(0);
    try {
      const r = await scanReceipt(file, (p) => setScan(p));
      setForm((f) => ({
        ...f,
        txnNo: r.txnNo || f.txnNo,
        amount: r.amount || f.amount,
        paidOn: r.paidOn || f.paidOn,
      }));
      setSource("SCAN");
      setScan("done");
      if (!r.txnNo && !r.amount) toast.info("Could not read the details clearly. Please type them.");
    } catch {
      setScan(null);
      toast.error("Could not read the image. Please type the details.");
    }
  };

  const add = async () => {
    setBusy(true);
    try {
      const body = { ...form, source, keys: alsoMark ? markKeys : [] };
      const r = await api("post", `/exams/${examId}/registrations/${reg._id}/payments`, body);
      toast.success(r.data.message);
      if (r.data.warning) toast.error(r.data.warning);
      onChanged(r.data.data);
      setForm(blank);
      setSource("MANUAL");
      setScan(null);
    } catch (e) {
      toast.error(errMsg(e, "Could not add the payment."));
    }
    setBusy(false);
  };

  const remove = async (p) => {
    const ok = await confirm({
      title: "Remove this transaction?",
      message: `${p.txnNo || "No txn no."} · ${p.amount != null ? rupees(p.amount) : "no amount"}\n\nPaid / not paid status is not changed.`,
      confirmText: "Remove",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const r = await api("delete", `/exams/${examId}/registrations/${reg._id}/payments/${p._id}`);
      toast.success(r.data.message);
      onChanged(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not remove."));
    }
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-slate-800">
          Transactions <span className="font-normal text-slate-400">(optional – add any time)</span>
        </p>
        {payments.length > 0 && <p className="text-sm font-bold tabular-nums text-slate-900">Total {rupees(reg.amountPaid)}</p>}
      </div>

      {payments.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {payments.map((p) => (
            <li key={p._id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-semibold tabular-nums text-slate-900">{p.txnNo || "—"}</span>
                <span className="block text-xs text-slate-500">
                  {fmtDate(p.paidOn)} · {p.by}
                  {p.source === "SCAN" ? " · scanned" : ""}
                </span>
              </span>
              <span className="font-semibold tabular-nums text-slate-900">{p.amount != null ? rupees(p.amount) : ""}</span>
              <button onClick={() => remove(p)} className="text-xs font-semibold text-red-600 hover:underline">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-600">Add a transaction</p>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={typeof scan === "number"} className={btn.small}>
            <Icon name="ticket" className="h-3.5 w-3.5" />
            {typeof scan === "number" ? `Reading… ${scan}%` : "Scan receipt"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onScan} />
        </div>
        {scan === "done" && (
          <p className="mt-2 text-xs font-medium text-emerald-700">Filled from the receipt – please check before adding.</p>
        )}
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Txn / UTR / receipt no.</span>
            <input value={form.txnNo} onChange={set("txnNo")} className={`${field} mt-1 h-10`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Amount (₹)</span>
            <input type="number" min="0" inputMode="decimal" value={form.amount} onChange={set("amount")} className={`${field} mt-1 h-10`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Paid on</span>
            <input type="date" value={form.paidOn} max={today()} onChange={set("paidOn")} className={`${field} mt-1 h-10`} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {markKeys.length > 0 ? (
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={alsoMark} onChange={(e) => setAlsoMark(e.target.checked)} className="h-4 w-4 accent-blue-600" />
              Also mark the ticked fee{markKeys.length === 1 ? "" : "s"} as paid
            </label>
          ) : (
            <span />
          )}
          <button onClick={add} disabled={busy || (!form.txnNo.trim() && form.amount === "")} className={`${btn.primary} py-2`}>
            {busy ? "Adding…" : "Add transaction"}
          </button>
        </div>
      </div>
    </div>
  );
}

const ROW_STATE = {
  OK: { label: "Will be saved", chip: "bg-emerald-50 text-emerald-700" },
  SKIP: { label: "Already paid", chip: "bg-slate-100 text-slate-500" },
  ERROR: { label: "Problem", chip: "bg-red-50 text-red-700" },
};

function UploadModal({ examId, onClose, onTemplate, onDone }) {
  const api = useApi();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const send = async (apply) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api("post", `/exams/${examId}/fees/import${apply ? "?apply=1" : ""}`, fd);
      if (apply) {
        toast.success(`${r.data.summary.ok} payments saved.`);
        onDone();
        return;
      }
      setPreview(r.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not read the file."));
    }
    setBusy(false);
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title="Upload fee Excel"
      subtitle="Nothing is saved until you check the preview."
      footer={
        preview ? (
          <>
            <button onClick={() => setPreview(null)} disabled={busy} className={btn.secondary}>
              Choose another file
            </button>
            <button onClick={() => send(true)} disabled={busy || !preview.summary.ok} className={btn.primary}>
              {busy ? "Saving…" : `Save ${preview.summary.ok} payments`}
            </button>
          </>
        ) : (
          <>
            <button onClick={onClose} disabled={busy} className={btn.secondary}>
              Cancel
            </button>
            <button onClick={() => send(false)} disabled={busy || !file} className={btn.primary}>
              {busy ? "Checking…" : "Check file"}
            </button>
          </>
        )
      }
    >
      {!preview ? (
        <>
          <ol className="space-y-3 text-sm leading-6 text-slate-600">
            <li className="flex gap-3">
              <Step n={1} />
              <span>
                <button onClick={onTemplate} className="font-semibold text-blue-700 hover:underline">
                  Download the pending list
                </button>{" "}
                – it already has every student who still has to pay.
              </span>
            </li>
            <li className="flex gap-3">
              <Step n={2} />
              <span>
                Fill <b>Receipt No</b> and <b>Paid On</b> for those who paid. Leave <b>Pays</b> as ALL, or write <i>Regular</i> and/or back-paper codes.
              </span>
            </li>
            <li className="flex gap-3">
              <Step n={3} />
              <span>Upload it here.</span>
            </li>
          </ol>
          <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:border-slate-400">
            <Icon name="report" className="h-7 w-7 text-slate-400" />
            <span className="mt-2 text-sm font-semibold text-slate-800">{file ? file.name : "Choose Excel file"}</span>
            <span className="text-xs text-slate-500">.xlsx, .xls or .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Count n={preview.summary.ok} label="Will be saved" tone="text-emerald-700" />
            <Count n={preview.summary.skipped} label="Already paid" tone="text-slate-500" />
            <Count n={preview.summary.errors} label="Problems" tone="text-red-600" />
          </div>
          <div className="mt-4 max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Receipt</th>
                  <th className="px-3 py-2">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...preview.rows]
                  .sort((a, b) => (a.state === "ERROR" ? -1 : 0) - (b.state === "ERROR" ? -1 : 0))
                  .map((r) => (
                    <tr key={r.row}>
                      <td className="px-3 py-2 tabular-nums text-slate-500">{r.row}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold tabular-nums">{r.registerNumber}</span>
                        {r.name && <span className="block text-xs text-slate-500">{r.name}</span>}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{r.receiptNo}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-md px-1.5 py-0.5 text-xs font-semibold ${ROW_STATE[r.state].chip}`}>{ROW_STATE[r.state].label}</span>
                        <span className="block text-xs text-slate-500">{r.message || (r.items || []).join(", ")}</span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {preview.summary.errors > 0 && (
            <p className="mt-3 text-xs text-slate-500">Rows with problems are skipped. Fix them in the Excel and upload again later.</p>
          )}
        </>
      )}
    </Modal>
  );
}

const Step = ({ n }) => (
  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{n}</span>
);
const Count = ({ n, label, tone }) => (
  <div className="rounded-xl bg-slate-50 py-2.5">
    <p className={`text-xl font-bold tabular-nums ${tone}`}>{n}</p>
    <p className="text-xs font-medium text-slate-500">{label}</p>
  </div>
);
