"use client";

// One place for everything Excel / PDF on the HOD Final IA and Final attendance
// pages (shown once the students are loaded):
//   1 Download template → 2 fill it → 3 Upload it     (while the sheet is a draft)
//   PDF with a student-signature column, and the verification copy for the
//   officer who visits to verify the entries               (after Submit)
// The page keeps its own download / upload logic; this only calls it.

const STORE = "kpt-hod-sheet";

// Opens the sheet (print → Save as PDF) in a new tab.
//   sheet: { kind, copy: "students" | "verification" (before) | "after", academicYear, semester, batch, status, department, verification,
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

export default function HodSheetPanel({ kind, status, verified = false, importing, onDownload, onUpload, onPdf }) {
  const ia = kind === "ia";
  const draft = status === "draft";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
      {/* Excel: only while the sheet can still be changed */}
      {draft && (
        <>
          <button type="button" onClick={onDownload} className={`${btn} bg-white text-green-700 ring-1 ring-green-600 hover:bg-green-50`}>
            ↓ Excel template
          </button>
          <button type="button" onClick={onUpload} disabled={importing} className={`${btn} bg-green-600 text-white hover:bg-green-700`}>
            {importing ? "Importing…" : "↑ Upload filled Excel"}
          </button>
          <span className="text-[11px] text-gray-500">
            {ia ? "Keep rows 1–2 and register numbers as they are." : "Type 0–100. Keep row 1 and register numbers as they are."} PDFs come after Submit.
          </span>
        </>
      )}

      {/* PDF for signatures: after Submit */}
      {!draft && (
        <>
          <button type="button" onClick={() => onPdf("students")} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}>
            ⎙ Student signature copy
          </button>
          <button
            type="button"
            onClick={() => onPdf("verification")}
            title="For the verifier to mark on – signed by the Class In-charge, HOD and Principal / Dean"
            className={`${btn} bg-white text-blue-700 ring-1 ring-blue-600 hover:bg-blue-50`}
          >
            ⎙ Before verification copy
          </button>
          <button
            type="button"
            onClick={() => onPdf("after")}
            disabled={!verified}
            title={verified ? "The final sheet – signed by the Verifier, HOD and Principal / Dean" : "Available after the COE's final freeze"}
            className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}
          >
            ⎙ After verification copy
          </button>
          {!verified && <span className="text-[11px] text-gray-500">After copy: once the COE gives the final freeze.</span>}
        </>
      )}
    </div>
  );
}
