"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

import { useConfirm, useToast, usePopupMessage } from "../../components/ui/Feedback";
import { sortOptions } from "../../components/sortOptions";
import { useIsAdmin } from "../../components/useRole";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const departments = [
  { value: "at", label: "Automobile Engineering" },
  { value: "ch", label: "Chemical Engineering" },
  { value: "ce", label: "Civil Engineering" },
  { value: "cs", label: "Computer Science and Engineering" },
  { value: "ec", label: "Electronics and Communication Engineering" },
  { value: "ee", label: "Electrical and Electronics Engineering" },
  { value: "me", label: "Mechanical Engineering" },
  { value: "ps", label: "Polymer Technology" },
  { value: "sc", label: "Science & English" },
  { value: "ot", label: "Other / External" },
];
departments.sort(sortOptions); // alphabetical in every drop-down

// same rule as the server (models/User.js collegeOf): no code or 103 = our college
const HOME_CODE = "103";
const isExternal = (examiner) => {
  const code = String(examiner?.collegeCode || "").trim();
  return Boolean(code) && code !== HOME_CODE;
};

// assignments whose deadline / email can still be changed
const OPEN_STATUSES = ["ASSIGNED", "UPLOADED", "RETURNED"];

const STATUS_STYLE = {
  ASSIGNED: "bg-slate-100 text-slate-700",
  UPLOADED: "bg-amber-50 text-amber-700",
  SUBMITTED: "bg-emerald-50 text-emerald-700",
  RETURNED: "bg-orange-50 text-orange-700",
  CANCELLED: "bg-red-50 text-red-600",
};

const STATUS_LABEL = {
  ASSIGNED: "Waiting for upload",
  UPLOADED: "Draft uploaded",
  SUBMITTED: "Submitted",
  RETURNED: "Returned for correction",
  CANCELLED: "Cancelled",
};

// Where a paper is in the whole journey (the status filter)
const STAGES = [
  ["ASSIGNED", "Waiting for upload"],
  ["UPLOADED", "Draft uploaded"],
  ["RETURNED", "Returned for correction"],
  ["WAIT_SCRUTINY", "Submitted – waiting for scrutiny"],
  ["IN_SCRUTINY", "Under scrutiny"],
  ["SCRUTINY_DONE", "Scrutiny finished – final PDF to upload"],
  ["FROZEN", "Frozen – set not chosen"],
  ["CHOSEN", "Frozen – chosen for the exam"],
  ["CANCELLED", "Cancelled"],
];
const stageOf = (p) => {
  if (p.status !== "SUBMITTED") return p.status;
  if (p.frozenAt) return p.examSetChosenAt ? "CHOSEN" : "FROZEN";
  if (p.scrutiny?.status === "DONE") return "SCRUTINY_DONE";
  if (p.scrutiny?.status === "IN_PROGRESS") return "IN_SCRUTINY";
  return "WAIT_SCRUTINY";
};

const inputCls =
  "h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100";

function defaultSession() {
  const d = new Date();
  // Odd semesters examined Nov/Dec, even semesters May/June
  return d.getMonth() >= 6 ? `NOV-${d.getFullYear()}` : `MAY-${d.getFullYear()}`;
}

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "—";

const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};

export default function PaperSettingPage() {
  const { getToken } = useAuth();

  const api = useCallback(
    async (method, url, data, extra = {}) => {
      const token = await getToken();
      return axios({
        method,
        url: `${API_URL}/api${url}`,
        data,
        headers: { Authorization: `Bearer ${token}` },
        ...extra,
      });
    },
    [getToken]
  );

  const [session, setSession] = useState(defaultSession());
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [allPapers, setPapers] = useState([]);
  const [typeFilter, setTypeFilter] = useState(""); // "" | INTERNAL | EXTERNAL
  const [boardFilter, setBoardFilter] = useState(""); // board that handles the subject, e.g. SC for maths
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  usePopupMessage(error); // shown as a popup too
  const toast = useToast();
  const confirmDialog = useConfirm();
  const isAdmin = useIsAdmin();

  const [showCreate, setShowCreate] = useState(false);
  const [extending, setExtending] = useState(null);
  const [selected, setSelected] = useState([]); // ids ticked for bulk actions
  const [bulkDeadline, setBulkDeadline] = useState(false);
  const [bulkBusy, setBulkBusy] = useState("");
  const [auditFor, setAuditFor] = useState(null);
  const [showSyllabus, setShowSyllabus] = useState(false);
  const [freezing, setFreezing] = useState(null); // the paper being page-set and frozen
  const [busyId, setBusyId] = useState(null);

  const flash = (msg) => toast.success(msg);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (session) params.set("examSession", session);
      if (deptFilter) params.set("department", deptFilter);
      const res = await api("get", `/paper-setting?${params}`);
      setPapers(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.error || "Could not load assignments.");
    } finally {
      setLoading(false);
    }
  }, [api, session, deptFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Internal = examiner of our college (103), External = any other college code
  // Board = who handles the subject (maths of Automobile is under SC)
  const papers = useMemo(
    () =>
      allPapers.filter(
        (p) =>
          (!typeFilter || (isExternal(p.examiner) ? "EXTERNAL" : "INTERNAL") === typeFilter) &&
          (!boardFilter || String(p.subject?.board || "").toUpperCase() === boardFilter) &&
          (!statusFilter || stageOf(p) === statusFilter)
      ),
    [allPapers, typeFilter, boardFilter, statusFilter]
  );
  const boards = useMemo(
    () => [...new Set([...allPapers.map((p) => String(p.subject?.board || "").toUpperCase()).filter(Boolean), ...(boardFilter ? [boardFilter] : [])])].sort(),
    [allPapers, boardFilter]
  );

  const counts = useMemo(() => {
    const c = { total: papers.length };
    for (const p of papers) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [papers]);

  // ---- bulk: deadline / email for many assignments at once
  // (one request per paper, the same as doing them one by one – each is logged)
  const shownIds = new Set(papers.map((p) => p._id));
  const picked = papers.filter((p) => selected.includes(p._id) && OPEN_STATUSES.includes(p.status));
  const openShown = papers.filter((p) => OPEN_STATUSES.includes(p.status));
  const allPicked = openShown.length > 0 && openShown.every((p) => selected.includes(p._id));
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () =>
    setSelected((s) => (allPicked ? s.filter((id) => !shownIds.has(id)) : [...new Set([...s, ...openShown.map((p) => p._id)])]));

  const runBulk = async (label, list, fn) => {
    const failed = [];
    for (let i = 0; i < list.length; i++) {
      setBulkBusy(`${label} ${i + 1} of ${list.length}…`);
      try {
        await fn(list[i]);
      } catch (e) {
        failed.push(`${list[i].subject?.code} Set ${list[i].setNo}: ${e.response?.data?.error || "failed"}`);
      }
    }
    setBulkBusy("");
    await load();
    return failed;
  };

  const bulkSetDeadline = async ({ mode, date, days, email }) => {
    const list = picked;
    const failed = await runBulk("Updating", list, async (p) => {
      const due = mode === "add" ? new Date(new Date(p.deadline).getTime() + Number(days) * 864e5) : new Date(date);
      await api("patch", `/paper-setting/${p._id}`, { deadline: due.toISOString() });
      if (email) await api("post", `/paper-setting/${p._id}/send-email`);
    });
    setBulkDeadline(false);
    setSelected([]);
    const ok = list.length - failed.length;
    if (failed.length) toast.error(`${ok} updated, ${failed.length} not: ${failed.join("; ")}`, 12000);
    else flash(`Deadline changed for ${ok} assignment${ok === 1 ? "" : "s"}${email ? " and the setters were emailed" : ""}.`);
  };

  const bulkEmail = async () => {
    const list = picked;
    const failed = await runBulk("Emailing", list, (p) => api("post", `/paper-setting/${p._id}/send-email`));
    setSelected([]);
    const ok = list.length - failed.length;
    if (failed.length) toast.error(`${ok} emailed, ${failed.length} not: ${failed.join("; ")}`, 12000);
    else flash(`Email sent to ${ok} paper setter${ok === 1 ? "" : "s"}.`);
  };

  const act = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      await fn();
      if (okMsg) flash(okMsg);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  // kind: "paper" or "scheme" (scheme of valuation)
  const download = async (p, kind = "paper") => {
    const scheme = kind === "scheme";
    const ok = await confirmDialog({
      title: scheme ? "Download the scheme of valuation?" : "Download this question paper?",
      message: `${p.subject?.code} – Set ${p.setNo}. Your name, time and IP address will be recorded in the activity log.`,
      confirmText: "Download",
    });
    if (!ok) return;
    return act(p._id, async () => {
      const res = await api("get", `/paper-setting/${p._id}/download${scheme ? "?kind=scheme" : ""}`, undefined, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.subject?.code}_${p.examSession}_SET${p.setNo}${scheme ? "_SCHEME" : ""}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Final PDF (saved from Word) → page setting (2 pages per side) → check → freeze for good
  const freeze = (p) => setFreezing(p);
  const freezeNow = async (p, file, layout, trim) => {
    const ok = await confirmDialog({
      title: "Freeze this question paper?",
      message: `${p.subject?.code} – Set ${p.setNo}: "${file.name}"${layout === "TWO_UP" ? " – 2 pages per side" : " – as it is"}\n\nAfter this NOBODY, including you, can open or download the paper. Only the Chief Examiner can open and print it on the exam date, from 1 hour before the session.\n\nCheck the preview carefully before you continue.`,
      confirmText: "Freeze paper",
      tone: "danger",
      requireText: "FREEZE",
    });
    if (!ok) return false;
    const body = new FormData();
    body.append("file", file);
    body.append("layout", layout);
    body.append("trim", String(trim));
    setFreezing(null);
    await act(p._id, () => api("post", `/paper-setting/${p._id}/final-pdf`, body), "Paper frozen.");
    return true;
  };

  // The set that is given for the examination (before the exam day)
  const chooseSet = async (p, chosen) => {
    const others = allPapers.filter((x) => x._id !== p._id && x.subject?._id === p.subject?._id && x.paperType === p.paperType && x.examSetChosenAt);
    const ok = await confirmDialog({
      title: chosen ? `Give Set ${p.setNo} of ${p.subject?.code} for the examination?` : `Unchoose Set ${p.setNo} of ${p.subject?.code}?`,
      message: chosen
        ? `Only this set will reach the Chief Examiner on the exam day; the other sets stay locked.${others.length ? `\n\nSet ${others.map((x) => x.setNo).join(", ")} is chosen now – it will be unchosen.` : ""}\n\nThe choice can be made or changed only before the exam day.`
        : "Then no set of this subject reaches the Chief Examiner until you choose one again (before the exam day).",
      confirmText: chosen ? "Choose this set" : "Unchoose",
      tone: chosen ? undefined : "danger",
    });
    if (!ok) return;
    act(p._id, async () => {
      const r = await api("post", `/paper-setting/${p._id}/choose-for-exam`, { chosen });
      flash(r.data?.message || "Saved.");
    });
  };

  const renderActions = (p, busy) => (
    <div className="flex flex-wrap gap-1.5">
      {["ASSIGNED", "UPLOADED", "RETURNED"].includes(p.status) && (
        <>
          <SmallBtn
            disabled={busy}
            onClick={() =>
              act(p._id, async () => {
                const res = await api("post", `/paper-setting/${p._id}/send-email`);
                flash(res.data?.syllabusAttached ? "Email sent with the syllabus." : `Email sent. No syllabus is uploaded for ${p.subject?.code}.`);
              })
            }
          >
            {p.emailSentAt ? "Remind" : "Send email"}
          </SmallBtn>
          <SmallBtn disabled={busy} onClick={() => setExtending(p)}>
            Deadline
          </SmallBtn>
        </>
      )}
      {p.status === "SUBMITTED" && (
        <>
          {/* After scrutiny: download the Word file, set the pages, upload the final PDF.
              Once the PDF is uploaded the paper is frozen – nobody opens it before the exam. */}
          {p.frozenAt ? (
            <>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700" title="Opens only for the Chief Examiner on the exam date">
                🔒 Frozen {fmtDate(p.frozenAt)}
              </span>
              {p.examSetChosenAt ? (
                <>
                  <span className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white" title={`Chosen by ${p.examSetChosenBy} on ${fmtDate(p.examSetChosenAt)}`}>
                    ★ Exam set
                  </span>
                  <SmallBtn disabled={busy} onClick={() => chooseSet(p, false)}>
                    Unchoose
                  </SmallBtn>
                </>
              ) : (
                <SmallBtn tone="dark" disabled={busy} onClick={() => chooseSet(p, true)}>
                  Choose for exam
                </SmallBtn>
              )}
            </>
          ) : p.scrutiny?.status === "DONE" ? (
            <>
              <SmallBtn tone="dark" disabled={busy} onClick={() => download(p)}>
                Download Word
              </SmallBtn>
              <SmallBtn disabled={busy} onClick={() => freeze(p)}>
                Upload final PDF
              </SmallBtn>
            </>
          ) : (
            <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700">
              {p.scrutiny?.status === "IN_PROGRESS" ? "Under scrutiny" : "Waiting for scrutiny"}
            </span>
          )}
          {p.schemeFile && (p.schemeSubmittedAt || !p.schemeRequested) && (
            <SmallBtn disabled={busy} onClick={() => download(p, "scheme")}>
              Scheme
            </SmallBtn>
          )}
        </>
      )}
      {p.status !== "CANCELLED" &&
        (p.schemeRequested ? (
          <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-[11px] font-semibold text-slate-500">
            {p.schemeSubmittedAt ? "Scheme received" : "Scheme asked"}
          </span>
        ) : (
          <SmallBtn
            disabled={busy}
            onClick={() =>
              act(p._id, async () => {
                const r = await api("post", `/paper-setting/${p._id}/request-scheme`);
                flash(r.data?.emailed ? "Scheme asked for; the setter got an email." : "Scheme asked for. The email could not be sent.");
              })
            }
          >
            Ask scheme
          </SmallBtn>
        ))}
      <SmallBtn disabled={busy} onClick={() => setAuditFor(p)}>
        Log
      </SmallBtn>
      {p.status !== "CANCELLED" && p.status !== "SUBMITTED" && (
        <SmallBtn
          tone="danger"
          disabled={busy}
          onClick={async () => {
            const ok = await confirmDialog({
              title: "Cancel this assignment?",
              message: `${p.subject?.code} – Set ${p.setNo} (${p.examiner?.name}). The examiner will no longer see it.`,
              confirmText: "Cancel assignment",
              cancelText: "Keep it",
              tone: "danger",
            });
            if (ok) act(p._id, () => api("post", `/paper-setting/${p._id}/cancel`, {}), "Assignment cancelled.");
          }}
        >
          Cancel
        </SmallBtn>
      )}
      {isAdmin && (
      <SmallBtn
        tone="danger"
        disabled={busy}
        onClick={async () => {
          const hasFiles = Boolean(p.currentFile || p.schemeFile);
          const ok = await confirmDialog({
            title: "Delete this assignment?",
            message: `${p.subject?.code} – Set ${p.setNo} (${p.examiner?.name}).

${
              hasFiles
                ? "The uploaded question paper and scheme are deleted from Google Drive too. "
                : ""
            }This cannot be undone. The activity log is kept.`,
            confirmText: "Delete",
            tone: "danger",
            // A submitted paper needs a typed confirmation
            requireText: p.status === "SUBMITTED" ? "DELETE" : undefined,
          });
          if (ok) act(p._id, () => api("delete", `/paper-setting/${p._id}`), "Assignment deleted.");
        }}
      >
        Delete
      </SmallBtn>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-7">
      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Question Paper Setting</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assign examiners, track uploads and receive encrypted question papers.
          </p>
        </div>
        <div className="flex gap-2 self-start">
          <button
            onClick={() => setShowSyllabus(true)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Syllabus files
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="text-lg leading-none">+</span> New assignment
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="no-scrollbar -mx-4 mb-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0">
        {[
          ["Total", counts.total || 0, "text-slate-900"],
          ["Waiting", counts.ASSIGNED || 0, "text-slate-700"],
          ["Draft", (counts.UPLOADED || 0) + (counts.RETURNED || 0), "text-blue-700"],
          ["Submitted", counts.SUBMITTED || 0, "text-emerald-600"],
          [
            "Overdue",
            papers.filter((p) => p.status !== "SUBMITTED" && p.status !== "CANCELLED" && new Date(p.deadline) < new Date()).length,
            "text-red-600",
          ],
        ].map(([label, n, cls]) => (
          <div key={label} className="min-w-[124px] shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:min-w-0">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${cls}`}>{n}</p>
          </div>
        ))}
      </div>

      {/* FILTERS */}
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row">
        <input
          value={session}
          onChange={(e) => setSession(e.target.value.toUpperCase())}
          placeholder="Exam session e.g. NOV-2026"
          className={`${inputCls} lg:w-56`}
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={`${inputCls} lg:w-64`}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} className={`${inputCls} lg:w-48`}>
          <option value="">All boards</option>
          {boards.map((b) => (
            <option key={b} value={b}>
              Board: {b}
            </option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={`${inputCls} lg:w-56`}>
          <option value="">Internal and external</option>
          <option value="INTERNAL">Internal ({HOME_CODE} – our college)</option>
          <option value="EXTERNAL">External (other colleges)</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} lg:w-56`}>
          <option value="">All stages</option>
          {STAGES.map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* BULK ACTIONS for the ticked assignments */}
      {(picked.length > 0 || bulkBusy) && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-sm">
          <p className="mr-auto text-sm font-semibold text-blue-900">{bulkBusy || `${picked.length} selected`}</p>
          {!bulkBusy && (
            <>
              <button onClick={() => setBulkDeadline(true)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                Change deadline
              </button>
              <button onClick={bulkEmail} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                Send email / Remind
              </button>
              <button onClick={() => setSelected([])} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-white">
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : papers.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
            <h3 className="text-sm font-semibold text-slate-900">No assignments for {session || "this filter"}</h3>
            <p className="mt-1 text-xs text-slate-400">Click “New assignment” to appoint a paper setter.</p>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={allPicked}
                      onChange={toggleAll}
                      disabled={!openShown.length || Boolean(bulkBusy)}
                      title="Select all open assignments shown"
                      className="h-4 w-4 accent-blue-600"
                    />
                  </th>
                  {["Sl.", "Subject", "Set", "Examiner", "Deadline", "Status", "Email", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {papers.map((p, i) => {
                  const overdue =
                    !["SUBMITTED", "CANCELLED"].includes(p.status) && new Date(p.deadline) < new Date();
                  const busy = busyId === p._id;
                  return (
                    <tr key={p._id} className={`border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60 ${selected.includes(p._id) ? "bg-blue-50/60" : ""}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selected.includes(p._id)}
                          onChange={() => toggle(p._id)}
                          disabled={!OPEN_STATUSES.includes(p.status) || Boolean(bulkBusy)}
                          title={OPEN_STATUSES.includes(p.status) ? "" : "Submitted or cancelled – nothing to change"}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </td>
                      <td className="px-3 py-3 text-sm tabular-nums text-slate-500">{i + 1}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900">{p.subject?.code}</p>
                        <p className="text-xs text-slate-500">{p.subject?.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {p.subject?.department}{p.subject?.board ? ` · Board ${p.subject.board}` : ""} · Sem {p.subject?.semester} · {p.paperType}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-700">Set {p.setNo}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-slate-800">{p.examiner?.name}</p>
                        <p className="text-xs text-slate-500">{p.examiner?.email}</p>
                        <p className="text-[11px] text-slate-400">
                          {isExternal(p.examiner) ? `EXTERNAL · ${p.examiner.collegeCode} ${p.examiner.collegeName || ""}` : `INTERNAL · ${HOME_CODE}`}
                        </p>
                      </td>
                      <td className={`px-3 py-3 text-xs ${overdue ? "font-semibold text-red-600" : "text-slate-600"}`}>
                        {fmtDate(p.deadline)}
                        {overdue && <p>Overdue</p>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-block rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                          {STATUS_LABEL[p.status]}
                        </span>
                        {p.submittedAt && <p className="mt-1 text-[11px] text-slate-400">{fmtDate(p.submittedAt)}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">
                        {p.emailSentAt ? (
                          <>
                            Sent {p.emailCount}×<br />
                            <span className="text-[11px] text-slate-400">{fmtDate(p.emailSentAt)}</span>
                          </>
                        ) : (
                          <span className="font-medium text-orange-600">Not sent</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {renderActions(p, busy)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phone: one card per assignment */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {papers.map((p, i) => {
              const overdue = !["SUBMITTED", "CANCELLED"].includes(p.status) && new Date(p.deadline) < new Date();
              const busy = busyId === p._id;
              return (
                <li key={p._id} className={`p-4 ${selected.includes(p._id) ? "bg-blue-50/60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    {OPEN_STATUSES.includes(p.status) && (
                      <input
                        type="checkbox"
                        checked={selected.includes(p._id)}
                        onChange={() => toggle(p._id)}
                        disabled={Boolean(bulkBusy)}
                        className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="mr-1 font-normal text-slate-400">{i + 1}.</span>
                        {p.subject?.code} <span className="font-normal text-slate-400">Set {p.setNo}</span>
                      </p>
                      <p className="truncate text-sm text-slate-600">{p.subject?.name}</p>
                    </div>
                    <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div className="col-span-2">
                      <dt className="text-slate-400">Examiner</dt>
                      <dd className="truncate font-medium text-slate-700">{p.examiner?.name} <span className="font-normal text-slate-400">{isExternal(p.examiner) ? `(external · ${p.examiner.collegeCode})` : ""}</span></dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Deadline</dt>
                      <dd className={overdue ? "font-semibold text-red-600" : "font-medium text-slate-700"}>
                        {fmtDate(p.deadline)}{overdue ? ", overdue" : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Email</dt>
                      <dd className="font-medium text-slate-700">
                        {p.emailSentAt ? `Sent ${p.emailCount}×` : <span className="text-orange-600">Not sent</span>}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3">{renderActions(p, busy)}</div>
                </li>
              );
            })}
          </ul>
          </>
        )}
      </div>

      {showCreate && (
        <CreateModal
          api={api}
          defaultSessionValue={session}
          onClose={() => setShowCreate(false)}
          onCreated={(emailSent, syllabusAttached) => {
            if (!emailSent) flash("Assigned. Email was NOT sent – use “Send email”.");
            else flash(syllabusAttached ? "Assigned and email sent with the syllabus." : "Assigned and email sent. No syllabus is uploaded for this subject.");
            load();
          }}
        />
      )}

      {extending && (
        <PromptModal
          title={`Change deadline – ${extending.subject?.code} Set ${extending.setNo}`}
          label="New deadline"
          type="datetime-local"
          initial={toLocalInput(extending.deadline)}
          onClose={() => setExtending(null)}
          onSubmit={(v) =>
            act(extending._id, async () => {
              await api("patch", `/paper-setting/${extending._id}`, { deadline: new Date(v).toISOString() });
              setExtending(null);
            }, "Deadline updated.")
          }
        />
      )}

      {bulkDeadline && <BulkDeadlineModal papers={picked} onClose={() => setBulkDeadline(false)} onSubmit={bulkSetDeadline} />}

      {auditFor && <AuditModal api={api} paper={auditFor} onClose={() => setAuditFor(null)} />}

      {showSyllabus && <SyllabusModal api={api} onClose={() => setShowSyllabus(false)} />}
      {freezing && <FreezeModal api={api} paper={freezing} onClose={() => setFreezing(null)} onFreeze={freezeNow} />}


    </div>
  );
}

function SmallBtn({ children, tone, ...props }) {
  const cls =
    tone === "dark"
      ? "bg-slate-950 text-white hover:bg-slate-800 border-slate-950"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  return (
    <button
      {...props}
      className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

function Modal({ title, onClose, children, wide, full }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className={`max-h-[94vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${full ? "max-w-[min(96vw,1600px)]" : wide ? "max-w-2xl" : "max-w-md"}`}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Page setting before freezing: the PDF the COE saved from Word (File → Save As → PDF)
// is laid out 2 pages per side on A4 landscape by the server; both are shown side by
// side to check. Only whole pages are placed and shrunk – nothing inside is changed.
const TRIMS = [0, 6, 12, 18, 24];
function FreezeModal({ api, paper, onClose, onFreeze }) {
  const [file, setFile] = useState(null);
  const [source, setSource] = useState("WEBSITE"); // WEBSITE (from the final Word file) | OWN (chosen by the COE)
  const [making, setMaking] = useState(true);
  const [layout, setLayout] = useState("TWO_UP");
  const [trim, setTrim] = useState(12);
  const [original, setOriginal] = useState("");
  const [preview, setPreview] = useState(null); // { url, pages, sheets, scale }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // first: the website makes the PDF from the final (scrutinised) Word file, by Google Docs
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api("get", `/paper-setting/${paper._id}/final-pdf/from-word`, undefined, { responseType: "blob" });
        if (!alive) return;
        setFile(new File([r.data], `${paper.subject?.code}_SET${paper.setNo}.pdf`, { type: "application/pdf" }));
        setSource("WEBSITE");
      } catch (e) {
        let msg = "The PDF could not be made from the Word file.";
        try {
          msg = JSON.parse(await e.response.data.text()).error || msg;
        } catch {
          // not a JSON error
        }
        if (alive) setError(`${msg} Use “Use my own PDF instead”.`);
      } finally {
        if (alive) setMaking(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, paper._id, paper.subject?.code, paper.setNo]);

  // the PDF as made / chosen
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOriginal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // the 2-pages-per-side version, made by the server (nothing stored)
  useEffect(() => {
    if (!file || layout !== "TWO_UP") return;
    let alive = true;
    let made = "";
    (async () => {
      setBusy(true);
      setError("");
      try {
        const body = new FormData();
        body.append("file", file);
        body.append("trim", String(trim));
        const r = await api("post", `/paper-setting/${paper._id}/final-pdf/preview`, body, { responseType: "blob" });
        if (!alive) return;
        made = URL.createObjectURL(r.data);
        setPreview({ url: made, pages: r.headers["x-pages"], sheets: r.headers["x-sheets"], scale: r.headers["x-scale"] });
      } catch (e) {
        let msg = "Could not make the 2-pages-per-side version.";
        try {
          msg = JSON.parse(await e.response.data.text()).error || msg;
        } catch {
          // not a JSON error
        }
        if (alive) setError(msg);
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [api, file, layout, trim, paper._id]);

  return (
    <Modal title={`Page setting and freeze – ${paper.subject?.code} · Set ${paper.setNo}`} onClose={onClose} full>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          The website makes the PDF from the final (scrutinised) Word file, with Google Docs – the program the paper was scrutinised in.
        </li>
        <li>It places the pages 2 per side on A4 landscape – nothing inside a page is changed.</li>
        <li>
          Check equations, figures and symbols carefully, choose how much white margin to trim, then freeze. If something does not look right, open the
          Word file, use <b>File → Save As → PDF</b> and press <b>Use my own PDF instead</b>.
        </li>
      </ol>
      {making && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">Making the PDF from the final Word file… please wait (about 10–20 seconds).</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
          {source === "OWN" && file ? `Your PDF: ${file.name} – choose another` : "Use my own PDF instead"}
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              if (!/\.pdf$/i.test(f.name)) return setError("Choose a PDF file.");
              setPreview(null);
              setError("");
              setSource("OWN");
              setFile(f);
            }}
          />
        </label>
        <span className="flex items-center gap-3 text-sm">
          {[
            ["TWO_UP", "2 pages per side (A4 landscape)"],
            ["AS_IS", "As it is (one page per side)"],
          ].map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5">
              <input type="radio" checked={layout === v} onChange={() => setLayout(v)} />
              {l}
            </label>
          ))}
        </span>
        {layout === "TWO_UP" && (
          <span className="flex items-center gap-1.5 text-sm">
            Trim white margin:
            {TRIMS.map((t) => (
              <button
                key={t}
                onClick={() => setTrim(t)}
                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${trim === t ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}
              >
                {t} mm
              </button>
            ))}
          </span>
        )}
      </div>

      {layout === "TWO_UP" && preview && (
        <p className="mt-2 text-xs text-slate-600">
          {preview.pages} page{preview.pages === "1" ? "" : "s"} → {preview.sheets} sheet{preview.sheets === "1" ? "" : "s"} (print double-sided, “flip on short edge”) ·
          pages printed at about <b>{preview.scale}%</b> of their size. Check that no text at the page edges is cut – if it is, choose a smaller trim.
        </p>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {file && (
        <div className={`mt-3 grid gap-3 ${layout === "TWO_UP" ? "lg:grid-cols-2" : ""}`}>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {source === "OWN" ? "Your PDF (saved from Word)" : "PDF made from the final Word file"}
            </p>
            {original && <iframe title="original" src={original} className="h-[65vh] w-full rounded-xl border border-slate-200" />}
          </div>
          {layout === "TWO_UP" && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">To be printed – 2 pages per side</p>
              {busy || !preview ? (
                <div className="flex h-[65vh] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">Making the preview…</div>
              ) : (
                <iframe title="two per side" src={preview.url} className="h-[65vh] w-full rounded-xl border border-slate-200" />
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
          Cancel
        </button>
        <button
          disabled={!file || busy || Boolean(error) || (layout === "TWO_UP" && !preview)}
          onClick={() => onFreeze(paper, file, layout, trim)}
          className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Freeze paper
        </button>
      </div>
    </Modal>
  );
}

// Change the deadline of many assignments: N more days each, or one date for all
function BulkDeadlineModal({ papers, onClose, onSubmit }) {
  const [mode, setMode] = useState("add");
  const [days, setDays] = useState(7);
  const [date, setDate] = useState(() => {
    const latest = papers.reduce((m, p) => Math.max(m, new Date(p.deadline).getTime()), Date.now());
    return toLocalInput(new Date(latest + 7 * 864e5));
  });
  const [email, setEmail] = useState(true);
  const [saving, setSaving] = useState(false);
  const valid = mode === "add" ? Number(days) > 0 : Boolean(date);
  const sample = papers[0];

  return (
    <Modal title={`Change deadline – ${papers.length} assignment${papers.length === 1 ? "" : "s"}`} onClose={saving ? () => {} : onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            ["add", "Extend each by days"],
            ["set", "Same date for all"],
          ].map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold ${mode === k ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              {l}
            </button>
          ))}
        </div>

        {mode === "add" ? (
          <Field label="Extend every deadline by (days)">
            <div className="flex flex-wrap items-center gap-2">
              <input type="number" min="1" max="90" className={`${inputCls} w-28`} value={days} onChange={(e) => setDays(e.target.value)} />
              {[3, 7, 15].map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                  +{d} days
                </button>
              ))}
            </div>
            {sample && Number(days) > 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                e.g. {sample.subject?.code} Set {sample.setNo}: {fmtDate(sample.deadline)} → {fmtDate(new Date(new Date(sample.deadline).getTime() + Number(days) * 864e5))}
              </p>
            )}
          </Field>
        ) : (
          <Field label="New deadline for all selected">
            <input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
          Also email each paper setter (reminder with the new deadline)
        </label>

        <div className="max-h-40 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
          {papers.map((p) => (
            <p key={p._id}>
              {p.subject?.code} Set {p.setNo} · {p.examiner?.name} · now {fmtDate(p.deadline)}
            </p>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              await onSubmit({ mode, date, days, email });
              setSaving(false);
            }}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            {saving ? "Updating…" : "Change deadlines"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function CreateModal({ api, defaultSessionValue, onClose, onCreated }) {
  const [dept, setDept] = useState("");
  const [semester, setSemester] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [examinerDept, setExaminerDept] = useState("");
  const [examiners, setExaminers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  usePopupMessage(err); // shown as a popup too

  const inAWeek = new Date(Date.now() + 7 * 864e5);
  inAWeek.setHours(17, 0, 0, 0);

  const [form, setForm] = useState({
    subjectId: "",
    examSession: defaultSessionValue || defaultSession(),
    setNo: 1,
    paperType: "THEORY",
    examinerId: "",
    examinerType: "INTERNAL",
    deadline: toLocalInput(inAWeek),
    instructions: "",
    sendEmail: true,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!dept) return setSubjects([]);
    const q = new URLSearchParams({ department: dept });
    if (semester) q.set("semester", semester);
    api("get", `/subjects/getsubjects?${q}`)
           .then((r) => setSubjects(r.data?.subjects || r.data?.data || []))
      .catch(() => setSubjects([]));
  }, [api, dept, semester]);

  // Internal = our faculty (college 103), External = faculty of other colleges
  useEffect(() => {
    const q = new URLSearchParams({ type: form.examinerType });
    if (examinerDept) q.set("department", examinerDept);
    api("get", `/paper-setting/examiners?${q}`)
      .then((r) => setExaminers(r.data?.data || []))
      .catch(() => setExaminers([]));
  }, [api, examinerDept, form.examinerType]);

  const submit = async (keepOpen) => {
    setErr("");
    if (!form.subjectId || !form.examinerId) return setErr("Select subject and examiner.");
    setSaving(true);
    try {
      const res = await api("post", "/paper-setting", {
        ...form,
        setNo: Number(form.setNo),
        deadline: new Date(form.deadline).toISOString(),
      });
      onCreated(res.data?.emailSent, res.data?.syllabusAttached);
      if (keepOpen) {
        // quick entry of the next set for the same subject
        setForm((f) => ({ ...f, setNo: Number(f.setNo) + 1, examinerId: "" }));
      } else {
        onClose();
      }
    } catch (e) {
      setErr(e.response?.data?.error || "Could not create assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Appoint question paper setter" onClose={onClose} wide>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject department">
          <select className={inputCls} value={dept} onChange={(e) => { setDept(e.target.value); set("subjectId", ""); }}>
            <option value="">Select</option>
            {departments.filter((d) => d.value !== "ot").map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Semester">
          <select className={inputCls} value={semester} onChange={(e) => { setSemester(e.target.value); set("subjectId", ""); }}>
            <option value="">All</option>
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Subject">
            <select className={inputCls} value={form.subjectId} onChange={(e) => set("subjectId", e.target.value)}>
              <option value="">{dept ? "Select subject" : "Choose department first"}</option>
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.code} – {s.name} (Sem {s.semester}{s.subjectCategory !== "REGULAR" ? `, ${s.subjectCategory}` : ""})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Exam session">
          <input className={inputCls} value={form.examSession} onChange={(e) => set("examSession", e.target.value.toUpperCase())} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Set no.">
            <input type="number" min={1} max={9} className={inputCls} value={form.setNo} onChange={(e) => set("setNo", e.target.value)} />
          </Field>
          <Field label="Paper">
            <select className={inputCls} value={form.paperType} onChange={(e) => set("paperType", e.target.value)}>
              <option value="THEORY">Theory</option>
              <option value="PRACTICAL">Practical</option>
            </select>
          </Field>
        </div>
        <Field label="Examiner from">
          <select className={inputCls} value={examinerDept} onChange={(e) => { setExaminerDept(e.target.value); set("examinerId", ""); }}>
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Examiner type">
          <select
            className={inputCls}
            value={form.examinerType}
            onChange={(e) => setForm((f) => ({ ...f, examinerType: e.target.value, examinerId: "" }))}
          >
            <option value="INTERNAL">Internal (our faculty)</option>
            <option value="EXTERNAL">External (other institution)</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Examiner">
            <select className={inputCls} value={form.examinerId} onChange={(e) => set("examinerId", e.target.value)}>
              <option value="">Select examiner</option>
              {examiners.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                  {u.designation ? `, ${u.designation}` : ""} – {u.email} ({u.department?.toUpperCase() || "—"})
                  {u.college?.external ? ` · ${u.college.code} ${u.college.name}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-1 text-[11px] text-slate-400">
            {form.examinerType === "EXTERNAL" && examiners.length === 0
              ? "No external examiner yet. "
              : ""}
            External examiners must first be added under Staff / Faculty with their college code and name, so they can sign in.
          </p>
        </div>
        <Field label="Deadline">
          <input type="datetime-local" className={inputCls} value={form.deadline} onChange={(e) => set("deadline", e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.sendEmail} onChange={(e) => set("sendEmail", e.target.checked)} className="h-4 w-4 accent-slate-900" />
          Send email to examiner now
        </label>
        <div className="sm:col-span-2">
          <Field label="Instructions to examiner (optional)">
            <textarea
              rows={3}
              className={`${inputCls} h-auto py-2`}
              value={form.instructions}
              onChange={(e) => set("instructions", e.target.value)}
              placeholder="e.g. Follow the 2025 scheme blueprint. Max marks 100, duration 3 hours."
            />
          </Field>
        </div>
      </div>

      {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Close
        </button>
        <button disabled={saving} onClick={() => submit(true)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
          Save & add next set
        </button>
        <button disabled={saving} onClick={() => submit(false)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          {saving ? "Saving…" : "Assign"}
        </button>
      </div>
    </Modal>
  );
}

// Syllabus / scheme PDFs that go with the email. Named by subject code.
function SyllabusModal({ api, onClose }) {
  const toast = useToast();
  const [files, setFiles] = useState(null);
  const [progress, setProgress] = useState("");
  const [failed, setFailed] = useState([]);
  const [dept, setDept] = useState("");
  const [sem, setSem] = useState("");

  // Filters use the department(s) and semester of each file's subject code
  const departmentsOf = [...new Set((files || []).flatMap((f) => f.departments || []))].sort();
  const semestersOf = [...new Set((files || []).flatMap((f) => f.semesters || []))].sort((a, b) => a - b);
  const shownFiles = (files || []).filter(
    (f) => (!dept || (f.departments || []).includes(dept)) && (!sem || (f.semesters || []).map(String).includes(sem))
  );
  const smallField = "h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400";

  const load = useCallback(async () => {
    try {
      const res = await api("get", "/paper-setting/syllabus");
      setFiles(res.data?.data || []);
    } catch {
      setFiles([]);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  // One request per file, so each stays under the upload size limit
  const upload = async (list) => {
    const picked = [...list];
    if (!picked.length) return;
    const bad = [];
    for (let i = 0; i < picked.length; i++) {
      setProgress(`Uploading ${i + 1} of ${picked.length}…`);
      const body = new FormData();
      body.append("file", picked[i]);
      try {
        await api("post", "/paper-setting/syllabus", body);
      } catch (e) {
        bad.push(`${picked[i].name}: ${e.response?.data?.error || "upload failed"}`);
      }
    }
    setProgress("");
    setFailed(bad);
    if (picked.length > bad.length) toast.success(`${picked.length - bad.length} file${picked.length - bad.length > 1 ? "s" : ""} uploaded.`);
    load();
  };

  const remove = async (f) => {
    try {
      await api("delete", `/paper-setting/syllabus/${f._id}`);
      load();
    } catch (e) {
      toast.error(e.response?.data?.error || "Could not remove the file.");
    }
  };

  return (
    <Modal title="Syllabus files" onClose={onClose} wide>
      <p className="text-sm text-slate-600">
        These PDFs are attached to the email of the subject. Name each file with the subject code first, e.g.{" "}
        <b>25CS31T0.pdf</b> or <b>25CS31T0 scheme.pdf</b>. You can choose many files at once.
      </p>
      <label className="mt-4 flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-6 text-center hover:border-slate-300">
        <span className="text-sm font-semibold text-slate-800">{progress || "Choose PDF files"}</span>
        <span className="mt-1 text-xs text-slate-500">A file with the same name replaces the old one</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={Boolean(progress)}
          className="hidden"
          onChange={(e) => {
            upload(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {failed.length > 0 && (
       <ul className="mt-3 list-none rounded-xl bg-red-50 py-3 pl-4 pr-4 text-sm text-red-700">
  {failed.map((m, index) => (
    <li key={m} className="mb-1">
      <span className="mr-2 font-semibold">{index + 1}.</span>
      {m}
    </li>
  ))}
</ul>
      )}

      <div className="mt-4">
        {!files ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-slate-500">No syllabus uploaded yet.</p>
        ) : (
          <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <select value={dept} onChange={(e) => setDept(e.target.value)} className={smallField}>
              <option value="">All departments</option>
              {departmentsOf.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select value={sem} onChange={(e) => setSem(e.target.value)} className={smallField}>
              <option value="">All semesters</option>
              {semestersOf.map((n) => (
                <option key={n} value={String(n)}>
                  Sem {n}
                </option>
              ))}
            </select>
            {(dept || sem) && (
              <button
                type="button"
                onClick={() => {
                  setDept("");
                  setSem("");
                }}
                className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Clear
              </button>
            )}
            <span className="ml-auto text-xs font-semibold text-slate-500">
              {shownFiles.length === files.length
                ? `${files.length} file${files.length === 1 ? "" : "s"} uploaded`
                : `${shownFiles.length} of ${files.length} files`}
            </span>
          </div>
          {shownFiles.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No file for this selection.</p>}
          <ul className="divide-y divide-slate-100 text-sm">
            {shownFiles.map((f, i) => (
              <li key={f._id} className="flex items-center gap-3 py-2">
                <span className="w-7 shrink-0 text-right tabular-nums text-slate-400">{i + 1}.</span>
                <span className="w-24 shrink-0 font-semibold text-slate-900">{f.code}</span>
                <span className="min-w-0 flex-1 truncate text-slate-600">
                  {f.name}
                  {(f.departments?.length > 0 || f.semesters?.length > 0) && (
                    <span className="block text-[11px] text-slate-400">
                      {f.departments?.join(", ")}
                      {f.semesters?.length > 0 && ` · Sem ${f.semesters.join(", ")}`}
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-400">{Math.ceil(f.size / 1024)} KB</span>
                <SmallBtn tone="danger" onClick={() => remove(f)}>
                  Remove
                </SmallBtn>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </Modal>
  );
}

function PromptModal({ title, label, type = "text", multiline, initial = "", onClose, onSubmit }) {
  const [v, setV] = useState(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <Field label={label}>
        {multiline ? (
          <textarea rows={4} className={`${inputCls} h-auto py-2`} value={v} onChange={(e) => setV(e.target.value)} />
        ) : (
          <input type={type} className={inputCls} value={v} onChange={(e) => setV(e.target.value)} />
        )}
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Cancel
        </button>
        <button disabled={!v} onClick={() => onSubmit(v)} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
          Save
        </button>
      </div>
    </Modal>
  );
}

function AuditModal({ api, paper, onClose }) {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api("get", `/paper-setting/${paper._id}/audit`)
      .then((r) => setLogs(r.data?.data || []))
      .catch((e) => setLogs({ error: e.response?.data?.error || "Could not load log." }));
  }, [api, paper._id]);

  return (
    <Modal title={`Activity log – ${paper.subject?.code} Set ${paper.setNo}`} onClose={onClose} wide>
      {!logs ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : logs.error ? (
        <p className="text-sm text-red-600">{logs.error}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {logs.map((l) => (
            <li key={l._id} className="py-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-800">{l.action.replaceAll("_", " ").toLowerCase()}</span>
                <span className="shrink-0 text-xs text-slate-400">{fmtDate(l.createdAt)}</span>
              </div>
              <p className="text-xs text-slate-500">
                {l.actorEmail || l.actorClerkId} ({l.actorRole}) · IP {l.ip || "—"}
              </p>
            </li>
          ))}
          {logs.length === 0 && <li className="py-2 text-sm text-slate-500">No activity yet.</li>}
        </ul>
      )}
    </Modal>
  );
}
