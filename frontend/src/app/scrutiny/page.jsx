"use client";

// QP scrutiniser: every submitted question paper.
//   Start  → the paper opens as a Google Doc that only this account can edit
//   Finish → the Doc becomes the final Word paper (encrypted), the setter is
//            shown the note and the changed lines, and the Doc is deleted
// The setter's name is never shown here.

import { Fragment, useCallback, useEffect, useState } from "react";

import Modal from "../components/ui/Modal";
import { useConfirm, useToast } from "../components/ui/Feedback";
import { errMsg, useApi } from "../components/exams/shared";
import { ChangeList } from "../components/exams/ChangeList";
import Icon from "../components/shell/Icon";

const defaultSession = () => {
  const d = new Date();
  return d.getMonth() >= 6 ? `NOV-${d.getFullYear()}` : `MAY-${d.getFullYear()}`;
};
const fmtShort = (d) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";
const pill = "inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition disabled:opacity-40";

const STATE = {
  PENDING: { label: "To scrutinise", chip: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  IN_PROGRESS: { label: "In progress", chip: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  DONE: { label: "Scrutinised", chip: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
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
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

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

  const deptOf = (p) => String(p.subject?.department || "").toUpperCase();
  const all = papers || [];
  const departments = [...new Set(all.map(deptOf).filter(Boolean))].sort();
  const semesters = [...new Set(all.map((p) => p.subject?.semester).filter(Boolean))].sort((a, b) => a - b);
  const q = search.trim().toLowerCase();
  // Department, semester and search narrow the list; the tiles count within that
  const scoped = all.filter(
    (p) =>
      (!department || deptOf(p) === department) &&
      (!semester || String(p.subject?.semester) === semester) &&
      (!q || `${p.subject?.code} ${p.subject?.name}`.toLowerCase().includes(q))
  );
  const count = (st) => scoped.filter((p) => p.scrutiny.status === st).length;
  const shown = status ? scoped.filter((p) => p.scrutiny.status === status) : scoped;
  const doneCount = count("DONE");
  const pct = scoped.length ? Math.round((doneCount / scoped.length) * 100) : 0;
  const field = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400";

  const TILES = [
    ["", "All papers", scoped.length, "text-slate-900"],
    ["PENDING", "To scrutinise", count("PENDING"), "text-amber-700"],
    ["IN_PROGRESS", "In progress", count("IN_PROGRESS"), "text-blue-700"],
    ["DONE", "Scrutinised", doneCount, "text-emerald-700"],
  ];

  const actions = (p, s, working) => (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {p.hasScheme && (
        <button onClick={() => showScheme(p)} className={`${pill} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}>
          Scheme
        </button>
      )}
      {s.status === "IN_PROGRESS" ? (
        <>
          <a href={s.editUrl} target="_blank" rel="noreferrer" className={`${pill} border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100`}>
            Open doc
          </a>
          <button disabled={working} onClick={() => setFinishing(p)} className={`${pill} border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700`}>
            Finish
          </button>
          <button
            disabled={working}
            onClick={() => cancel(p)}
            title="Discard the Google Doc"
            className={`${pill} border-transparent text-red-600 hover:bg-red-50`}
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <button disabled={working} onClick={() => start(p)} className={`${pill} border-slate-900 bg-slate-900 text-white hover:bg-slate-700`}>
          {working ? "Opening…" : s.status === "DONE" ? "Re-open" : "Scrutinise"}
        </button>
      )}
      {s.status === "DONE" && (
        <button
          onClick={() => setOpen(open === p._id ? "" : p._id)}
          title="Changes made"
          className={`${pill} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <Icon name="chevronRight" className={`h-3.5 w-3.5 transition ${open === p._id ? "rotate-90" : ""}`} />
          Changes
        </button>
      )}
    </div>
  );

  const changesPanel = (s) => (
    <div className="space-y-2">
      {s.note && (
        <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
          <span className="font-semibold">Note to setter: </span>
          {s.note}
        </p>
      )}
      <ChangeList changes={s.changes} />
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      {/* header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-950">Question paper scrutiny</h2>
          <p className="mt-1 text-sm text-slate-500">Edit in Google Docs, then press Finish. The setter sees only your note and the changed lines.</p>
        </div>
        <input
          value={session}
          onChange={(e) => setSession(e.target.value.toUpperCase())}
          placeholder="Session e.g. NOV-2026"
          className={`${field} w-40 font-semibold tracking-wide`}
          aria-label="Exam session"
        />
      </div>

      {/* tiles: click to filter by status */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TILES.map(([key, label, n, tone]) => (
          <button
            key={label}
            onClick={() => setStatus(key)}
            className={`rounded-2xl border bg-white px-4 py-3 text-left transition ${
              status === key ? "border-slate-900 shadow-sm ring-1 ring-slate-900" : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{papers ? n : "–"}</p>
          </button>
        ))}
      </div>

      {/* progress */}
      {papers && scoped.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold tabular-nums text-slate-600">{pct}% done</span>
        </div>
      )}

      {/* filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Subject code or name" className={`${field} w-52 pl-8`} />
        </div>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={field}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={semester} onChange={(e) => setSemester(e.target.value)} className={field}>
          <option value="">All semesters</option>
          {semesters.map((n) => (
            <option key={n} value={String(n)}>
              Sem {n}
            </option>
          ))}
        </select>
        {(search || department || semester || status) && (
          <button
            onClick={() => {
              setSearch("");
              setDepartment("");
              setSemester("");
              setStatus("");
            }}
            className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-slate-500">
          {shown.length} of {all.length}
        </span>
      </div>

      {!papers && <div className="mt-4 h-72 animate-pulse rounded-2xl bg-white" />}

      {papers && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {shown.length === 0 && (
            <div className="px-6 py-14 text-center">
              <Icon name="paper" className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No paper here</p>
              <p className="text-xs text-slate-400">Try another session or clear the filters.</p>
            </div>
          )}

          {/* desktop table */}
          {shown.length > 0 && (
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-12 px-4 py-3 text-right">Sl.</th>
                  <th className="px-3 py-3">Subject</th>
                  <th className="px-3 py-3">Dept · Sem</th>
                  <th className="px-3 py-3">Set</th>
                  <th className="px-3 py-3">Submitted</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((p, i) => {
                  const s = p.scrutiny;
                  const st = STATE[s.status] || STATE.PENDING;
                  return (
                    <Fragment key={p._id}>
                      <tr className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-3 text-right text-xs tabular-nums text-slate-400">{i + 1}</td>
                        <td className="max-w-[22rem] px-3 py-3">
                          <p className="font-semibold text-slate-950">{p.subject?.code}</p>
                          <p className="truncate text-xs text-slate-500">
                            {p.subject?.name}
                            {p.paperType === "PRACTICAL" && " · Practical"}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700">{deptOf(p)}</span>
                          <span className="ml-1.5">Sem {p.subject?.semester}</span>
                        </td>
                        <td className="px-3 py-3 text-xs font-semibold text-slate-700">{p.setNo}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{fmtShort(p.submittedAt)}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.chip}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                          {s.status === "DONE" && (
                            <p className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-slate-400">
                              <span className="text-red-500">-{s.removed}</span> <span className="text-emerald-600">+{s.added}</span> · {fmtShort(s.doneAt)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">{actions(p, s, busy === p._id)}</td>
                      </tr>
                      {open === p._id && s.status === "DONE" && (
                        <tr className="bg-slate-50/70">
                          <td />
                          <td colSpan={6} className="px-3 pb-4 pt-1">
                            {changesPanel(s)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* phone cards */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {shown.map((p, i) => {
              const s = p.scrutiny;
              const st = STATE[s.status] || STATE.PENDING;
              return (
                <li key={p._id} className="space-y-2 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">
                        <span className="mr-1 text-xs font-normal tabular-nums text-slate-400">{i + 1}.</span>
                        {p.subject?.code} <span className="text-xs font-normal text-slate-500">Set {p.setNo}</span>
                      </p>
                      <p className="truncate text-xs text-slate-500">{p.subject?.name}</p>
                      <p className="text-[11px] text-slate-400">
                        {deptOf(p)} · Sem {p.subject?.semester} · {fmtShort(p.submittedAt)}
                      </p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.chip}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>
                  {actions(p, s, busy === p._id)}
                  {open === p._id && s.status === "DONE" && changesPanel(s)}
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
