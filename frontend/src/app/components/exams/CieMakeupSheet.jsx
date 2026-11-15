"use client";

// CIE make-up (KPT 5.5) – one simple sheet, no rounds, no registration.
// HOD (Evening Principal: evening students of the branch chosen): his
// students whose latest result in a course is NE. Type the make-up CIE of
// those who wrote it; leave blank who did not. At or above the minimum, the
// course is an eligible back paper in the next exam with the new CIE (fee and
// hall ticket as usual). COE / office: every department, to check or correct.

import { useCallback, useEffect, useMemo, useState } from "react";

import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { useRole } from "../useRole";
import { EveningTag, matchesCollege } from "../ui/CollegeFilter";
import { BranchShiftFields, useEveningBranch, useEveningMode } from "../evening/EveningSheetFilters";
import { DEPARTMENTS, errMsg, useApi } from "./shared";

export default function CieMakeupSheet() {
  const api = useApi();
  const toast = useToast();
  const role = useRole();
  const evening = useEveningMode();
  const [eveningBranch, chooseEveningBranch] = useEveningBranch();
  const allDepartments = !evening && role !== "hod";
  const [rows, setRows] = useState(null);
  const [department, setDepartment] = useState("");
  const [semester, setSemester] = useState("");
  const [shift, setShift] = useState("");
  const [q, setQ] = useState("");
  const [show, setShow] = useState(""); // "" all | "TODO" not entered | "DONE" made up

  const load = useCallback(async () => {
    setRows(null);
    try {
      const r = await api("get", "/cie-makeup/sheet", undefined, {
        params: { ...(allDepartments && department ? { department } : {}) },
        ...(evening ? { headers: { "X-Department": eveningBranch } } : {}),
      });
      setRows(r.data.data);
    } catch (e) {
      setRows([]);
      toast.error(errMsg(e, "Could not load the make-up sheet."));
    }
  }, [api, allDepartments, department, evening, eveningBranch, toast]);
  useEffect(() => {
    load();
  }, [load]);

  const semesters = useMemo(() => [...new Set((rows || []).map((r) => r.subjectSemester).filter(Boolean))].sort((a, b) => a - b), [rows]);
  const shown = useMemo(
    () =>
      (rows || []).filter(
        (r) =>
          (!semester || String(r.subjectSemester) === semester) &&
          (!evening || !shift || matchesCollege(shift, r.registerNumber)) &&
          (!show || (show === "DONE" ? r.passed : r.marks === null)) &&
          (!q.trim() || `${r.registerNumber} ${r.name} ${r.code} ${r.subjectName}`.toLowerCase().includes(q.trim().toLowerCase()))
      ),
    [rows, semester, evening, shift, show, q]
  );
  const counts = useMemo(() => {
    const c = { total: rows?.length || 0, entered: 0, made: 0 };
    for (const r of rows || []) {
      if (r.marks !== null) c.entered++;
      if (r.passed) c.made++;
    }
    return c;
  }, [rows]);
  const replace = (x) => setRows((list) => list.map((r) => (String(r.student) === String(x.student) && String(r.subject) === String(x.subject) ? x : r)));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">CIE make-up</h2>
      <p className="mt-1 text-sm text-slate-500">
        Students whose result in a course is NE (CIE below the minimum). Type the make-up CIE of those who wrote it; leave blank who did not (KPT 5.5).
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {evening && (
          <BranchShiftFields
            branch={eveningBranch}
            onBranch={(d) => chooseEveningBranch(d)}
            shift={shift}
            onShift={setShift}
          />
        )}
        {allDepartments && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All departments</option>
              {DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Course semester</label>
          <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">All semesters</option>
            {semesters.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Show</label>
          <select value={show} onChange={(e) => setShow(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">All</option>
            <option value="TODO">Not entered yet</option>
            <option value="DONE">Made up</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Search</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no., name or course" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      {!rows && <div className="mt-4 h-48 animate-pulse rounded-2xl bg-white" />}
      {rows && (
        <>
          <p className="mt-4 text-sm text-slate-600">
            {counts.total} NE course{counts.total === 1 ? "" : "s"} · {counts.entered} entered · <b className="text-emerald-700">{counts.made} made up</b>
          </p>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            {shown.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">{rows.length ? "No one for this selection." : "No student with NE – nothing to make up."}</p>
            ) : (
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-left text-xs font-semibold text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="w-10 px-3 py-2.5 text-right">Sl.</th>
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Course</th>
                    <th className="px-3 py-2.5 text-right">CIE before</th>
                    <th className="px-3 py-2.5 text-right">Needs</th>
                    <th className="px-3 py-2.5">Make-up CIE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.map((r, i) => (
                    <Row key={`${r.student}|${r.subject}`} n={i + 1} r={r} onSaved={replace} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-slate-500">
            At or above the minimum: the course is an eligible back paper in the next exam with this CIE – fee and hall ticket as usual. Blank or below: stays NE. Not for
            seminar, project, internship or practical courses (KPT 5.5.2).
          </p>
        </>
      )}
    </div>
  );
}

function Row({ n, r, onSaved }) {
  const api = useApi();
  const toast = useToast();
  const [marks, setMarks] = useState(r.marks ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = String(marks) !== String(r.marks ?? "");

  const save = async () => {
    setBusy(true);
    try {
      const x = await api("post", "/cie-makeup/sheet", { student: r.student, subject: r.subject, marks });
      if (x.data.data.passed) toast.success(x.data.message, 7000);
      else toast.info(x.data.message, 7000);
      onSaved({ ...r, ...x.data.data });
    } catch (e) {
      toast.error(errMsg(e, "Could not save."));
    }
    setBusy(false);
  };

  return (
    <tr className="align-middle">
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-400">{n}</td>
      <td className="px-3 py-2.5">
        <b className="tabular-nums">{r.registerNumber}</b>
        <EveningTag registerNumber={r.registerNumber} />
        <span className="block text-xs text-slate-500">{r.name}</span>
      </td>
      <td className="px-3 py-2.5">
        <b>{r.code}</b>
        <span className="block text-xs text-slate-500">
          {r.subjectName} · Sem {r.subjectSemester}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
        {r.originalCie ?? "—"}/{r.cieMax}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.cieMin}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max={r.cieMax}
            step="0.5"
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && dirty && save()}
            placeholder="blank"
            className="h-9 w-20 rounded-lg border border-slate-200 px-2 text-sm tabular-nums"
          />
          <span className="text-xs text-slate-500">/ {r.cieMax}</span>
          {dirty ? (
            <button onClick={save} disabled={busy} className={btn.small}>
              {busy ? "…" : "Save"}
            </button>
          ) : r.marks !== null ? (
            <span className={`text-xs font-semibold ${r.passed ? "text-emerald-700" : "text-red-700"}`}>{r.passed ? "Made up – eligible" : "Below minimum – NE"}</span>
          ) : (
            <span className="text-xs text-slate-400">not written</span>
          )}
        </div>
      </td>
    </tr>
  );
}
