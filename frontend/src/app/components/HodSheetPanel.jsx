"use client";

// One place for everything Excel / PDF on the HOD Final IA and Final attendance
// pages (shown once the students are loaded):
//   1 Download template → 2 fill it → 3 Upload it     (while the sheet is a draft)
//   PDF with a student-signature column, and the verification copy for the
//   officer who visits to verify the entries               (after Submit)
// The page keeps its own download / upload logic; this only calls it.

const STORE = "kpt-hod-sheet";

// Opens the sheet (print → Save as PDF) in a new tab.
//   sheet: { kind, copy: "students" | "verification", academicYear, semester, batch, status, department,
//            subjects: [{ subjectId, code, name, iaMin, iaMax }],
//            students: [{ registerNumber, studentName, values: { [subjectId]: value } }] }
export function openSignatureSheet(sheet) {
  try {
    localStorage.setItem(STORE, JSON.stringify(sheet));
  } catch {
    alert("Could not open the PDF – the browser blocked it. Please allow site data and try again.");
    return;
  }
  window.open("/print/hod-sheet?auto=1", "_blank");
}

// the stored sheet as text (null when there is none); for useSyncExternalStore
export function readSignatureSheetRaw() {
  try {
    return localStorage.getItem(STORE);
  } catch {
    return null;
  }
}

const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400";

function Step({ n, title, children, done }) {
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg border border-gray-200 bg-gray-50/60 p-2.5">
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-600 text-white" : "bg-slate-800 text-white"}`}>{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gray-800">{title}</p>
        <div className="mt-1.5">{children}</div>
      </div>
    </div>
  );
}

export default function HodSheetPanel({ kind, status, importing, onDownload, onUpload, onPdf }) {
  const ia = kind === "ia";
  const draft = status === "draft";
  const what = ia ? "IA marks" : "attendance %";

  return (
    <div className="mt-3 grid gap-3 border-t border-gray-100 pt-3 lg:grid-cols-[2fr_1fr]">
      {/* Excel: only while the sheet can still be changed */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Excel {draft ? "– optional, or type in the table below" : "– locked after Submit"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Step n="1" title="Download the template">
            <button type="button" onClick={onDownload} disabled={!draft} className={`${btn} bg-white text-green-700 ring-1 ring-green-600 hover:bg-green-50`}>
              ↓ Template (.xlsx)
            </button>
          </Step>
          <Step n="2" title={`Type the ${what}`}>
            <p className="text-[11px] leading-4 text-gray-500">{ia ? "Under each subject code. Keep rows 1–2 and register numbers as they are." : "0–100 under each subject code. Keep row 1 and register numbers as they are."}</p>
          </Step>
          <Step n="3" title="Upload it back">
            <button type="button" onClick={onUpload} disabled={!draft || importing} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
              {importing ? "Importing…" : "↑ Upload filled Excel"}
            </button>
          </Step>
        </div>
      </div>

      {/* PDF for signatures: after Submit */}
      <div className={`rounded-lg border p-3 ${draft ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-blue-50"}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">After Submit</p>
        <p className="mt-1 text-xs text-gray-700">PDF of the {what}, to print:</p>
        <div className="mt-2 grid gap-1.5">
          <button type="button" onClick={() => onPdf("students")} disabled={draft} className={`${btn} w-full bg-blue-600 text-white hover:bg-blue-700`}>
            ⎙ Student signature copy
          </button>
          <button
            type="button"
            onClick={() => onPdf("verification")}
            disabled={draft}
            title="For the officer who visits to verify – with HOD, Academic Dean and Principal signatures"
            className={`${btn} w-full bg-white text-blue-700 ring-1 ring-blue-600 hover:bg-blue-50`}
          >
            ⎙ Verification copy
          </button>
        </div>
        {draft && <p className="mt-1.5 text-[11px] text-gray-500">Available once the sheet is submitted.</p>}
      </div>
    </div>
  );
}
