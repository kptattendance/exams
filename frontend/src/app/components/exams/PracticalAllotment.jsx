"use client";

// Practical exams of an examination.
//   COE   (mode="coe")   : allots one or two examiner sets to each department,
//                          and follows the time table the HODs make
//   Admin (mode="admin") : the only one who can correct a mark after submission

import { useCallback, useEffect, useMemo, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { errMsg, useApi } from "./shared";
import { ExamSelect, NoExam, batchState, branches, dept, examinersOf, usePracticalExams, when } from "./practicalShared";

export default function PracticalAllotment({ mode = "coe" }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const admin = mode === "admin";
  const { exams, examId, setExamId } = usePracticalExams();

  const [depts, setDepts] = useState(null); // departments with their examiner sets
  const [batches, setBatches] = useState(null);
  const [department, setDepartment] = useState("");
  const [staff, setStaff] = useState([]);
  const [allot, setAllot] = useState(null); // { department, panel? }
  const [secret, setSecret] = useState(null); // { title, name, code, emailed } shown once
  const [marks, setMarks] = useState(null); // batch id whose marks are open

  const load = useCallback(async () => {
    if (!examId) return;
    try {
      const [p, b] = await Promise.all([admin ? null : api("get", `/practicals/${examId}/panels`), api("get", `/practicals/${examId}/batches`)]);
      setDepts(p ? p.data.data : []);
      setBatches(b.data.data);
    } catch (e) {
      setDepts([]);
      setBatches([]);
      toast.error(errMsg(e, "Could not load the practical exams."));
    }
  }, [api, examId, admin, toast]);

  useEffect(() => {
    setBatches(null);
    load();
  }, [load]);

  useEffect(() => {
    if (admin) return;
    api("get", "/practicals/examiners")
      .then((r) => setStaff(r.data.data))
      .catch(() => {});
  }, [api, admin]);

  const shown = useMemo(() => (batches || []).filter((b) => !department || b.department === department), [batches, department]);
  const conducting = useMemo(() => [...new Set((batches || []).map((b) => b.department))].sort(), [batches]);
  const submitted = shown.filter((b) => b.status === "SUBMITTED").length;

  const title = (p) => `${dept(p.department)} – Set ${p.number}`;

  const newCode = async (p) => {
    const ok = await confirm({
      title: `New code for ${p.external.name}?`,
      message: `${title(p)}. The old code stops working for every batch of this set. The new code is shown to you once${p.external.email ? ` and emailed to ${p.external.email}` : ""}.`,
      confirmText: "Issue new code",
    });
    if (!ok) return;
    try {
      const r = await api("post", `/practicals/panels/${p._id}/code`);
      setSecret({ title: title(p), name: p.external.name, code: r.data.code, emailed: r.data.emailed });
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not issue a new code."));
    }
  };

  const remove = async (p) => {
    const ok = await confirm({ title: `Remove ${title(p)}?`, message: examinersOf(p), confirmText: "Remove set", tone: "danger" });
    if (!ok) return;
    try {
      const r = await api("delete", `/practicals/panels/${p._id}`);
      toast.success(r.data.message);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Could not remove the set."), 8000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">{admin ? "Practical marks – corrections" : "Practical exam marks"}</h2>
      <ExamSelect exams={exams} examId={examId} setExamId={setExamId} />

      <p className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-600">
        {admin
          ? "Marks submitted by the two examiners are final. Only you can correct a mark, and every correction is recorded with your reason."
          : "Allot one or two examiner sets (internal + external) to each department. Both examiners and the HOD get an email, and the external examiner gets a secret code. The HOD then contacts them and makes the batches and the time table. The examiners enter the marks together; submitted marks are final."}
      </p>

      {exams && exams.length === 0 && <NoExam />}
      {examId && batches === null && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-white" />}

      {/* ------------------------------------------------ examiner sets (COE) */}
      {!admin && batches && depts && (
        <>
          <h3 className="mt-7 text-lg font-bold tracking-tight text-slate-950">Examiners of each department</h3>
          <div className="mt-3 space-y-3">
            {depts.map((d) => (
              <section key={d.department} className={`overflow-hidden rounded-2xl border bg-white ${d.subjects > 0 && d.panels.length === 0 ? "border-orange-200" : "border-slate-200"}`}>
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-950">{dept(d.department)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {d.subjects === 0
                        ? "No practical exams in this examination"
                        : `${d.subjects} practical subject${d.subjects > 1 ? "s" : ""} · ${d.students} student entries · ${d.batches} batch${d.batches === 1 ? "" : "es"} made${
                            d.batches ? `, ${d.submitted} submitted` : ""
                          }`}
                    </p>
                  </div>
                  {d.subjects > 0 && d.panels.length === 0 && <span className="self-start rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 sm:self-center">No examiners yet</span>}
                  {(d.subjects > 0 || d.panels.length > 0) && (
                    <button onClick={() => setAllot({ department: d.department })} className={d.panels.length ? btn.small : `${btn.primary} !px-3 !py-1.5 !text-xs`}>
                      <Icon name="plus" className="h-4 w-4" />
                      {d.panels.length ? "Add another set" : "Allot examiners"}
                    </button>
                  )}
                </div>
                {d.panels.length > 0 && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {d.panels.map((p) => (
                      <li key={p._id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center">
                        <div className="min-w-0 flex-1 text-sm text-slate-700">
                          <p>
                            <b className="text-slate-950">Set {p.number}</b> · Internal: <b>{p.internal.name}</b> · External: <b>{p.external.name}</b>
                            {p.external.college && `, ${p.external.college}`}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {[p.external.phone, p.external.email].filter(Boolean).join(" · ")}
                            {(p.external.phone || p.external.email) && " · "}
                            {p.codeLocked ? (
                              <span className="font-semibold text-red-700">Code locked after wrong tries – issue a new code</span>
                            ) : p.codeSentTo ? (
                              `Code emailed to ${p.codeSentTo}`
                            ) : (
                              "Code given by the COE office"
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setAllot({ department: d.department, panel: p })} className={btn.small}>
                            <Icon name="edit" className="h-4 w-4" />
                            Change
                          </button>
                          <button onClick={() => newCode(p)} className={btn.small}>
                            <Icon name="key" className="h-4 w-4" />
                            New code
                          </button>
                          <button onClick={() => remove(p)} className={btn.small}>
                            <Icon name="trash" className="h-4 w-4" />
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {/* ------------------------------------------------ time table and marks */}
      {batches && (
        <>
          <h3 className="mt-8 text-lg font-bold tracking-tight text-slate-950">{admin ? "Batches" : "Time table made by the HODs"}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm" aria-label="Conducting department">
              <option value="">All departments</option>
              {conducting.map((d) => (
                <option key={d} value={d}>
                  {dept(d)}
                </option>
              ))}
            </select>
            <p className="flex-1 text-sm text-slate-600">
              {shown.length} batch{shown.length === 1 ? "" : "es"} · <b className="text-slate-900">{submitted}</b> submitted
            </p>
            {shown.length > 0 && (
              <a href={`/print/practical/${examId}?sheet=timetable${department ? `&department=${department}` : ""}`} target="_blank" rel="noreferrer" className={btn.secondary}>
                <Icon name="download" className="h-4 w-4" />
                Print time table
              </a>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No batches yet. The HODs make the batches after the examiners are allotted.</p>}
            <ul className="divide-y divide-slate-100">
              {shown.map((b) => {
                const st = batchState(b);
                return (
                  <li key={b._id} className="flex flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">
                        {b.code} <span className="font-normal text-slate-600">{b.name}</span> · Batch {b.number}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {when(b)} · {b.count} students{b.branches.length > 0 && ` (${branches(b.branches)})`} · {dept(b.department)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {b.allotted ? `${b.set ? `Set ${b.set} · ` : ""}Internal: ${b.internal.name} · External: ${b.external.name}` : "Examiner set not chosen"}
                      </p>
                    </div>
                    <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold lg:self-center ${st.chip}`}>{st.label}</span>
                    {b.status === "SUBMITTED" && (
                      <button onClick={() => setMarks(b._id)} className={`${btn.small} self-start lg:self-center`}>
                        {admin ? "View / correct marks" : "View marks"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}

      {allot && (
        <AllotModal
          examId={examId}
          department={allot.department}
          panel={allot.panel}
          staff={staff}
          onClose={() => setAllot(null)}
          onDone={(code) => {
            if (code) setSecret({ title: dept(allot.department), name: code.name, code: code.code, emailed: false });
            setAllot(null);
            load();
          }}
        />
      )}

      <Modal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title="Secret code of the external examiner"
        subtitle={secret ? `${secret.title} · ${secret.name}` : ""}
        footer={
          <button onClick={() => setSecret(null)} className={btn.primary}>
            I have noted it
          </button>
        }
      >
        {secret && (
          <>
            <p className="rounded-2xl bg-slate-100 py-5 text-center text-4xl font-bold tracking-[0.3em] text-slate-950">{secret.code}</p>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              {secret.emailed ? "It was also emailed to the external examiner. " : "It could not be emailed, so give it to the external examiner yourself (phone or sealed cover). "}
              <b>This code is shown only now.</b> Never give it to the internal examiner. If it is lost, issue a new code.
            </p>
          </>
        )}
      </Modal>

      {marks && <MarksModal id={marks} admin={admin} onClose={() => setMarks(null)} onChanged={load} />}
    </div>
  );
}

function AllotModal({ examId, department, panel, staff, onClose, onDone }) {
  const api = useApi();
  const toast = useToast();
  const [internalId, setInternalId] = useState(panel?.internal.user || "");
  const [ext, setExt] = useState({ name: panel?.external.name || "", college: panel?.external.college || "", phone: panel?.external.phone || "", email: panel?.external.email || "" });
  const [busy, setBusy] = useState(false);

  // staff of the department itself first
  const sorted = useMemo(() => [...staff].sort((a, b) => (b.department === department) - (a.department === department)), [staff, department]);
  const set = (k) => (e) => setExt((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try {
      const body = { department, internalId, external: ext };
      const r = panel ? await api("patch", `/practicals/panels/${panel._id}`, body) : await api("post", `/practicals/${examId}/panels`, body);
      toast.success(r.data.message, 8000);
      onDone(r.data.code ? { code: r.data.code, name: ext.name } : null);
    } catch (e) {
      toast.error(errMsg(e, "Could not save the examiners."));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={panel ? `Change examiners – Set ${panel.number}` : "Allot an examiner set"}
      subtitle={`${dept(department)} department · they conduct the practical exams the HOD gives them`}
      footer={
        <>
          <button onClick={onClose} disabled={busy} className={btn.secondary}>
            Cancel
          </button>
          <button onClick={save} disabled={busy || !internalId || ext.name.trim().length < 3} className={btn.primary}>
            {busy ? "Saving and sending emails…" : "Save and inform"}
          </button>
        </>
      }
    >
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Internal examiner</span>
        <select value={internalId} onChange={(e) => setInternalId(e.target.value)} className={`${field} mt-1`}>
          <option value="">Choose a staff member</option>
          {sorted.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} · {String(u.department || "").toUpperCase()}
              {u.role === "hod" ? " (HOD)" : ""}
            </option>
          ))}
        </select>
      </label>

      <p className="mt-5 text-sm font-medium text-slate-700">External examiner</p>
      <div className="mt-1 grid gap-3 sm:grid-cols-2">
        <input value={ext.name} onChange={set("name")} placeholder="Name" className={field} aria-label="External examiner's name" />
        <input value={ext.college} onChange={set("college")} placeholder="College / organisation" className={field} aria-label="College" />
        <input value={ext.phone} onChange={set("phone")} placeholder="Phone" inputMode="tel" className={field} aria-label="Phone" />
        <input value={ext.email} onChange={set("email")} placeholder="Email" type="email" className={field} aria-label="Email" />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        The external examiner&apos;s secret code is emailed to this address; one code works for all his batches. Without an email, the code is shown to you once so that you can give it
        to him.{panel && " Changing the external examiner issues a new code."}
      </p>
    </Modal>
  );
}

function MarksModal({ id, admin, onClose, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [b, setB] = useState(null);
  const [edit, setEdit] = useState(null); // { registerNumber, attendance, marks, reason }
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api("get", `/practicals/batches/${id}`);
      setB(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not load the marks."));
      onClose();
    }
  }, [api, id, toast, onClose]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/practicals/batches/${id}/correct`, edit);
      toast.success(r.data.message);
      setEdit(null);
      await load();
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, "Could not save the correction."));
    }
    setBusy(false);
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title={b ? `${b.label} – marks out of ${b.max}` : "Marks"}
      subtitle={b ? `${b.name} · Internal: ${b.internal.name} · External: ${b.external.name}` : ""}
      footer={
        b && (
          <a href={`/print/practical/${b.exam}?batch=${b._id}`} target="_blank" rel="noreferrer" className={btn.secondary}>
            <Icon name="download" className="h-4 w-4" />
            Print mark list
          </a>
        )
      }
    >
      {!b && <div className="h-40 animate-pulse rounded-xl bg-slate-100" />}
      {b && (
        <>
          <ul className="divide-y divide-slate-100">
            {b.students.map((s) => (
              <li key={s.registerNumber} className="py-2">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="w-28 font-semibold tabular-nums text-slate-900">{s.registerNumber}</span>
                  <span className="min-w-0 flex-1 text-slate-700">{s.name}</span>
                  <span className="font-bold tabular-nums text-slate-950">{s.attendance === "PRESENT" ? s.marks : s.attendance === "ABSENT" ? "AB" : "MP"}</span>
                  {admin && edit?.registerNumber !== s.registerNumber && (
                    <button onClick={() => setEdit({ registerNumber: s.registerNumber, attendance: s.attendance, marks: s.marks ?? "", reason: "" })} className={btn.small}>
                      <Icon name="edit" className="h-4 w-4" />
                      Correct
                    </button>
                  )}
                </div>
                {edit?.registerNumber === s.registerNumber && (
                  <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[150px_100px_1fr]">
                    <select value={edit.attendance} onChange={(e) => setEdit({ ...edit, attendance: e.target.value })} className={field} aria-label="Attendance">
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="MALPRACTICE">Malpractice</option>
                    </select>
                    <input
                      disabled={edit.attendance !== "PRESENT"}
                      value={edit.attendance === "PRESENT" ? edit.marks : ""}
                      onChange={(e) => setEdit({ ...edit, marks: e.target.value })}
                      inputMode="numeric"
                      placeholder={`0–${b.max}`}
                      className={field}
                      aria-label="Marks"
                    />
                    <input value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} placeholder="Reason for the correction" className={field} aria-label="Reason" />
                    <div className="flex gap-2 sm:col-span-3 sm:justify-end">
                      <button onClick={() => setEdit(null)} disabled={busy} className={btn.secondary}>
                        Cancel
                      </button>
                      <button onClick={save} disabled={busy || edit.reason.trim().length < 5} className={btn.primary}>
                        {busy ? "Saving…" : "Save correction"}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {b.corrections?.length > 0 && (
            <div className="mt-4 rounded-xl bg-orange-50 p-3 text-xs leading-5 text-orange-900">
              <p className="font-semibold">Corrections made by the Admin</p>
              {b.corrections.map((c, i) => (
                <p key={i}>
                  {c.registerNumber}: {c.from.attendance === "PRESENT" ? c.from.marks : c.from.attendance} → {c.to.attendance === "PRESENT" ? c.to.marks : c.to.attendance} · {c.reason} · {c.by} ·{" "}
                  {new Date(c.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
