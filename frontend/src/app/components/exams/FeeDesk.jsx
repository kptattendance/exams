"use client";

// Fee verification for one examination.
//   Office / COE / Admin : record payments (one student, or upload Excel)
//   Exam Officer          : view only (who has not paid)
//
// Each student has a "Regular fee" (current-semester subjects) and one fee per
// back paper, ticked separately with a receipt number.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { ADMISSION_SHORT, downloadBlob, errMsg, useApi } from "./shared";

const FEE = {
  PAID: { label: "Paid", dot: "bg-emerald-500", text: "text-emerald-700" },
  PARTIAL: { label: "Partly paid", dot: "bg-orange-500", text: "text-orange-700" },
  UNPAID: { label: "Not paid", dot: "bg-red-500", text: "text-red-700" },
};

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "");

export default function FeeDesk({ examId: fixedExamId, canEdit = false, backHref, initialStatus = "" }) {
  const api = useApi();
  const toast = useToast();

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
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
                placeholder="Type register number or name"
                className="h-12 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-base outline-none focus:border-slate-500 focus:ring-4 focus:ring-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <select value={cls} onChange={(e) => setCls(e.target.value)} className={`${sel} h-12`}>
                <option value="">All classes</option>
                {classOptions.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${sel} h-12`}>
                <option value="">Any status</option>
                <option value="PENDING">Not fully paid</option>
                <option value="UNPAID">Not paid</option>
                <option value="PARTIAL">Partly paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
          </div>

          {/* list */}
          <div className="mt-4 space-y-2">
            {data === null &&
              [0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
            {data && items.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                {query ? `No registered student matches “${query}”.` : total === 0 ? "No students are registered for this exam yet." : "No students match these filters."}
              </p>
            )}
            {items.map((r) => (
              <FeeRow key={r._id} reg={r} canEdit={canEdit} onPay={() => setPaying(r)} />
            ))}
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

function FeeRow({ reg, canEdit, onPay }) {
  const st = FEE[reg.feeStatus] || FEE.UNPAID;
  const unpaid = reg.items.filter((i) => !i.paid).length;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {reg.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reg.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
            {initials(reg.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <p className="truncate font-semibold text-slate-950">{reg.name}</p>
            <p className="text-xs font-semibold tabular-nums text-slate-500">{reg.registerNumber}</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {reg.department.toUpperCase()} · Sem {reg.semester} · {ADMISSION_SHORT[reg.admissionType] || reg.admissionType}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reg.items.map((i) => (
              <span
                key={i.key}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold ${
                  i.paid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-dashed border-slate-300 bg-white text-slate-600"
                }`}
                title={i.paid ? `Receipt ${i.receiptNo}, ${fmtDate(i.paidOn)} (${i.by})` : "Not paid"}
              >
                {i.paid ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.5} /> : <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                {i.type === "REGULAR" ? "Regular" : `Back ${i.code}`}
                {i.paid && <span className="font-normal text-emerald-700/80">· {i.receiptNo}</span>}
                {(i.eligibility === "ANS" || i.eligibility === "NE") && i.type === "SUBJECT" && (
                  <span className="font-normal text-red-600">· {i.eligibility}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className={`flex items-center gap-1.5 text-xs font-semibold ${st.text}`}>
          <span className={`h-2 w-2 rounded-full ${st.dot}`} />
          {st.label}
        </span>
        {canEdit &&
          (unpaid ? (
            <button onClick={onPay} className={btn.primary}>
              Record payment
            </button>
          ) : (
            <button onClick={onPay} className={btn.secondary}>
              View / correct
            </button>
          ))}
      </div>
    </div>
  );
}

function PayModal({ examId, reg, onClose, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const unpaid = reg.items.filter((i) => !i.paid);
  const paid = reg.items.filter((i) => i.paid);
  const [keys, setKeys] = useState(() => unpaid.map((i) => i.key));
  const [receiptNo, setReceiptNo] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [removing, setRemoving] = useState(null); // item
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (k) => setKeys((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k]));

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
              onClick={() => send({ keys, paid: true, receiptNo, paidOn }, "Payment recorded.")}
              disabled={busy || !keys.length || !receiptNo.trim()}
              className={btn.primary}
            >
              {busy ? "Saving…" : `Mark ${keys.length} as paid`}
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
            Remove the payment for <b>{removing.label}</b> (receipt {removing.receiptNo})? Use this only if it was recorded by mistake.
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
                  <span className="text-sm font-semibold text-slate-800">Receipt no.</span>
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
                        Receipt {i.receiptNo} · {fmtDate(i.paidOn)} · {i.by}
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
        </>
      )}
    </Modal>
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
