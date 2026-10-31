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
import { T } from "../ui/table";
import { openSignatureSheet } from "../HodSheetPanel";

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
  const [dept, setDept] = useState("");
  const [sem, setSem] = useState("");

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

  const departments = [...new Set((list || []).map((x) => x.department))].sort();
  const semesters = [...new Set((list || []).map((x) => x.semester))].sort((a, b) => a - b);
  const shown = (list || []).filter((x) => (!dept || x.department === dept) && (!sem || String(x.semester) === sem));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
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

      {/* filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select value={dept} onChange={(e) => setDept(e.target.value)} className={T.field}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d.toUpperCase()} – {deptLabel(d)}
            </option>
          ))}
        </select>
        <select value={sem} onChange={(e) => setSem(e.target.value)} className={T.field}>
          <option value="">All semesters</option>
          {semesters.map((n) => (
            <option key={n} value={String(n)}>
              Sem {n}
            </option>
          ))}
        </select>
        {(dept || sem) && (
          <button
            onClick={() => {
              setDept("");
              setSem("");
            }}
            className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            Clear
          </button>
        )}
        {list && (
          <span className="ml-auto text-xs text-slate-500">
            {shown.length} sheet{shown.length === 1 ? "" : "s"} · {shown.reduce((a, x) => a + (x.students || 0), 0)} students
          </span>
        )}
      </div>

      <div className={`mt-3 ${T.wrap}`}>
        {list === null && <div className="h-40 animate-pulse" />}
        {list && shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-500">
            {tab === "submitted" && !dept && !sem ? "Nothing waiting. New sheets show up here when HODs submit them." : "No sheets here."}
          </p>
        )}
        {shown.length > 0 && (
          <table className={T.table}>
            <thead>
              <tr className={T.headRow}>
                <th className={T.thNum}>Sl.</th>
                <th className={T.th}>Department</th>
                <th className={T.th}>Sem</th>
                <th className={T.th}>Batch</th>
                <th className={T.th}>Year</th>
                <th className={`${T.th} text-right`}>Students</th>
                <th className={`${T.th} text-right`}>Subjects</th>
                <th className={T.th}>Status</th>
                <th className={`${T.th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {shown.map((s, i) => (
                <tr key={s._id} className={T.row}>
                  <td className={T.tdNum}>{i + 1}</td>
                  <td className={T.td}>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">{s.department.toUpperCase()}</span>
                    <span className="ml-2 text-xs text-slate-500">{deptLabel(s.department)}</span>
                  </td>
                  <td className={`${T.td} text-xs font-semibold text-slate-700`}>{s.semester}</td>
                  <td className={`${T.td} text-xs text-slate-600`}>{s.batch}</td>
                  <td className={`${T.td} text-xs text-slate-600`}>{s.academicYear}</td>
                  <td className={`${T.td} text-right text-xs tabular-nums text-slate-700`}>{s.students}</td>
                  <td className={`${T.td} text-right text-xs tabular-nums text-slate-700`}>{s.subjects}</td>
                  <td className={T.td}>
                    {s.status === "submitted" && (
                      <span className={`${T.pill} bg-blue-50 text-blue-700`}>
                        <span className={`${T.dot} bg-blue-500`} />
                        Waiting · {fmt(s.submittedAt)}
                      </span>
                    )}
                    {s.status === "confirmed" && (
                      <span className={`${T.pill} bg-emerald-50 text-emerald-700`}>
                        <span className={`${T.dot} bg-emerald-500`} />
                        Frozen · {fmt(s.confirmedAt)}
                      </span>
                    )}
                    {s.status === "draft" && (
                      <span className={`${T.pill} bg-slate-100 text-slate-600`} title={s.returnedReason || ""}>
                        <span className={`${T.dot} bg-slate-400`} />
                        {s.returnedReason ? "Sent back" : "HOD entering"}
                      </span>
                    )}
                    {s.empty > 0 && <p className="mt-1 text-[11px] font-semibold text-orange-700">{s.empty} empty entries</p>}
                  </td>
                  <td className={`${T.td} text-right`}>
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => setOpen(s._id)} className={btn.small}>
                        Review
                      </button>
                      {s.status === "submitted" && (
                        <button onClick={() => freeze(s)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40">
                          <Icon name="lock" className="h-3.5 w-3.5" />
                          Freeze
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

// The same printed sheet as the HOD's (print/hod-sheet): attendance as %
function printCopy(type, sheet, copy) {
  const ia = type === "ia";
  openSignatureSheet({
    kind: ia ? "ia" : "attendance",
    copy,
    academicYear: sheet.academicYear,
    semester: sheet.semester,
    batch: sheet.batch,
    status: sheet.status,
    department: sheet.department,
    subjects: sheet.subjects.map((s) => ({ subjectId: String(s.subjectId), code: s.code, name: s.name, iaMin: s.iaMin, iaMax: s.max ?? s.iaMax })),
    students: sheet.students.map((st) => ({
      registerNumber: st.registerNumber,
      studentName: st.name,
      values: Object.fromEntries(sheet.subjects.map((s, i) => [String(s.subjectId), ia ? st.cells[i]?.value ?? "" : st.cells[i]?.pct ?? ""])),
    })),
  });
}

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
            {sheet.status !== "draft" && (
              <button onClick={() => printCopy(type, sheet, "verification")} className={btn.secondary} title="For the officer who visits to verify – with HOD, Academic Dean and Principal signatures">
                <Icon name="download" className="h-4 w-4" />
                Verification copy
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
                {rows.map((st, n) => (
                  <tr key={st.studentId}>
                    <td className="sticky left-0 bg-white px-3 py-1.5">
                      <span className="block font-semibold tabular-nums text-slate-900">
                        <span className="mr-1 font-normal tabular-nums text-slate-400">{n + 1}.</span>
                        {st.registerNumber}
                      </span>
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
