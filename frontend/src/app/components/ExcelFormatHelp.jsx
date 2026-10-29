"use client";

// Explains the Excel template used by the HOD Final IA and Final attendance
// uploads, so the HOD knows which columns are read and how to fill them.
//
//   <ExcelFormatHelp kind="ia" subjects={subjects} />
//   const sheet = excelInstructionsSheet("attendance", subjects);  // for the template

import * as XLSX from "xlsx";

export const KINDS = {
  ia: {
    what: "IA marks",
    maxLabel: "Maximum IA Marks",
    fill: "IA marks scored by the student",
  },
  attendance: {
    what: "attendance",
    maxLabel: "Maximum (%) – keep 100",
    fill: "attendance percentage (0–100); below 75% is shortage",
  },
};

export const BASE_COLUMNS = ["Sl No", "Register Number", "Student Name", "Phone Number", "Photo"];

function rules(kind) {
  const k = KINDS[kind];
  return [
    "Always start from \"Download Template\". It already has your students, subject columns and saved entries.",
    "Do not rename, delete or reorder the header row (row 1). Column names must stay exactly as given.",
    kind === "ia"
      ? `Row 2 is the MAX row (${k.maxLabel}) – already filled in. You may change a subject's maximum here.`
      : "There is no maximum row – attendance is entered directly as a percentage.",
    `From row ${kind === "ia" ? 3 : 2}, enter the ${k.fill} under each subject code column.`,
    "Only the \"Register Number\" and subject code columns are read. Sl No, Name, Phone and Photo are for reference only.",
    "Do not change register numbers. Rows with an unknown register number are skipped.",
    "A blank cell leaves that entry unchanged. Enter numbers only (no text such as AB or -).",
    "Keep the data on the first sheet. After uploading, check the table and click Save.",
  ];
}

export function excelInstructionsSheet(kind, subjects = []) {
  const k = KINDS[kind];
  const rows = [
    [`How to fill the ${k.what} template`],
    [],
    ...rules(kind).map((r, i) => [`${i + 1}. ${r}`]),
    [],
    ["Columns", "Meaning"],
    ["Sl No", "Serial number (not read)"],
    ["Register Number", "Student register number – used to match the student (required)"],
    ["Student Name", "Reference only (not read)"],
    ["Phone Number", "Reference only (not read)"],
    ["Photo", "Reference only (not read)"],
    ...subjects.map((s) => [s.code, `${s.name || "Subject"} – ${k.fill}`]),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = [{ wch: 22 }, { wch: 70 }];
  return sheet;
}

export default function ExcelFormatHelp({ kind, subjects = [] }) {
  const k = KINDS[kind];
  const columns = [...BASE_COLUMNS, ...subjects.map((s) => s.code)];

  return (
    <details className="group mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
      <summary className="cursor-pointer select-none font-semibold text-slate-800">
        Excel format &amp; column names
        <span className="ml-1 font-normal text-slate-500 group-open:hidden">(click to view)</span>
      </summary>

      <div className="mt-2 space-y-3">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-slate-300 bg-white px-2 py-1 text-left font-semibold text-slate-500">Row</th>
                {columns.map((c, i) => (
                  <th
                    key={`${c}-${i}`}
                    className={`whitespace-nowrap border border-slate-300 px-2 py-1 text-left font-bold ${
                      i === 1 || i >= BASE_COLUMNS.length ? "bg-blue-50 text-blue-800" : "bg-white text-slate-500"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* attendance has no MAX row (percentages) */}
              {kind === "ia" && (
                <tr>
                  <td className="border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-500">2</td>
                  <td className="border border-slate-300 bg-white px-2 py-1" />
                  <td className="border border-slate-300 bg-white px-2 py-1 font-semibold">MAX</td>
                  <td className="whitespace-nowrap border border-slate-300 bg-white px-2 py-1">{k.maxLabel}</td>
                  <td className="border border-slate-300 bg-white px-2 py-1" />
                  <td className="border border-slate-300 bg-white px-2 py-1" />
                  {subjects.map((s) => (
                    <td key={s.subjectId || s.code} className="border border-slate-300 bg-white px-2 py-1 font-semibold">
                      {s.maxMarks ?? ""}
                    </td>
                  ))}
                </tr>
              )}
              <tr>
                <td className="border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-500">{kind === "ia" ? "3…" : "2…"}</td>
                <td className="border border-slate-300 bg-white px-2 py-1">1</td>
                <td className="whitespace-nowrap border border-slate-300 bg-white px-2 py-1">Register No.</td>
                <td className="border border-slate-300 bg-white px-2 py-1">Name</td>
                <td className="border border-slate-300 bg-white px-2 py-1" />
                <td className="border border-slate-300 bg-white px-2 py-1" />
                {subjects.map((s) => (
                  <td key={s.subjectId || s.code} className="border border-slate-300 bg-white px-2 py-1 text-slate-500">
                    {kind === "ia" ? "marks" : "%"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">Highlighted columns are the ones read during upload.</p>
        </div>

        <ol className="list-decimal space-y-1 pl-4 leading-5">
          {rules(kind).map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </div>
    </details>
  );
}
