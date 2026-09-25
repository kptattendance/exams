"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const COLLEGE_CODE = "103";

const DEPARTMENTS = [
  { code: "AT", name: "Automobile Engineering" },
  { code: "CH", name: "Chemical Engineering" },
  { code: "CE", name: "Civil Engineering" },
  { code: "CS", name: "Computer Science & Engineering" },
  { code: "EC", name: "Electronics & Communication Engineering" },
  { code: "EE", name: "Electrical & Electronics Engineering" },
  { code: "ME", name: "Mechanical Engineering" },
  { code: "PS", name: "Polymer Science Engineering" },
];

const ADMISSION_TYPES = [
  {
    value: "regular",
    label: "Regular",
    entryCode: "0",
  },
  {
    value: "lateral",
    label: "Lateral Entry",
    entryCode: "7",
  },
  {
    value: "iti",
    label: "ITI",
    entryCode: "3",
  },
];

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_-]/g, " ");
}

function getColumn(row, possibleNames) {
  const keys = Object.keys(row);

  const normalizedKeys = keys.map((key) => ({
    original: key,
    normalized: normalizeHeader(key),
  }));

  for (const possibleName of possibleNames) {
    const found = normalizedKeys.find(
      (item) => item.normalized === normalizeHeader(possibleName)
    );

    if (found) {
      return row[found.original];
    }
  }

  return "";
}

export default function RegisterNumbersPage() {
  const fileInputRef = useRef(null);

  const [academicYear, setAcademicYear] = useState("2026");
  const [department, setDepartment] = useState("");
  const [admissionType, setAdmissionType] = useState("");

  const [students, setStudents] = useState([]);
  const [fileName, setFileName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedDepartment = useMemo(
    () => DEPARTMENTS.find((item) => item.code === department),
    [department]
  );

  const selectedAdmissionType = useMemo(
    () =>
      ADMISSION_TYPES.find((item) => item.value === admissionType),
    [admissionType]
  );

  const generateRegisterNumber = (index) => {
    if (!selectedDepartment || !selectedAdmissionType) {
      return "";
    }

    const yearCode = String(academicYear).slice(-2);

    const serialNumber = String(index + 1).padStart(3, "0");

    return `${COLLEGE_CODE}${selectedDepartment.code}${yearCode}${selectedAdmissionType.entryCode}${serialNumber}`;
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");
    setStudents([]);
    setFileName(file.name);

    if (!department || !admissionType || !academicYear) {
      setError(
        "Please select Academic Year, Department and Admission Type before uploading the Excel file."
      );

      event.target.value = "";
      return;
    }

    const validExtensions = [".xlsx", ".xls", ".csv"];

    const extension = file.name
      .substring(file.name.lastIndexOf("."))
      .toLowerCase();

    if (!validExtensions.includes(extension)) {
      setError("Please upload an Excel file (.xlsx, .xls) or CSV file.");
      event.target.value = "";
      return;
    }

    try {
      setLoading(true);

      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
      });

      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        throw new Error("The uploaded Excel file does not contain a sheet.");
      }

      const worksheet = workbook.Sheets[firstSheetName];

      const rows = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
      });

      if (!rows.length) {
        throw new Error("The uploaded Excel file is empty.");
      }

      const parsedStudents = rows
        .map((row, index) => {
          const name = String(
            getColumn(row, [
              "Student Name",
              "Name",
              "StudentName",
            ]) || ""
          ).trim();

          const fatherName = String(
            getColumn(row, [
              "Father Name",
              "Father's Name",
              "FatherName",
              "Father",
            ]) || ""
          ).trim();

          const aadhaarNumber = String(
            getColumn(row, [
              "Aadhaar Number",
              "Aadhaar",
              "Aadhar Number",
              "Aadhar",
              "AadhaarNumber",
            ]) || ""
          ).trim();

          return {
            originalIndex: index,
            name,
            fatherName,
            aadhaarNumber,
          };
        })
        .filter((student) => student.name);

      if (!parsedStudents.length) {
        throw new Error(
          "No students found. Please make sure the Excel contains a 'Student Name' column."
        );
      }

      // ---------------------------------------------------------
      // SORT
      // 1. Student Name A-Z
      // 2. Father Name A-Z if student names are same
      // ---------------------------------------------------------

      parsedStudents.sort((a, b) => {
        const nameCompare = a.name.localeCompare(
          b.name,
          undefined,
          {
            sensitivity: "base",
          }
        );

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return a.fatherName.localeCompare(
          b.fatherName,
          undefined,
          {
            sensitivity: "base",
          }
        );
      });

      const generatedStudents = parsedStudents.map(
        (student, index) => ({
          ...student,
          serialNumber: index + 1,
          registerNumber: generateRegisterNumber(index),
        })
      );

      setStudents(generatedStudents);

      setSuccess(
        `${generatedStudents.length} register numbers generated successfully.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err?.message ||
          "Unable to process the uploaded Excel file."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!students.length) return;

    const exportData = students.map((student) => ({
      "Sl. No.": student.serialNumber,
      "Student Name": student.name,
      "Father Name": student.fatherName,
      "Aadhaar Number": student.aadhaarNumber,
      "Register Number": student.registerNumber,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    worksheet["!cols"] = [
      { wch: 10 },
      { wch: 30 },
      { wch: 30 },
      { wch: 20 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Register Numbers"
    );

    const departmentCode = selectedDepartment?.code || "DEPT";

    const admissionCode =
      selectedAdmissionType?.value || "ADMISSION";

    const outputFileName =
      `Register_Numbers_${departmentCode}_${academicYear}_${admissionCode}.xlsx`;

    XLSX.writeFile(workbook, outputFileName);
  };

  const handleClear = () => {
    setStudents([]);
    setFileName("");
    setError("");
    setSuccess("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const templateData = [
      {
        "Student Name": "",
        "Father Name": "",
        "Aadhaar Number": "",
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(templateData);

    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 30 },
      { wch: 20 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students"
    );

    XLSX.writeFile(
      workbook,
      "Register_Number_Student_Template.xlsx"
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        {/* =====================================================
            SETTINGS CARD
        ====================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Register Number Settings
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Select the academic year, department and admission
              type before uploading student data.
            </p>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-3">
            {/* Academic Year */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Academic Year
              </label>

              <select
                value={academicYear}
                onChange={(e) => {
                  setAcademicYear(e.target.value);
                  setStudents([]);
                  setSuccess("");
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="2026">2026-27</option>
                <option value="2025">2025-26</option>
                <option value="2024">2024-25</option>
                <option value="2023">2023-24</option>
                <option value="2022">2022-23</option>
                <option value="2021">2021-22</option>
              </select>
            </div>

            {/* Department */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Department
              </label>

              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setStudents([]);
                  setSuccess("");
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  Select Department
                </option>

                {DEPARTMENTS.map((item) => (
                  <option
                    key={item.code}
                    value={item.code}
                  >
                    {item.code} - {item.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Admission Type */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Admission Type
              </label>

              <select
                value={admissionType}
                onChange={(e) => {
                  setAdmissionType(e.target.value);
                  setStudents([]);
                  setSuccess("");
                }}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">
                  Select Admission Type
                </option>

                {ADMISSION_TYPES.map((item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

     {/* =====================================================
    UPLOAD CARD
====================================================== */}

<div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
  <div className="border-b border-slate-100 px-5 py-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-bold text-slate-900">
          Upload Student List
        </h2>

        <p className="mt-1 text-xs text-slate-500">
          Upload the student Excel file using the format shown below.
        </p>
      </div>

      <button
        type="button"
        onClick={downloadTemplate}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>

        Download Template
      </button>
    </div>
  </div>

  <div className="p-5">

    {/* =====================================================
        EXCEL FORMAT PREVIEW
    ====================================================== */}

    <div className="mb-6 overflow-hidden rounded-xl border border-slate-200">

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 4h16v16H4z" />
              <path d="M8 8h8" />
              <path d="M8 12h8" />
              <path d="M8 16h5" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-800">
              Excel Format Required
            </p>

            <p className="text-xs text-slate-500">
              Enter one student per row using these columns.
            </p>
          </div>
        </div>
      </div>


      {/* Instructions */}

      <div className="border-t border-slate-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">
          Important
        </p>

        <ul className="mt-1 space-y-1 text-xs text-amber-700">
          <li>
            • Keep the column headings as shown above.
          </li>

          <li>
            • Enter one student in each row.
          </li>

          <li>
            • Student Name and Father Name are required.
          </li>

          <li>
            • Aadhaar Number is used for student identification.
          </li>

          <li>
            • Do not add the Register Number column. It will be generated automatically.
          </li>
        </ul>
      </div>
    </div>

    {/* =====================================================
        UPLOAD AREA
    ====================================================== */}

    <div
      onClick={() =>
        fileInputRef.current?.click()
      }
      className={`group cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${
        !department || !admissionType
          ? "cursor-not-allowed border-slate-200 bg-slate-50"
          : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40"
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileUpload}
        disabled={!department || !admissionType}
        className="hidden"
      />

      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 transition group-hover:scale-105">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 20h14" />
        </svg>
      </div>

      <p className="mt-4 text-sm font-bold text-slate-800">
        Click to upload student Excel
      </p>

      <p className="mt-1 text-xs text-slate-500">
        Supported formats: .xlsx, .xls, .csv
      </p>

      {!department || !admissionType ? (
        <p className="mt-3 text-xs font-medium text-amber-600">
          Select department and admission type first
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          The system will sort students automatically by
          Student Name and Father Name.
        </p>
      )}
    </div>

    {/* =====================================================
        UPLOADED FILE
    ====================================================== */}

    {fileName && (
      <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8" />
              <path d="M8 17h8" />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">
              {fileName}
            </p>

            <p className="text-xs text-slate-500">
              {students.length} students processed
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleClear}
          className="ml-4 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
        >
          Clear
        </button>
      </div>
    )}

    {/* Error */}

    {error && (
      <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        {error}
      </div>
    )}

    {/* Success */}

    {success && (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
        {success}
      </div>
    )}

    {/* Loading */}

    {loading && (
      <div className="mt-4 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />

        Processing Excel file...
      </div>
    )}
  </div>
</div>

        {/* =====================================================
            GENERATED RESULTS
        ====================================================== */}

        {students.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {/* Table Header */}

            <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Generated Register Numbers
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {students.length} students •{" "}
                  {selectedDepartment?.code} •{" "}
                  {selectedAdmissionType?.label} •{" "}
                  {academicYear}-{String(
                    Number(academicYear) + 1
                  ).slice(-2)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3v12" />
                  <path d="m7 10 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>

                Download Excel
              </button>
            </div>

            {/* Table */}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Sl. No.
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Student Name
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Father Name
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Aadhaar Number
                    </th>

                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                      Register Number
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {students.map((student) => (
                    <tr
                      key={`${student.originalIndex}-${student.registerNumber}`}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-500">
                        {student.serialNumber}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-900">
                        {student.name}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">
                        {student.fatherName || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-600">
                        {student.aadhaarNumber || "—"}
                      </td>

                      <td className="whitespace-nowrap px-5 py-3">
                        <span className="inline-flex rounded-lg bg-blue-50 px-3 py-1.5 font-mono text-sm font-bold text-blue-700">
                          {student.registerNumber}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom */}

            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Register numbers are generated sequentially after
                alphabetical sorting.
              </p>

              <p className="text-sm font-bold text-slate-800">
                Total: {students.length}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}