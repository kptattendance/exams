"use client";

// The "Excel" window of the HOD Final IA / Final attendance pages: choose the
// semester, see the exact format, download the ready-filled template (students,
// subject columns and – for IA – the maximum marks are already in it) and
// upload it back. The page keeps its own download / upload logic; this window
// only calls it.
//   semester / onSemester – the page's own semester choice (loads its students)
//   ready   – students and subjects of that semester are loaded
//   locked  – the sheet is submitted, nothing can be uploaded

import { BASE_COLUMNS, KINDS } from "./ExcelFormatHelp";

const cell = "border border-slate-200 px-2 py-1";

export default function ExcelDialog({ open, onClose, kind, subjects = [], semester, onSemester, loading, ready, locked, studentCount = 0, onDownload, onUpload, importing }) {
  if (!open) return null;
  const k = KINDS[kind];
  const ia = kind === "ia";
  const columns = [...BASE_COLUMNS, ...subjects.map((s) => s.code)];
  const steps = ia
    ? [
        "Download the template – your students, subject columns and maximum marks are already filled in.",
        "Type the IA marks under each subject code. Do not change row 1, row 2 or the register numbers.",
        "Upload the file, check the table and click Save.",
      ]
    : [
        "Download the template – your students and subject columns are already filled in.",
        "Type the attendance percentage (0–100) under each subject code. Do not change row 1 or the register numbers.",
        "Upload the file, check the table and click Save.",
      ];

  return (
    <div className="fixed inset-0 z-[65] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/45" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-slate-950">{ia ? "Final IA" : "Final attendance"} – Excel</h2>
            <p className="text-sm text-slate-500">Choose the semester, download the template, fill it, upload it.</p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <label className="block max-w-xs">
            <span className="text-sm font-semibold text-slate-700">Template for which semester?</span>
            <select value={semester} onChange={(e) => onSemester(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">Select semester</option>
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>

          {!semester ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">Choose the semester – the template is made with its subjects and students.</p>
          ) : loading ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-500">Loading students and subjects… please wait</p>
          ) : !ready ? (
            <p className="mt-4 rounded-xl bg-orange-50 px-3 py-3 text-sm text-orange-800">No students or subjects found for this semester and batch. Check the batch on the page.</p>
          ) : (
            <>
              <p className="mt-4 text-sm font-semibold text-slate-800">
                Format · {studentCount} students · {subjects.length} subjects
              </p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      <th className={`${cell} bg-slate-50 text-left text-slate-500`}>Row</th>
                      {columns.map((c, i) => (
                        <th key={`${c}-${i}`} className={`${cell} whitespace-nowrap text-left font-bold ${i === 1 || i >= BASE_COLUMNS.length ? "bg-blue-50 text-blue-800" : "bg-white text-slate-500"}`}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ia && (
                      <tr>
                        <td className={`${cell} font-semibold text-slate-500`}>2</td>
                        <td className={cell} />
                        <td className={`${cell} font-semibold`}>MAX</td>
                        <td className={`${cell} whitespace-nowrap`}>{k.maxLabel}</td>
                        <td className={cell} />
                        <td className={cell} />
                        {subjects.map((s) => (
                          <td key={s.subjectId || s.code} className={`${cell} bg-emerald-50 font-semibold text-emerald-800`}>
                            {s.maxMarks ?? ""}
                          </td>
                        ))}
                      </tr>
                    )}
                    <tr>
                      <td className={`${cell} font-semibold text-slate-500`}>{ia ? "3…" : "2…"}</td>
                      <td className={cell}>1</td>
                      <td className={`${cell} whitespace-nowrap`}>Register No.</td>
                      <td className={cell}>Name</td>
                      <td className={cell} />
                      <td className={cell} />
                      {subjects.map((s) => (
                        <td key={s.subjectId || s.code} className={`${cell} text-slate-400`}>
                          {ia ? "marks" : "%"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                Blue columns are read when you upload.
                {ia ? " Green: maximum marks, already filled in for you." : " Only the percentage – there is no maximum row."}
              </p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
                {steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </>
          )}
          {locked && <p className="mt-3 rounded-xl bg-orange-50 px-3 py-2 text-sm text-orange-800">This sheet is already submitted – it cannot be changed now.</p>}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:justify-end">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Close
          </button>
          <button
            onClick={onDownload}
            disabled={!ready || loading || locked}
            className="rounded-lg border border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:border-slate-300 disabled:text-slate-400"
          >
            ↓ Download template{semester ? ` (Sem ${semester})` : ""}
          </button>
          <button onClick={onUpload} disabled={!ready || loading || locked || importing} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300">
            {importing ? "Importing…" : "↑ Upload filled Excel"}
          </button>
        </div>
      </div>
    </div>
  );
}
