"use client";

// Exam Officer: review the HOD's Final IA / Final attendance sheets.
// Every sheet is listed – no need to choose year, department, semester or
// batch. Open one, look at the highlighted problems, then Freeze it or send
// it back to the HOD with a note.

import { useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";

const TITLE = { ia: "Final IA", attendance: "Final attendance" };
const TABS = [
  ["submitted", "Waiting for you"],
  ["confirmed", "Frozen"],
  ["draft", "With HOD"],
];
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function SheetReview({ type }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState("submitted");
  const [list, setList] = useState(null);
  const [counts, setCounts] = useState({});
  const [open, setOpen] = useState(null); // sheet id

  const load = useCallback(async () => {
    try {
      const [cur, all] = await Promise.all([
        api("get", "/sheet-review", undefined, { params: { type, status: tab } }),
        api("get", "/sheet-review", undefined, { params: { type } }),
      ]);
      setList(cur.data.data);
      const c = { draft: 0, submitted: 0, confirmed: 0 };
      for (const s of all.data.data) c[s.status]++;
      setCounts(c);
    } catch (e) {
      setList([]);
      toast.error(errMsg(e, "Could not load sheets."));
    }
  }, [api, type, tab, toast]);

  useEffect(() => {
    setList(null);
    load();
  }, [load]);

  const freeze = async (s) => {
    const ok = await confirm({
      title: `Freeze ${TITLE[type]}?`,
      message: `${s.department.toUpperCase()} · Semester ${s.semester} · Batch ${s.batch} (${s.academicYear}).\n\nThe HOD can no longer edit it, and it will be used for exam eligibility.${
        s.empty ? `\n\nNote: ${s.empty} entries are still empty.` : ""
      }`,
      confirmText: "Freeze",
    });
    if (!ok) return false;
    try {
      const r = await api("post", `/sheet-review/${type}/${s._id}/freeze`);
      toast.success(r.data.message);
      load();
      return true;
    } catch (e) {
      toast.error(errMsg(e, "Could not freeze."));
      return false;
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">{TITLE[type]}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
        Sheets submitted by HODs appear here by themselves. Open one, check it, then freeze it or send it back.
      </p>

      <div className="no-scrollbar mt-5 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold ${
              tab === k ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                k === "submitted" && counts.submitted ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {counts[k] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {list === null && [0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
        {list?.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
            {tab === "submitted" ? "Nothing waiting. New sheets show up here when HODs submit them." : "No sheets here."}
          </p>
        )}
        {list?.map((s) => (
          <div key={s._id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-950">
                {s.department.toUpperCase()} · Semester {s.semester}
                <span className="ml-2 text-sm font-normal text-slate-500">{deptLabel(s.department)}</span>
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                Batch {s.batch} · {s.academicYear} · {s.students} students · {s.subjects} subjects
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {s.status === "submitted" && `Submitted ${fmt(s.submittedAt)}`}
                {s.status === "confirmed" && `Frozen ${fmt(s.confirmedAt)}`}
                {s.status === "draft" && (s.returnedReason ? `Sent back: ${s.returnedReason}` : "HOD is still entering")}
                {s.empty > 0 && <span className="ml-2 font-semibold text-orange-700">{s.empty} empty entries</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpen(s._id)} className={btn.secondary}>
                Review
              </button>
              {s.status === "submitted" && (
                <button onClick={() => freeze(s)} className={btn.primary}>
                  <Icon name="lock" className="h-4 w-4" />
                  Freeze
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <ReviewModal
          type={type}
          id={open}
          onClose={() => setOpen(null)}
          onFreeze={async (s) => (await freeze(s)) && setOpen(null)}
          onChanged={() => {
            setOpen(null);
            load();
          }}
        />
      )}
    </div>
  );
}

const CELL = {
  low: "bg-red-50 text-red-700 font-semibold",
  empty: "bg-orange-50 text-orange-700",
  over: "bg-purple-50 text-purple-700 font-semibold",
  "": "",
};

function ReviewModal({ type, id, onClose, onFreeze, onChanged }) {
  const api = useApi();
  const toast = useToast();
  const [sheet, setSheet] = useState(null);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyProblems, setOnlyProblems] = useState(false);

  useEffect(() => {
    api("get", `/sheet-review/${type}/${id}`)
      .then((r) => setSheet(r.data.data))
      .catch((e) => {
        toast.error(errMsg(e, "Could not open the sheet."));
        onClose();
      });
  }, [api, type, id, toast, onClose]);

  const sendBack = async () => {
    setBusy(true);
    try {
      const r = await api("post", `/sheet-review/${type}/${id}/return`, { reason });
      toast.success(r.data.message);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, "Could not send back."));
      setBusy(false);
    }
  };

  const rows = sheet ? (onlyProblems ? sheet.students.filter((st) => st.cells.some((c) => c.flag)) : sheet.students) : [];

  return (
    <Modal
      open
      wide
      onClose={onClose}
      busy={busy}
      title={sheet ? `${sheet.department.toUpperCase()} · Semester ${sheet.semester} · ${TITLE[type]}` : "Loading…"}
      subtitle={sheet ? `Batch ${sheet.batch} · ${sheet.academicYear} · ${sheet.students.length} students` : ""}
      footer={
        sheet &&
        (returning ? (
          <>
            <button onClick={() => setReturning(false)} disabled={busy} className={btn.secondary}>
              Back
            </button>
            <button
              onClick={sendBack}
              disabled={busy || reason.trim().length < 3}
              className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-40"
            >
              Send back to HOD
            </button>
          </>
        ) : (
          <>
            {sheet.status !== "draft" && (
              <button onClick={() => setReturning(true)} className={`${btn.secondary} sm:mr-auto`}>
                Send back to HOD
              </button>
            )}
            <button onClick={onClose} className={btn.secondary}>
              Close
            </button>
            {sheet.status === "submitted" && (
              <button onClick={() => onFreeze(sheet)} className={btn.primary}>
                <Icon name="lock" className="h-4 w-4" />
                Freeze
              </button>
            )}
          </>
        ))
      }
    >
      {!sheet && <div className="h-64 animate-pulse rounded-xl bg-slate-50" />}

      {sheet && returning && (
        <label className="block">
          <span className="text-sm font-semibold text-slate-800">What should the HOD correct?</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. 25CS31T0 total classes look wrong; 3 students have no IA marks"
            className={`${field} mt-1.5 h-auto py-2.5`}
          />
          <span className="mt-1 block text-xs text-slate-500">The HOD sees this note on the sheet and can submit again.</span>
        </label>
      )}

      {sheet && !returning && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-lg bg-red-50 px-2 py-1 text-red-700">
              {sheet.lowCount} {type === "ia" ? "below IA minimum" : `below ${sheet.minAttendance}%`}
            </span>
            <span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-700">{sheet.empty} empty</span>
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-slate-600">
              <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="accent-blue-600" />
              Only students with a problem
            </label>
          </div>

          <div className="mt-3 max-h-[55vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-600">Student</th>
                  {sheet.subjects.map((s) => (
                    <th key={s.subjectId} className="px-3 py-2 text-center font-semibold text-slate-600" title={s.name}>
                      {s.code}
                      <span className="block font-normal text-slate-400">
                        {type === "ia" ? `of ${s.max ?? "?"}${s.iaMin ? ` · min ${s.iaMin}` : ""}` : `of ${s.max ?? "?"} classes`}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((st) => (
                  <tr key={st.studentId}>
                    <td className="sticky left-0 bg-white px-3 py-1.5">
                      <span className="block font-semibold tabular-nums text-slate-900">{st.registerNumber}</span>
                      <span className="block max-w-[11rem] truncate text-xs text-slate-500">{st.name}</span>
                    </td>
                    {st.cells.map((c, i) => (
                      <td key={i} className={`px-3 py-1.5 text-center tabular-nums ${CELL[c.flag]}`}>
                        {c.value ?? "—"}
                        {type === "attendance" && c.pct !== null && <span className="block text-[11px] font-normal opacity-80">{c.pct}%</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={sheet.subjects.length + 1} className="px-3 py-8 text-center text-slate-500">
                      No problems found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Red = {type === "ia" ? "below the subject’s IA minimum" : `below ${sheet.minAttendance}% (ANS)`} · Orange = empty · Purple = more than the maximum
          </p>
        </>
      )}
    </Modal>
  );
}
