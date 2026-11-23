"use client";

// Exam Officer: review the HOD's Final IA / Final attendance sheets.
// Every sheet is listed – no need to choose year, department, semester or
// batch. Open one, look at the highlighted problems, then Freeze it or send
// it back to the HOD with a note.

import { Fragment, useCallback, useEffect, useState } from "react";

import Icon from "../shell/Icon";
import Modal, { btn, field } from "../ui/Modal";
import { useConfirm, useToast } from "../ui/Feedback";
import { deptLabel, errMsg, useApi } from "./shared";
import { T } from "../ui/table";
import { openSignatureSheet } from "../HodSheetPanel";
import { useAcademicYear } from "../academicYear";
import { deptTint, tintRow } from "../ui/deptTint";
import { takenColumns } from "../bridge";

const TITLE = { ia: "Final IA", attendance: "Final attendance" };
const TABS = [
  ["submitted", "Waiting for you"],
  ["confirmed", "Frozen"],
  ["draft", "With HOD"],
];
const fmt = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

// admin: the Admin's view – he may delete a sheet of the running year
// (even a frozen one) so that the HOD enters it again
export default function SheetReview({ type, admin = false }) {
  const api = useApi();
  const toast = useToast();
  const confirm = useConfirm();
  const year = useAcademicYear();

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
  // the day college first, the evening college separately at the end;
  // inside each: department by department, semester by semester
  const shown = (list || [])
    .filter((x) => (!dept || x.department === dept) && (!sem || String(x.semester) === sem))
    .sort((a, b) => (a.shift === "EVENING") - (b.shift === "EVENING") || a.department.localeCompare(b.department) || a.semester - b.semester);
  const dayCount = shown.filter((x) => x.shift !== "EVENING").length;

  return (
    <div className="mx-auto max-w-6xl px-3 py-3 sm:px-4">
      <h2 className="text-lg font-bold tracking-tight text-slate-950">{TITLE[type]}</h2>
      {admin && (
        <p className="mt-2 max-w-3xl rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm leading-6 text-red-900">
          Admin: you can <b>delete</b> a sheet of the running year ({year}), even a frozen one – the HOD then enters it again from the start. For a small correction use
          “Send back to HOD” instead: it keeps the marks.
        </p>
      )}

      <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto border-b border-slate-200">
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
      <div className="mt-2 flex flex-wrap items-center gap-2">
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

      <div className={`mt-2 ${T.wrap}`}>
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
                <th className={`${T.th} text-right`}>Courses</th>
                <th className={T.th}>Status</th>
                <th className={`${T.th} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody className={T.body}>
              {shown.map((s, i) => (
                <Fragment key={s._id}>
                {s.shift === "EVENING" && i === dayCount && (
                  <tr className="bg-indigo-100">
                    <td colSpan={9} className="px-3 py-1 text-xs font-bold text-indigo-900">
                      Evening college
                    </td>
                  </tr>
                )}
                <tr className={`${T.row} ${tintRow(s.department, i)}`}>
                  <td className={T.tdNum}>{s.shift === "EVENING" ? i - dayCount + 1 : i + 1}</td>
                  <td className={T.td}>
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${deptTint(s.department).chip}`}>{s.department.toUpperCase()}</span>
                    <span className="ml-2 text-xs text-slate-600">{deptLabel(s.department)}</span>
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
                        {s.verified ? `Verified · final · ${fmt(s.verifiedAt)}` : `Frozen · ${fmt(s.confirmedAt)}`}
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
                </Fragment>
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
          canDelete={admin}
          year={year}
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
  na: "bg-slate-100 text-slate-400", // bridge course the student does not take
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
    verification: sheet.verification,
    // bridge course: from its category when the sheet has it (else the print decides)
    subjects: sheet.subjects.map((s) => ({ subjectId: String(s.subjectId), code: s.code, name: s.name, iaMin: s.iaMin, iaMax: s.max ?? s.iaMax, bridge: s.subjectCategory ? String(s.subjectCategory).toUpperCase() === "BRIDGE" : undefined })),
    students: sheet.students.map((st) => ({
      registerNumber: st.registerNumber,
      studentName: st.name,
      values: Object.fromEntries(sheet.subjects.map((s, i) => [String(s.subjectId), st.cells[i]?.flag === "na" ? "NA" : ia ? st.cells[i]?.value ?? "" : st.cells[i]?.pct ?? ""])),
    })),
  });
}

// 79.60000000000001 -> 79.6 (shown only; the saved value is not changed)
const tidy = (v) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 100) / 100 : v);

function ReviewModal({ type, id, onClose, onFreeze, onChanged, canDelete = false, year = "" }) {
  const api = useApi();
  const toast = useToast();
  const [deleting, setDeleting] = useState(false);
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

  // Admin: delete the whole sheet (running year only; the server checks again)
  const remove = async () => {
    setBusy(true);
    try {
      const r = await api("delete", `/sheet-review/${type}/${id}`, { reason });
      toast.success(r.data.message, 8000);
      onChanged();
    } catch (e) {
      toast.error(errMsg(e, "Could not delete the sheet."));
      setBusy(false);
    }
  };

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

  const columns = sheet ? takenColumns(sheet) : [];
  const rows = sheet ? (onlyProblems ? sheet.students.filter((st) => st.cells.some((c) => c.flag && c.flag !== "na")) : sheet.students) : [];

  return (
    <Modal
      open
      full
      onClose={onClose}
      busy={busy}
      title={sheet ? `${sheet.department.toUpperCase()}${sheet.shift === "EVENING" ? " (Evening)" : ""} · Semester ${sheet.semester} · ${TITLE[type]}` : "Loading…"}
      subtitle={sheet ? `Batch ${sheet.batch} · ${sheet.academicYear} · ${sheet.students.length} students` : ""}
      footer={
        sheet &&
        (deleting ? (
          <>
            <button onClick={() => setDeleting(false)} disabled={busy} className={btn.secondary}>
              Back
            </button>
            <button
              onClick={remove}
              disabled={busy || reason.trim().length < 5}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40"
            >
              Delete sheet
            </button>
          </>
        ) : returning ? (
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
            {sheet.status !== "draft" && !sheet.verified && !sheet.corrections && (
              <button onClick={() => setReturning(true)} className={`${btn.secondary} ${canDelete ? "" : "sm:mr-auto"}`}>
                Send back to HOD
              </button>
            )}
            {canDelete && sheet.academicYear === year && !sheet.verified && !sheet.corrections && (
              <button onClick={() => setDeleting(true)} className={`${btn.secondary} !text-red-700 sm:mr-auto`}>
                <Icon name="trash" className="h-4 w-4" />
                Delete sheet
              </button>
            )}
            {sheet.status !== "draft" && (
              <button onClick={() => printCopy(type, sheet, "verification")} className={btn.secondary} title="For the verifier to mark on – signed by the Class In-charge, HOD and Principal / Dean">
                <Icon name="download" className="h-4 w-4" />
                Before verification copy
              </button>
            )}
            {sheet.verified && (
              <button onClick={() => printCopy(type, sheet, "after")} className={btn.secondary} title="The final sheet – signed by the Verifier, HOD and Principal / Dean">
                <Icon name="download" className="h-4 w-4" />
                After verification copy
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

      {sheet && deleting && (
        <label className="block">
          <span className="text-sm font-semibold text-red-800">
            Delete this {TITLE[type]} sheet ({sheet.status === "confirmed" ? "frozen" : sheet.status === "submitted" ? "submitted" : "with the HOD"})?
          </span>
          <span className="mt-1 block text-sm text-slate-600">
            The HOD must enter the sheet again and submit it. The deleted sheet goes to the Recycle bin, where the Admin can restore it within 30 days. Write the reason:
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. Wrong batch entered – HOD will enter again"
            className={`${field} mt-1.5 h-auto py-2.5`}
          />
        </label>
      )}

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

      {sheet && !returning && !deleting && (
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

          <div className="mt-3 max-h-[68vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 z-30 bg-slate-100 text-xs">
                <tr>
                  <th className="sticky left-0 z-20 w-12 min-w-12 bg-slate-100 px-2 py-2 text-right font-semibold text-slate-600">Sl.</th>
                  <th className="sticky left-12 z-20 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-600">Student</th>
                  {columns.map((x) => sheet.subjects[x]).map((s) => (
                    <th key={s.subjectId} className="px-3 py-2 text-center font-semibold text-slate-600" title={s.name}>
                      {s.code}
                      <span className="block font-normal text-slate-400">
                        {type === "ia" ? `of ${s.max ?? "?"}${s.iaMin ? ` · min ${s.iaMin}` : ""}` : "%"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((st, n) => (
                  <tr key={st.studentId} className={n % 2 ? "bg-slate-50" : "bg-white"}>
                    <td className={`sticky left-0 z-10 w-12 min-w-12 px-2 py-1 text-right text-xs font-semibold tabular-nums text-slate-500 ${n % 2 ? "bg-slate-50" : "bg-white"}`}>{sheet.students.indexOf(st) + 1}</td>
                    <td className={`sticky left-12 z-10 px-3 py-1 ${n % 2 ? "bg-slate-50" : "bg-white"}`}>
                      <span className="block font-semibold tabular-nums text-slate-900">{st.registerNumber}</span>
                      <span className="block max-w-[11rem] truncate text-xs text-slate-500">{st.name}</span>
                    </td>
                    {columns.map((x) => {
                      const c = st.cells[x];
                      return (
                        <td key={x} className={`px-3 py-1 text-center font-medium tabular-nums ${CELL[c.flag]}`}>
                          {c.flag === "na" ? "NA" : type === "attendance" ? (c.pct === null || c.pct === undefined ? "—" : Number(c.pct).toFixed(2)) : c.value === null || c.value === undefined ? "—" : tidy(c.value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-slate-500">
                      No problems found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Red = {type === "ia" ? "below the course’s IA minimum" : `below ${sheet.minAttendance}% (ANS)`} · Orange = empty · Purple = more than the maximum
          </p>
        </>
      )}
    </Modal>
  );
}
