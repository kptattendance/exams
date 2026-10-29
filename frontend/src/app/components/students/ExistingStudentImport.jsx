"use client";

// Admin: import 2nd / 3rd-year students who already have register numbers –
// everything on one page:
//   choose the Excel → every row is checked (errors shown right here)
//   → Import → each student's login and record are created, photos copied,
//   progress shown row by row → download the result.
// The server keeps the register numbers from the Excel (nothing is generated).

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

import Icon from "../shell/Icon";
import { btn } from "../ui/Modal";
import { useToast } from "../ui/Feedback";
import { downloadBlob, errMsg, useApi } from "../exams/shared";

const COLUMNS = [
  ["Register Number", "103CS25001 – kept as it is", true],
  ["Roll Number", "", true],
  ["Student Name", "", true],
  ["Father Name", "", true],
  ["Mother Name", "", true],
  ["DOB", "dd-mm-yyyy", true],
  ["Gender", "male / female", true],
  ["Email", "used for the login – must be unique", true],
  ["Phone", "10 digits", true],
  ["Department", "at, ch, ce, cs, ec, ee, me, ps", true],
  ["Admission Year", "e.g. 2025", true],
  ["Batch", "e.g. 2025-2028", true],
  ["Batch Number", "1 or 2", true],
  ["Semester", "1 to 6 (e.g. 3)", true],
  ["Admission Type", "regular (empty = regular), lateral-iti, lateral-iti-cross, lateral-puc", false],
  ["Parent Phone", "", false],
  ["Caste", "", false],
  ["Category", "", false],
  ["Aadhaar Number", "12 digits", false],
  ["SATS Number", "", false],
  ["Status", "active / inactive", false],
  ["Photo", "Google Drive link (Anyone with the link)", false],
];

const ROW_STATE = {
  ERROR: { label: "Error", chip: "bg-red-100 text-red-800", row: "bg-red-50" },
  WARN: { label: "Ready (check)", chip: "bg-yellow-100 text-yellow-900", row: "bg-yellow-50/60" },
  READY: { label: "Ready", chip: "bg-emerald-100 text-emerald-800", row: "" },
  PENDING: { label: "Waiting", chip: "bg-slate-100 text-slate-600", row: "" },
  CREATED: { label: "Imported ✓", chip: "bg-emerald-100 text-emerald-800", row: "bg-emerald-50/50" },
  FAILED: { label: "Failed", chip: "bg-red-100 text-red-800", row: "bg-red-50" },
};

export default function ExistingStudentImport() {
  const api = useApi();
  const toast = useToast();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // server check of the file
  const [job, setJob] = useState(null); // the import, while / after it runs
  const [busy, setBusy] = useState(""); // "check" | "import" | "process"
  const [error, setError] = useState("");
  const [show, setShow] = useState("ALL");
  const [q, setQ] = useState("");

  const template = () => {
    const ws = XLSX.utils.aoa_to_sheet([COLUMNS.map(([c]) => c)]);
    ws["!cols"] = COLUMNS.map(([c]) => ({ wch: Math.max(14, c.length + 2) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "existing_students_template.xlsx");
  };

  const check = async (f) => {
    setFile(f);
    setPreview(null);
    setJob(null);
    setError("");
    setShow("ALL");
    if (!f) return;
    setBusy("check");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await api("post", "/student-import/existing/preview", fd);
      setPreview(r.data);
    } catch (e) {
      const cols = e?.response?.data?.missingColumns;
      setError(cols ? `These columns are missing in the Excel: ${cols.join(", ")}. Use the template.` : errMsg(e, "Could not read the Excel file."));
    }
    setBusy("");
  };

  // creates the students a few at a time until all are done
  const run = async (id) => {
    setBusy("process");
    for (let i = 0; i < 400; i++) {
      try {
        const r = await api("post", `/student-import/${id}/process`);
        setJob(r.data.data);
        if (r.data.done) break;
      } catch (e) {
        setError(errMsg(e, "Processing stopped. Click Continue to resume."));
        break;
      }
    }
    setBusy("");
  };

  const start = async () => {
    setBusy("import");
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await api("post", "/student-import/existing", fd);
      setJob(r.data.data);
      await run(r.data.data._id);
    } catch (e) {
      if (e?.response?.data?.preview) setPreview(e.response.data.preview);
      setError(errMsg(e, "Could not start the import."));
      setBusy("");
    }
  };

  const retry = async () => {
    try {
      const r = await api("post", `/student-import/${job._id}/retry`);
      setJob(r.data.data);
      await run(job._id);
    } catch (e) {
      setError(errMsg(e, "Could not retry."));
    }
  };

  // one list for the table: the import rows once it has started, else the check
  const rows = useMemo(() => {
    if (job) {
      const prob = new Map((preview?.rows || []).map((r) => [r.rowNumber, r.problems]));
      return job.rows.map((r) => ({
        rowNumber: r.rowNumber,
        registerNumber: r.registerNumber,
        rollNumber: r.rollNumber,
        name: r.name,
        department: r.department,
        semester: "",
        state: r.state === "CREATED" ? "CREATED" : r.state === "FAILED" ? "FAILED" : "PENDING",
        messages: [r.error, r.photoState === "FAILED" ? `Photo: ${r.photoError}` : "", r.photoState === "DONE" ? "Photo copied" : ""].filter(Boolean),
        warnings: (prob.get(r.rowNumber) || []).filter((p) => p.level === "warning").map((p) => p.message),
      }));
    }
    return (preview?.rows || []).map((r) => {
      const errs = r.problems.filter((p) => p.level === "error");
      const warns = r.problems.filter((p) => p.level === "warning");
      return {
        rowNumber: r.rowNumber,
        registerNumber: r.registerNumber,
        rollNumber: r.rollNumber,
        name: r.name,
        department: r.department,
        semester: r.semester,
        state: errs.length ? "ERROR" : warns.length ? "WARN" : "READY",
        messages: errs.map((p) => p.message),
        warnings: warns.map((p) => p.message),
      };
    });
  }, [preview, job]);

  const count = (s) => rows.filter((r) => r.state === s).length;
  const shown = rows.filter(
    (r) =>
      (show === "ALL" || r.state === show || (show === "PROBLEM" && ["ERROR", "FAILED"].includes(r.state))) &&
      (!q || `${r.registerNumber} ${r.rollNumber} ${r.name}`.toLowerCase().includes(q.toLowerCase()))
  );
  const s = job?.summary;
  const pct = s ? Math.round(((s.created + s.failed) / Math.max(s.total, 1)) * 100) : 0;
  const errors = preview?.summary?.errors || 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-7">
      <h2 className="text-2xl font-bold tracking-tight text-slate-950">Import existing students (2nd / 3rd year)</h2>
      <p className="mt-1 text-sm text-slate-500">
        For students who already have register numbers. Their numbers are kept exactly as in the Excel. Everything happens on this page.
      </p>

      {/* 1. the file */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-sm font-semibold text-slate-900">1. Choose the Excel file</p>
          <button onClick={template} className={btn.small}>
            <Icon name="download" className="h-4 w-4" />
            Download template
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          disabled={busy === "import" || busy === "process"}
          onChange={(e) => {
            check(e.target.files?.[0] || null);
            e.target.value = "";
          }}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        {file && <p className="mt-2 text-xs text-slate-500">File: {file.name}</p>}
        <details className="mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-slate-700">Columns (any order; bold = must have)</summary>
          <ul className="mt-2 grid gap-x-6 gap-y-0.5 sm:grid-cols-2">
            {COLUMNS.map(([c, hint, req]) => (
              <li key={c}>
                <span className={req ? "font-bold text-slate-900" : ""}>{c}</span>
                {hint && <span className="text-slate-500"> – {hint}</span>}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {busy === "check" && <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">Checking every row… please wait</p>}
      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {/* 2. what will happen / what is happening */}
      {rows.length > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          {!job ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex-1 text-sm font-semibold text-slate-900">
                2. Checked: {preview.summary.total} students – <span className="text-emerald-700">{preview.summary.ready} ready</span>
                {errors > 0 && <span className="text-red-700"> · {errors} with errors</span>}
                {preview.summary.warnings > 0 && <span className="text-yellow-800"> · {preview.summary.warnings} to check (warnings)</span>}
              </p>
              {errors > 0 ? (
                <span className="text-sm text-red-700">Fix the red rows in the Excel, then choose the file again. Nothing is imported until there are no errors.</span>
              ) : (
                <button onClick={start} disabled={busy !== ""} className={btn.primary}>
                  {busy === "import" ? "Starting…" : `Import ${preview.summary.total} students`}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1 text-sm font-semibold text-slate-900">
                  {busy === "process" ? "3. Importing… keep this page open" : job.status === "DONE" ? "3. Import finished" : "3. Import paused"}
                </p>
                {busy !== "process" && s.pending > 0 && (
                  <button onClick={() => run(job._id)} className={btn.primary}>
                    Continue
                  </button>
                )}
                {busy !== "process" && (s.failed > 0 || s.photosFailed > 0) && (
                  <button onClick={retry} className={btn.secondary}>
                    Retry failed
                  </button>
                )}
                <button onClick={() => downloadBlob(api, `/student-import/${job._id}/export`, {}, "imported_students.xlsx").catch(() => toast.error("Could not download."))} className={btn.secondary}>
                  <Icon name="download" className="h-4 w-4" />
                  Download result
                </button>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-600">
                <span>
                  Imported: <b className="text-emerald-700">{s.created}</b>
                </span>
                <span>
                  Failed: <b className="text-red-700">{s.failed}</b>
                </span>
                <span>
                  Waiting: <b>{s.pending}</b>
                </span>
                <span>
                  Photos copied: <b>{s.photosDone}</b>
                  {s.photosFailed > 0 && <span className="text-red-700"> ({s.photosFailed} failed)</span>}
                </span>
              </p>
            </>
          )}

          {/* filters */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {(job ? ["ALL", "CREATED", "FAILED", "PENDING"] : ["ALL", "ERROR", "WARN", "READY"]).map((k) => (
              <button
                key={k}
                onClick={() => setShow(k)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${show === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {k === "ALL" ? "All" : ROW_STATE[k].label} ({k === "ALL" ? rows.length : count(k)})
              </button>
            ))}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Register no., roll no. or name" className="ml-auto h-9 w-60 rounded-lg border border-slate-300 px-3 text-sm" />
          </div>

          {/* every row with what happened */}
          <div className="mt-3 max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2">Excel row</th>
                  <th className="px-3 py-2">Register No.</th>
                  <th className="px-3 py-2">Roll No.</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Dept{!job && " · Sem"}</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">What happened / what to fix</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const st = ROW_STATE[r.state];
                  return (
                    <tr key={r.rowNumber} className={`border-t border-slate-100 align-top ${st.row}`}>
                      <td className="px-3 py-2 tabular-nums text-slate-500">{r.rowNumber}</td>
                      <td className="px-3 py-2 font-semibold tabular-nums">{r.registerNumber || "–"}</td>
                      <td className="px-3 py-2 tabular-nums">{r.rollNumber}</td>
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2 text-xs">
                        {r.department}
                        {r.semester ? ` · Sem ${r.semester}` : ""}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.chip}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.messages.map((m) => (
                          <p key={m} className={r.state === "ERROR" || r.state === "FAILED" ? "font-semibold text-red-700" : "text-emerald-700"}>
                            {m}
                          </p>
                        ))}
                        {r.warnings.map((m) => (
                          <p key={m} className="text-yellow-800">
                            {m}
                          </p>
                        ))}
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nothing in this group.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
