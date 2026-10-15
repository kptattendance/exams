"use client";

// QP scrutiniser: every submitted question paper.
//   Start  → the paper opens as a Google Doc that only this account can edit
//   Finish → the Doc becomes the final Word paper (encrypted), the setter is
//            shown the note and the changed lines, and the Doc is deleted
// The setter's name is never shown here.

import { useCallback, useEffect, useState } from "react";

import Modal from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/Feedback";
import { errMsg, useApi } from "../components/exams/shared";
import { ChangeList } from "../components/exams/ChangeList";

const defaultSession = () => {
  const d = new Date();
  return d.getMonth() >= 6 ? `NOV-${d.getFullYear()}` : `MAY-${d.getFullYear()}`;
};
const fmt = (d) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "");

const STATE = {
  PENDING: { label: "To scrutinise", chip: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "Open in Google Docs", chip: "bg-blue-50 text-blue-700" },
  DONE: { label: "Scrutinised", chip: "bg-emerald-50 text-emerald-700" },
};

export default function ScrutinyPage() {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const [session, setSession] = useState(defaultSession);
  const [papers, setPapers] = useState(null);
  const [busy, setBusy] = useState("");
  const [finishing, setFinishing] = useState(null);
  const [note, setNote] = useState("");
  const [scheme, setScheme] = useState(null);
  const [open, setOpen] = useState("");
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await api("get", "/paper-setting/scrutiny", undefined, { params: { examSession: session || undefined } });
      setPapers(r.data.data);
    } catch (e) {
      setPapers([]);
      toast.error(errMsg(e, "Could not load the papers."));
    }
  }, [api, session, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (p) => setPapers((list) => list.map((x) => (x._id === p._id ? p : x)));

  const start = async (p) => {
    // Open the tab now: browsers block tabs opened after a slow request
    const tab = window.open("", "_blank");
    setBusy(p._id);
    try {
      const r = await api("post", `/paper-setting/${p._id}/scrutiny/start`);
      replace(r.data.data);
      if (tab) tab.location.href = r.data.url;
      else window.location.href = r.data.url;
    } catch (e) {
      tab?.close();
      toast.error(errMsg(e, "Could not open the paper."));
    } finally {
      setBusy("");
    }
  };

  const finish = async () => {
    const p = finishing;
    setBusy(p._id);
    try {
      const r = await api("post", `/paper-setting/${p._id}/scrutiny/finish`, { note });
      replace(r.data.data);
      setFinishing(null);
      setNote("");
      setOpen(p._id);
      toast.success(`Scrutiny finished: ${r.data.data.scrutiny.removed} lines removed, ${r.data.data.scrutiny.added} added.`);
    } catch (e) {
      toast.error(errMsg(e, "Could not finish the scrutiny."));
    } finally {
      setBusy("");
    }
  };

  const cancel = async (p) => {
    const ok = await confirm({
      title: "Discard the changes?",
      message: "The Google Doc is deleted and the paper stays as it was before you opened it.",
      confirmText: "Discard",
      tone: "danger",
    });
    if (!ok) return;
    setBusy(p._id);
    try {
      const r = await api("post", `/paper-setting/${p._id}/scrutiny/cancel`);
      replace(r.data.data);
    } catch (e) {
      toast.error(errMsg(e, "Could not discard."));
    } finally {
      setBusy("");
    }
  };

  const showScheme = async (p) => {
    try {
      const r = await api("get", `/paper-setting/${p._id}/scrutiny/scheme`);
      setScheme({ paper: p, html: r.data.preview?.html || "" });
    } catch (e) {
      toast.error(errMsg(e, "Could not open the scheme."));
    }
  };

  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40";
  const deptOf = (p) => String(p.subject?.department || "").toUpperCase();
  const departments = [...new Set((papers || []).map(deptOf).filter(Boolean))].sort();
  const semesters = [...new Set((papers || []).map((p) => p.subject?.semester).filter(Boolean))].sort((a, b) => a - b);
  const shown = (papers || []).filter(
    (p) => (!department || deptOf(p) === department) && (!semester || String(p.subject?.semester) === semester)
  );
  const done = shown.filter((p) => p.scrutiny.status === "DONE").length;
  const select = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Question paper scrutiny</h2>
      <p className="mt-1 text-sm text-slate-500">
        Correct the paper directly in Google Docs, then press Finish. The setter sees your note and the changed lines; only the COE
        can download the final paper.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={session}
          onChange={(e) => setSession(e.target.value.toUpperCase())}
          placeholder="Exam session e.g. NOV-2026"
          className="h-10 w-56 rounded-xl border border-slate-200 bg-white px-3 text-sm"
        />
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={select}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className={select}>
          <option value="">All semesters</option>
          {semesters.map((n) => (
            <option key={n} value={String(n)}>
              Semester {n}
            </option>
          ))}
        </select>
        {papers && (
          <span className="text-sm text-slate-600">
            <b className="text-slate-900">{shown.length}</b> paper{shown.length === 1 ? "" : "s"} · {done} scrutinised ·{" "}
            {shown.length - done} left
          </span>
        )}
      </div>

      {!papers && <div className="mt-5 h-64 animate-pulse rounded-2xl bg-white" />}
      {papers && (
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {shown.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">No submitted paper for this selection.</p>}
          <ul className="divide-y divide-slate-100">
            {shown.map((p, i) => {
              const s = p.scrutiny;
              const st = STATE[s.status] || STATE.PENDING;
              const working = busy === p._id;
              return (
                <li key={p._id} className="px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-950">
                        <span className="mr-1 font-normal tabular-nums text-slate-400">{i + 1}.</span>
                        {p.subject?.code} <span className="font-normal text-slate-600">{p.subject?.name}</span>
                        <span className="ml-1 text-xs font-normal text-slate-500">
                          · Set {p.setNo}
                          {p.paperType === "PRACTICAL" && " · Practical"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {deptOf(p)} · Semester {p.subject?.semester} · submitted {fmt(p.submittedAt)}
                        {s.status === "DONE" && ` · scrutinised ${fmt(s.doneAt)} · ${s.removed} removed, ${s.added} added`}
                      </p>
                    </div>
                    <span className={`self-start rounded-full px-2.5 py-1 text-xs font-semibold sm:self-center ${st.chip}`}>{st.label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {p.hasScheme && (
                        <button onClick={() => showScheme(p)} className={`${btn} border-slate-200 bg-white text-slate-700`}>
                          Scheme
                        </button>
                      )}
                      {s.status === "IN_PROGRESS" ? (
                        <>
                          <a href={s.editUrl} target="_blank" rel="noreferrer" className={`${btn} border-blue-200 bg-blue-50 text-blue-700`}>
                            Open Google Doc
                          </a>
                          <button disabled={working} onClick={() => setFinishing(p)} className={`${btn} border-emerald-600 bg-emerald-600 text-white`}>
                            Finish
                          </button>
                          <button disabled={working} onClick={() => cancel(p)} className={`${btn} border-red-200 bg-red-50 text-red-600`}>
                            Discard
                          </button>
                        </>
                      ) : (
                        <button disabled={working} onClick={() => start(p)} className={`${btn} border-slate-950 bg-slate-950 text-white`}>
                          {working ? "Opening…" : s.status === "DONE" ? "Scrutinise again" : "Start scrutiny"}
                        </button>
                      )}
                      {s.status === "DONE" && (
                        <button onClick={() => setOpen(open === p._id ? "" : p._id)} className={`${btn} border-slate-200 bg-white text-slate-700`}>
                          {open === p._id ? "Hide changes" : "Changes"}
                        </button>
                      )}
                    </div>
                  </div>
                  {open === p._id && s.status === "DONE" && (
                    <div className="mt-3">
                      {s.note && <p className="mb-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{s.note}</p>}
                      <ChangeList changes={s.changes} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal
        open={Boolean(finishing)}
        onClose={() => setFinishing(null)}
        title="Finish scrutiny?"
        subtitle={finishing ? `${finishing.subject?.code} · Set ${finishing.setNo}` : ""}
        busy={Boolean(busy)}
        footer={
          <>
            <button onClick={() => setFinishing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">
              Not yet
            </button>
            <button
              onClick={finish}
              disabled={Boolean(busy)}
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Saving…" : "Finish scrutiny"}
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          The Google Doc becomes the final paper and is then deleted. Close the Google Docs tab after pressing Finish.
        </p>
        <label className="mt-4 block text-sm font-medium text-slate-700">
          Note for the setter (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="e.g. Q3 marks corrected from 6 to 5 as per blueprint; Q7 reworded for clarity."
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </Modal>

      <Modal open={Boolean(scheme)} onClose={() => setScheme(null)} title="Scheme of valuation" subtitle={scheme ? `${scheme.paper.subject?.code} · Set ${scheme.paper.setNo}` : ""} wide>
        <div
          className="qp-preview max-h-[65vh] overflow-y-auto px-6 py-4 text-sm leading-relaxed text-slate-800 select-none"
          dangerouslySetInnerHTML={{ __html: scheme?.html || "" }}
        />
      </Modal>
    </div>
  );
}
