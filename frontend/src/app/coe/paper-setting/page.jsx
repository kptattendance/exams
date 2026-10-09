"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const departments = [
  { value: "at", label: "Automobile Engineering" },
  { value: "ch", label: "Chemical Engineering" },
  { value: "ce", label: "Civil Engineering" },
  { value: "cs", label: "Computer Science Engineering" },
  { value: "ec", label: "Electronics & Communication" },
  { value: "ee", label: "Electrical & Electronics" },
  { value: "me", label: "Mechanical Engineering" },
  { value: "ps", label: "Polymer Engineering" },
  { value: "sc", label: "Science & English" },
  { value: "ot", label: "Other / External" },
];

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
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [returning, setReturning] = useState(null);
  const [extending, setExtending] = useState(null);
  const [auditFor, setAuditFor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (session) params.set("examSession", session);
      if (statusFilter) params.set("status", statusFilter);
      if (deptFilter) params.set("department", deptFilter);
      const res = await api("get", `/paper-setting?${params}`);
      setPapers(res.data?.data || []);
    } catch (e) {
      setError(e.response?.data?.error || "Could not load assignments.");
    } finally {
      setLoading(false);
    }
  }, [api, session, statusFilter, deptFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { total: papers.length };
    for (const p of papers) c[p.status] = (c[p.status] || 0) + 1;
    return c;
  }, [papers]);

  const act = async (id, fn, okMsg) => {
    setBusyId(id);
    try {
      await fn();
      if (okMsg) flash(okMsg);
      await load();
    } catch (e) {
      alert(e.response?.data?.error || "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  const download = (p) =>
    act(p._id, async () => {
      if (!confirm("This download will be recorded in the audit log. Continue?")) return;
      const res = await api("get", `/paper-setting/${p._id}/download`, undefined, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.subject?.code}_${p.examSession}_SET${p.setNo}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const renderActions = (p, busy) => (
    <div className="flex flex-wrap gap-1.5">
      {["ASSIGNED", "UPLOADED", "RETURNED"].includes(p.status) && (
        <>
          <SmallBtn
            disabled={busy}
            onClick={() =>
              act(p._id, () => api("post", `/paper-setting/${p._id}/send-email`), "Email sent.")
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
          <SmallBtn tone="dark" disabled={busy} onClick={() => download(p)}>
            Download
          </SmallBtn>
          <SmallBtn disabled={busy} onClick={() => setReturning(p)}>
            Return
          </SmallBtn>
        </>
      )}
      <SmallBtn disabled={busy} onClick={() => setAuditFor(p)}>
        Log
      </SmallBtn>
      {p.status !== "CANCELLED" && p.status !== "SUBMITTED" && (
        <SmallBtn
          tone="danger"
          disabled={busy}
          onClick={() =>
            confirm("Cancel this assignment? The examiner will no longer see it.") &&
            act(p._id, () => api("post", `/paper-setting/${p._id}/cancel`, {}), "Cancelled.")
          }
        >
          Cancel
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
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <span className="text-lg leading-none">+</span> New assignment
        </button>
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} lg:w-56`}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

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
                  {["Subject", "Set", "Examiner", "Deadline", "Status", "Email", "Actions"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => {
                  const overdue =
                    !["SUBMITTED", "CANCELLED"].includes(p.status) && new Date(p.deadline) < new Date();
                  const busy = busyId === p._id;
                  return (
                    <tr key={p._id} className="border-b border-slate-100 align-top last:border-0 hover:bg-slate-50/60">
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-slate-900">{p.subject?.code}</p>
                        <p className="text-xs text-slate-500">{p.subject?.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {p.subject?.department} · Sem {p.subject?.semester} · {p.paperType}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-700">Set {p.setNo}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-slate-800">{p.examiner?.name}</p>
                        <p className="text-xs text-slate-500">{p.examiner?.email}</p>
                        <p className="text-[11px] text-slate-400">{p.examinerType}</p>
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
            {papers.map((p) => {
              const overdue = !["SUBMITTED", "CANCELLED"].includes(p.status) && new Date(p.deadline) < new Date();
              const busy = busyId === p._id;
              return (
                <li key={p._id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
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
                      <dd className="truncate font-medium text-slate-700">{p.examiner?.name} <span className="font-normal text-slate-400">{p.examinerType === "EXTERNAL" ? "(external)" : ""}</span></dd>
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
          onCreated={(emailSent) => {
            flash(emailSent ? "Assigned and email sent." : "Assigned. Email was NOT sent – use “Send email”.");
            load();
          }}
        />
      )}

      {returning && (
        <PromptModal
          title={`Return ${returning.subject?.code} Set ${returning.setNo} for correction`}
          label="Remarks for the examiner (they will see this)"
          multiline
          onClose={() => setReturning(null)}
          onSubmit={(remarks) =>
            act(returning._id, async () => {
              await api("post", `/paper-setting/${returning._id}/return`, { remarks });
              setReturning(null);
            }, "Returned to examiner.")
          }
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

      {auditFor && <AuditModal api={api} paper={auditFor} onClose={() => setAuditFor(null)} />}

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
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

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
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

  useEffect(() => {
    const q = examinerDept ? `?department=${examinerDept}` : "";
    api("get", `/paper-setting/examiners${q}`)
      .then((r) => setExaminers(r.data?.data || []))
      .catch(() => setExaminers([]));
  }, [api, examinerDept]);

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
      onCreated(res.data?.emailSent);
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
          <select className={inputCls} value={form.examinerType} onChange={(e) => set("examinerType", e.target.value)}>
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
                  {u.name} – {u.email} ({u.department?.toUpperCase() || "—"})
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-1 text-[11px] text-slate-400">
            External examiners must first be added under Staff / Faculty (department “Other”) so they can sign in.
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
