"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useAuth } from "@clerk/nextjs";
import { batchFor, useAcademicYear } from "../../components/academicYear";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function FinalIAPage() {
  const {
    getToken,
    isLoaded,
    isSignedIn,
  } = useAuth();

  const fileInputRef = useRef(null);

  // Running academic year – set by the Admin, not chosen here
  const academicYear = useAcademicYear();

  const [semester, setSemester] =
    useState("");

  const [batch, setBatch] =
    useState("");

  const [subjects, setSubjects] =
    useState([]);

  const [students, setStudents] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [excelLoading, setExcelLoading] =
    useState(false);

  const [status, setStatus] =
    useState("draft");

  // Note from the Exam Officer when a sheet is sent back
  const [returnedReason, setReturnedReason] = useState("");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ============================================================
  // LOAD FINAL IA
  // ============================================================

  const loadFinalIA = async () => {
    if (
      !academicYear ||
      !semester ||
      !batch
    ) {
      setError(
        "Please select Academic Year, Semester and Batch."
      );
      return;
    }

    if (!isLoaded) {
      setError(
        "Authentication is still loading. Please wait."
      );
      return;
    }

    if (!isSignedIn) {
      setError(
        "Please login before entering Final IA."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token = await getToken();

      if (!token) {
        setError(
          "Authentication token not available. Please login again."
        );
        return;
      }

      const response = await axios.get(
        `${API_URL}/api/final-ia/prepare`,
        {
          params: {
            academicYear,
            semester,
            batch,
          },

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        response.data?.data;
      console.log(response.data)
      if (!data) {
        throw new Error(
          "Invalid response received from server."
        );
      }

      setSubjects(
        data.subjects || []
      );

      setStudents(
        data.students || []
      );

      setStatus(
        data.status || "draft"
      );

      setReturnedReason(
        data.returnedReason || ""
      );
    } catch (err) {
      console.error(
        "Final IA Load Error:",
        err
      );

      setSubjects([]);
      setStudents([]);

      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load Final IA data."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // CLEAR TABLE
  // ============================================================

  const clearTable = () => {
    setReturnedReason("");
    setSubjects([]);
    setStudents([]);
    setStatus("draft");
    setMessage("");
    setError("");
  };

  // ============================================================
  // MAX MARKS
  // ============================================================

  const handleMaxMarksChange = (
    subjectId,
    value
  ) => {
    if (status !== "draft") {
      return;
    }

    setSubjects(
      (previousSubjects) =>
        previousSubjects.map(
          (subject) =>
            String(
              subject.subjectId
            ) === String(subjectId)
              ? {
                ...subject,
                maxMarks:
                  value === ""
                    ? ""
                    : Number(value),
              }
              : subject
        )
    );
  };

  // ============================================================
  // STUDENT MARK
  // ============================================================

  const handleMarkChange = (
    studentId,
    subjectId,
    value
  ) => {
    if (status !== "draft") {
      return;
    }

    setStudents(
      (previousStudents) =>
        previousStudents.map(
          (student) => {
            if (
              String(
                student.studentId
              ) !==
              String(studentId)
            ) {
              return student;
            }

            return {
              ...student,

              marks:
                (
                  student.marks ||
                  []
                ).map(
                  (mark) =>
                    String(
                      mark.subjectId
                    ) ===
                      String(subjectId)
                      ? {
                        ...mark,
                        marks:
                          value === ""
                            ? ""
                            : Number(
                              value
                            ),
                      }
                      : mark
                ),
            };
          }
        )
    );
  };

  // ============================================================
  // GET MARK
  // ============================================================

  const getStudentMark = (
    student,
    subjectId
  ) => {
    const mark =
      (
        student.marks || []
      ).find(
        (item) =>
          String(
            item.subjectId
          ) ===
          String(subjectId)
      );

    if (
      mark?.marks === null ||
      mark?.marks === undefined
    ) {
      return "";
    }

    return mark.marks;
  };

  // ============================================================
  // VALIDATE
  // ============================================================

  const validateBeforeSave =
    () => {
      if (
        subjects.length === 0
      ) {
        return "No subjects found.";
      }

      if (
        students.length === 0
      ) {
        return "No students found.";
      }

      // Check maximum marks

      for (
        const subject of subjects
      ) {
        if (
          subject.maxMarks ===
          "" ||
          subject.maxMarks ===
          null ||
          subject.maxMarks ===
          undefined ||
          !Number.isFinite(
            Number(
              subject.maxMarks
            )
          ) ||
          Number(
            subject.maxMarks
          ) <= 0
        ) {
          return `Enter maximum IA marks for ${subject.code}.`;
        }
      }

      // Check student marks

      for (
        const student of students
      ) {
        for (
          const subject of subjects
        ) {
          const mark =
            getStudentMark(
              student,
              subject.subjectId
            );

          if (
            mark === "" ||
            mark === null ||
            mark === undefined
          ) {
            return `Enter IA mark for ${student.studentName} - ${subject.code}.`;
          }

          const numericMark =
            Number(mark);

          const maxMarks =
            Number(
              subject.maxMarks
            );

          if (
            !Number.isFinite(
              numericMark
            )
          ) {
            return `Invalid IA mark for ${student.studentName} - ${subject.code}.`;
          }

          if (
            numericMark < 0
          ) {
            return `IA mark cannot be negative for ${student.studentName} - ${subject.code}.`;
          }

          if (
            numericMark >
            maxMarks
          ) {
            return `${student.studentName}: ${subject.code} mark cannot exceed ${maxMarks}.`;
          }
        }
      }

      return null;
    };

  // ============================================================
  // CREATE SAVE PAYLOAD
  // ============================================================

  const createSavePayload = () => {
    return {
      academicYear,

      semester:
        Number(semester),

      batch,

      subjects:
        subjects.map(
          (subject) => ({
            subjectId:
              subject.subjectId,

            maxMarks:
              Number(
                subject.maxMarks
              ),
          })
        ),

      students:
        students.map(
          (student) => ({
            studentId:
              student.studentId,

            marks:
              subjects.map(
                (subject) => ({
                  subjectId:
                    subject.subjectId,

                  marks:
                    Number(
                      getStudentMark(
                        student,
                        subject.subjectId
                      )
                    ),
                })
              ),
          })
        ),
    };
  };

  // ============================================================
  // SAVE
  // ============================================================

  const saveFinalIA = async () => {
    const validationError =
      validateBeforeSave();

    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    if (!isSignedIn) {
      setError(
        "Please login before saving Final IA."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const token =
        await getToken();

      if (!token) {
        setError(
          "Authentication token not available."
        );
        return;
      }

      const response =
        await axios.post(
          `${API_URL}/api/final-ia/save`,
          createSavePayload(),
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setStatus(
        response.data?.data
          ?.status ||
        "draft"
      );

      setMessage(
        response.data?.message ||
        "Final IA saved successfully."
      );
    } catch (err) {
      console.error(
        "Save Final IA Error:",
        err
      );

      setError(
        err?.response?.data?.message ||
        "Failed to save Final IA."
      );
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // SUBMIT
  // ============================================================

  const submitFinalIA = async () => {
    const validationError =
      validateBeforeSave();

    if (validationError) {
      setError(validationError);
      setMessage("");
      return;
    }

    const confirmed =
      window.confirm(
        "Once Final IA is submitted, it cannot be edited by the HOD.\n\nDo you want to submit Final IA?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setMessage("");

      const token =
        await getToken();

      if (!token) {
        setError(
          "Authentication token not available."
        );
        return;
      }

      // Save latest values

      await axios.post(
        `${API_URL}/api/final-ia/save`,
        createSavePayload(),
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      // Submit

      const response =
        await axios.post(
          `${API_URL}/api/final-ia/submit`,
          {
            academicYear,

            semester:
              Number(semester),

            batch,
          },
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      setStatus("submitted");

      setMessage(
        response.data?.message ||
        "Final IA submitted successfully."
      );
    } catch (err) {
      console.error(
        "Submit Final IA Error:",
        err
      );

      setError(
        err?.response?.data?.message ||
        "Failed to submit Final IA."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ============================================================
  // DOWNLOAD EXCEL TEMPLATE
  // ============================================================

  const downloadExcelTemplate =
    () => {
      if (
        students.length === 0 ||
        subjects.length === 0
      ) {
        setError(
          "Load students and subjects before downloading the Excel template."
        );
        return;
      }

      try {
        setError("");
        setMessage("");

        const headers = [
          "Sl No",
          "Register Number",
          "Student Name",
          "Phone Number",
          "Photo",
          ...subjects.map(
            (subject) =>
              subject.code
          ),
        ];

        const maxRow = [
          "",
          "MAX",
          "Maximum IA Marks",
          "",
          "",
          ...subjects.map(
            (subject) =>
              subject.maxMarks ??
              ""
          ),
        ];

        const studentRows =
          students.map(
            (
              student,
              index
            ) => [
                index + 1,

                student.registerNumber,

                student.studentName,

                student.phone || "",

                student.imageUrl || "",

                ...subjects.map(
                  (subject) => {
                    const mark =
                      getStudentMark(
                        student,
                        subject.subjectId
                      );

                    return mark === ""
                      ? ""
                      : mark;
                  }
                ),
              ]
          );

        const data = [
          headers,
          maxRow,
          ...studentRows,
        ];

        const worksheet =
          XLSX.utils.aoa_to_sheet(
            data
          );

        worksheet["!cols"] = [
          { wch: 7 },
          { wch: 18 },
          { wch: 26 },
          { wch: 15 },
          { wch: 40 },

          ...subjects.map(
            () => ({
              wch: 12,
            })
          ),
        ];

        worksheet["!freeze"] = {
          xSplit: 5,
          ySplit: 2,
        };

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Final IA"
        );

        const filename =
          `Final_IA_${academicYear}_Sem${semester}_${batch}.xlsx`;

        XLSX.writeFile(
          workbook,
          filename
        );

        setMessage(
          "Excel template downloaded successfully."
        );
      } catch (err) {
        console.error(
          "Excel Template Error:",
          err
        );

        setError(
          "Failed to create Excel template."
        );
      }
    };

  // ============================================================
  // UPLOAD EXCEL
  // ============================================================

  const handleExcelUpload =
    async (event) => {
      const file =
        event.target.files?.[0];

      if (!file) {
        return;
      }

      if (
        students.length === 0 ||
        subjects.length === 0
      ) {
        setError(
          "Load students and subjects before uploading Excel."
        );

        event.target.value = "";
        return;
      }

      try {
        setExcelLoading(true);
        setError("");
        setMessage("");

        const arrayBuffer =
          await file.arrayBuffer();

        const workbook =
          XLSX.read(
            arrayBuffer,
            {
              type: "array",
            }
          );

        const sheetName =
          workbook.SheetNames[0];

        const worksheet =
          workbook.Sheets[
          sheetName
          ];

        const rows =
          XLSX.utils.sheet_to_json(
            worksheet,
            {
              header: 1,
              defval: "",
            }
          );

        if (
          !rows ||
          rows.length < 3
        ) {
          throw new Error(
            "Excel file does not contain enough data."
          );
        }

        const headerRow =
          rows[0];

        const maxRow =
          rows[1];

        const registerIndex =
          headerRow.findIndex(
            (header) =>
              String(header)
                .trim()
                .toLowerCase() ===
              "register number"
          );

        if (
          registerIndex === -1
        ) {
          throw new Error(
            "Register Number column is missing."
          );
        }

        // Subject columns

        const subjectColumnMap =
          {};

        subjects.forEach(
          (subject) => {
            const index =
              headerRow.findIndex(
                (header) =>
                  String(header)
                    .trim()
                    .toUpperCase() ===
                  String(
                    subject.code
                  )
                    .trim()
                    .toUpperCase()
              );

            if (index !== -1) {
              subjectColumnMap[
                subject.subjectId
              ] = index;
            }
          }
        );

        const missingSubjects =
          subjects.filter(
            (subject) =>
              subjectColumnMap[
              subject.subjectId
              ] === undefined
          );

        if (
          missingSubjects.length > 0
        ) {
          throw new Error(
            `These subject columns are missing: ${missingSubjects
              .map(
                (subject) =>
                  subject.code
              )
              .join(", ")}`
          );
        }

        // Max marks

        const updatedSubjects =
          subjects.map(
            (subject) => {
              const columnIndex =
                subjectColumnMap[
                subject.subjectId
                ];

              const excelMax =
                maxRow?.[
                columnIndex
                ];

              if (
                excelMax !==
                undefined &&
                excelMax !== ""
              ) {
                const numericMax =
                  Number(
                    excelMax
                  );

                if (
                  Number.isFinite(
                    numericMax
                  ) &&
                  numericMax > 0
                ) {
                  return {
                    ...subject,
                    maxMarks:
                      numericMax,
                  };
                }
              }

              return subject;
            }
          );

        // Student map

        const studentMap = {};

        students.forEach(
          (student) => {
            studentMap[
              String(
                student.registerNumber
              )
                .trim()
                .toUpperCase()
            ] = student;
          }
        );

        const updatedStudents =
          students.map(
            (student) => ({
              ...student,

              marks:
                (
                  student.marks ||
                  []
                ).map(
                  (mark) => ({
                    ...mark,
                  })
                ),
            })
          );

        let importedCount = 0;
        let skippedCount = 0;

        // Read students

        for (
          let rowIndex = 2;
          rowIndex < rows.length;
          rowIndex++
        ) {
          const row =
            rows[rowIndex];

          if (
            !row ||
            row.length === 0
          ) {
            continue;
          }

          const registerNumber =
            String(
              row[
              registerIndex
              ] || ""
            )
              .trim()
              .toUpperCase();

          if (!registerNumber) {
            continue;
          }

          const student =
            studentMap[
            registerNumber
            ];

          if (!student) {
            skippedCount++;
            continue;
          }

          const studentIndex =
            updatedStudents.findIndex(
              (item) =>
                String(
                  item.registerNumber
                )
                  .trim()
                  .toUpperCase() ===
                registerNumber
            );

          if (
            studentIndex === -1
          ) {
            skippedCount++;
            continue;
          }

          subjects.forEach(
            (subject) => {
              const columnIndex =
                subjectColumnMap[
                subject.subjectId
                ];

              const value =
                row[
                columnIndex
                ];

              if (
                value ===
                undefined ||
                value === ""
              ) {
                return;
              }

              const numericMark =
                Number(value);

              if (
                !Number.isFinite(
                  numericMark
                )
              ) {
                return;
              }

              const marks =
                updatedStudents[
                  studentIndex
                ].marks || [];

              const markIndex =
                marks.findIndex(
                  (mark) =>
                    String(
                      mark.subjectId
                    ) ===
                    String(
                      subject.subjectId
                    )
                );

              if (
                markIndex !== -1
              ) {
                marks[
                  markIndex
                ] = {
                  ...marks[
                  markIndex
                  ],
                  marks:
                    numericMark,
                };
              } else {
                marks.push({
                  subjectId:
                    subject.subjectId,

                  marks:
                    numericMark,
                });
              }

              updatedStudents[
                studentIndex
              ].marks = marks;
            }
          );

          importedCount++;
        }

        setSubjects(
          updatedSubjects
        );

        setStudents(
          updatedStudents
        );

        setMessage(
          `Excel imported successfully. ${importedCount} student(s) updated${skippedCount > 0
            ? `, ${skippedCount} row(s) skipped`
            : ""
          }.`
        );
      } catch (err) {
        console.error(
          "Excel Upload Error:",
          err
        );

        setError(
          err?.message ||
          "Failed to import Excel file."
        );
      } finally {
        setExcelLoading(false);
        event.target.value = "";
      }
    };

  // ============================================================
  // SORT STUDENTS
  // Roll Number first
  // Register Number as secondary sorting
  // ============================================================

  const sortedStudents = [...students].sort(
    (a, b) => {
      const rollCompare = String(
        a.rollNumber ?? ""
      ).localeCompare(
        String(b.rollNumber ?? ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      );

      if (rollCompare !== 0) {
        return rollCompare;
      }

      const registerCompare = String(
        a.registerNumber ?? ""
      ).localeCompare(
        String(b.registerNumber ?? ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        }
      );

      if (registerCompare !== 0) {
        return registerCompare;
      }

      return String(
        a.studentName ?? ""
      ).localeCompare(
        String(b.studentName ?? ""),
        undefined,
        {
          sensitivity: "base",
        }
      );
    }
  );
  // ============================================================
  // AUTOMATIC LOAD
  // ============================================================

  useEffect(() => {
    if (
      isLoaded &&
      isSignedIn &&
      semester &&
      batch
    ) {
      loadFinalIA();
    }
  }, [
    isLoaded,
    isSignedIn,
    semester,
    batch,
  ]);

  // ============================================================
  // COUNTS
  // ============================================================

  const studentCount =
    students.length;

  const subjectCount =
    subjects.length;

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50 p-3 md:p-5">

<style jsx>{`
  .no-spinner::-webkit-outer-spin-button,
  .no-spinner::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .no-spinner {
    -moz-appearance: textfield;
    appearance: textfield;
  }
`}</style>
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-xl font-bold text-gray-800 md:text-2xl">
            Final IA Entry
          </h1>

          <p className="text-xs text-gray-500 md:text-sm">
            Enter marks directly or upload the Excel template.
          </p>
        </div>

        {returnedReason && status === "draft" && (
          <div className="mb-3 w-full rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
            <b>Sent back by the Exam Officer:</b> {returnedReason}
            <span className="block text-xs text-orange-700">Correct the sheet and click Submit again.</span>
          </div>
        )}

        <div>
          {status === "draft" && (
            <span className="rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700">
              Draft
            </span>
          )}

          {status === "submitted" && (
            <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
              Submitted
            </span>
          )}

          {status === "confirmed" && (
            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
              Confirmed
            </span>
          )}
        </div>

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {/* Academic Year (fixed – set by the Admin) */}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Academic Year
            </label>

            <div
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-800"
              title="The running academic year is set by the Admin"
            >
              {academicYear}
            </div>
          </div>

          {/* Semester */}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Semester
            </label>

            <select
              value={semester}
              onChange={(e) => {
                setSemester(
                  e.target.value
                );

                // batch follows from academic year + semester (can still be changed)
                setBatch(batchFor(academicYear, e.target.value));

                clearTable();
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">
                Select Semester
              </option>

              {[1, 2, 3, 4, 5, 6].map(
                (sem) => (
                  <option
                    key={sem}
                    value={sem}
                  >
                    Semester {sem}
                  </option>
                )
              )}
            </select>
          </div>

          {/* Batch */}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Batch
            </label>

            <select
              value={batch}
              onChange={(e) => {
                setBatch(
                  e.target.value
                );
                clearTable();
              }}
              disabled={!semester}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none disabled:bg-gray-100"
            >
              <option value="">
                Select Batch
              </option>

              <option value="2023-2026">
                2023-2026
              </option>

              <option value="2024-2027">
                2024-2027
              </option>

              <option value="2025-2028">
                2025-2028
              </option>

              <option value="2026-2029">
                2026-2029
              </option>
            </select>
          </div>

          {/* Load */}

          <div className="flex items-end">

            <button
              type="button"
              onClick={loadFinalIA}
              disabled={
                loading ||
                !semester ||
                !batch ||
                !isLoaded ||
                !isSignedIn
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading
                ? "Loading..."
                : "Load Students & Subjects"}
            </button>

          </div>

        </div>

      </div>

      {/* ======================================================
          MESSAGES
      ====================================================== */}

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
          {message}
        </div>
      )}

      {/* ======================================================
          SUMMARY + EXCEL
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              {/* SUMMARY */}

              <div className="flex flex-wrap gap-2">

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Students
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {studentCount}
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Subjects
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {subjectCount}
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Sem
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {semester}
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Batch
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {batch}
                  </span>
                </div>

              </div>

              {/* EXCEL */}

              <div className="flex flex-col gap-2 sm:flex-row">

                <button
                  type="button"
                  onClick={
                    downloadExcelTemplate
                  }
                  disabled={
                    status !== "draft"
                  }
                  className="rounded-lg border border-green-600 bg-white px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:border-gray-300 disabled:text-gray-400"
                >
                  ↓ Download Excel
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={
                    handleExcelUpload
                  }
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  disabled={
                    excelLoading ||
                    status !== "draft"
                  }
                  className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:bg-gray-300"
                >
                  {excelLoading
                    ? "Importing..."
                    : "↑ Upload Excel"}
                </button>

              </div>

            </div>

          </div>
        )}

      {/* ======================================================
          TABLE
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            {/* TABLE TITLE */}

            <div className="flex items-center justify-between border-b bg-white px-3 py-2">

              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Final IA Marks
                </h2>

                <p className="hidden text-[11px] text-gray-500 sm:block">
                  Student details remain visible while entering marks.
                </p>
              </div>

              <span className="text-[11px] text-gray-400">
                Scroll inside table →
              </span>

            </div>

            {/* ==================================================
                ONLY TABLE SCROLLS
            ================================================== */}

            <div className="max-h-[65vh] w-full overflow-auto">

              <table className="w-max min-w-full border-collapse text-xs">

                <thead>

                  {/* =================================================
                      SUBJECT HEADER
                  ================================================= */}

                  <tr className="bg-slate-800 text-white">

                    {/* SL */}

                    <th
                      className="sticky left-0 z-40 w-[45px] min-w-[45px] border-r border-slate-600 bg-slate-800 px-2 py-3 text-center"
                    >
                      Sl.
                    </th>

                    {/* STUDENT DETAILS */}

                    <th
                      className="sticky left-[45px] z-40 w-[245px] min-w-[245px] border-r border-slate-600 bg-slate-800 px-3 py-2 text-left"
                    >
                      Student Details
                    </th>

                    {/* SUBJECTS */}

                    {subjects.map(
                      (subject) => (
                        <th
                          key={
                            subject.subjectId
                          }
                          className="w-[115px] min-w-[115px] max-w-[115px] border-r border-slate-600 px-2 py-2 text-center"
                        >

                          <div className="text-xs font-bold">
                            {subject.code}
                          </div>

                          <div className="mt-1 line-clamp-2 text-[10px] font-normal leading-tight text-slate-300">
                            {subject.name}
                          </div>

                        </th>
                      )
                    )}

                  </tr>

                  {/* =================================================
                      MAX MARKS ROW
                  ================================================= */}

                  <tr className="bg-amber-50">

                    <th
                      className="sticky left-0 z-30 border-r border-amber-200 bg-amber-50"
                    />

                    <th
                      className="sticky left-[45px] z-30 border-r border-amber-200 bg-amber-50 px-3 py-2 text-right text-xs font-bold text-gray-700"
                    >
                      IA Marks
                    </th>

                    {subjects.map((subject) => (
                      <th
                        key={subject.subjectId}
                        className="w-[115px] min-w-[115px] border-r border-amber-200 bg-amber-50 px-1.5 py-1.5 text-center"
                      >
                        <div className="text-xs font-bold text-gray-800">
                          {subject.iaMin ?? "-"} – {subject.iaMax ?? "-"}
                        </div>

                        <div className="text-[9px] font-medium text-gray-500">
                          Min – Max
                        </div>
                      </th>
                    ))}

                  </tr>

                </thead>

                {/* ==================================================
                    STUDENT ROWS
                ================================================== */}

                <tbody>

                  {sortedStudents.map(
                    (
                      student,
                      index
                    ) => (

                      <tr
                        key={
                          student.studentId
                        }
                        className={
                          index % 2 === 0
                            ? "bg-white"
                            : "bg-slate-50"
                        }
                      >

                        {/* SL */}

                        <td
                          className={`sticky left-0 z-20 w-[45px] min-w-[45px] border-r border-b border-gray-200 bg-inherit px-1 text-center font-semibold text-gray-600`}
                        >
                          {index + 1}
                        </td>

                        {/* =================================================
                            COMBINED STUDENT DETAILS
                        ================================================= */}

                        <td
                          className={`sticky left-[45px] z-20 w-[245px] min-w-[245px] border-r border-b border-gray-200 bg-inherit px-2 py-1.5`}
                        >

                          <div className="flex items-center gap-2">

                            {/* PHOTO */}

                            {student.imageUrl ? (
                              <img
                                src={
                                  student.imageUrl
                                }
                                alt=""
                                className="h-9 w-9 flex-shrink-0 rounded-full border border-gray-300 object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500">
                                {student.studentName
                                  ?.charAt(
                                    0
                                  )
                                  ?.toUpperCase() ||
                                  "S"}
                              </div>
                            )}

                            {/* DETAILS */}

                            <div className="min-w-0">

                              <div className="truncate text-xs font-semibold text-gray-800">
                                {
                                  student.studentName
                                }
                              </div>



                              <div className="truncate text-[10px] text-gray-500">
                                Reg No: {student.registerNumber || "-"}
                              </div>

                              <div className="truncate text-[10px] text-gray-400">
                                {student.phone || "No phone"}
                              </div>

                            </div>

                          </div>

                        </td>

                        {/* =================================================
                            MARKS
                        ================================================= */}

                        {subjects.map(
                          (subject) => {
                            const mark =
                              getStudentMark(
                                student,
                                subject.subjectId
                              );

                            const min =
                              Number(subject.iaMin) || 0;

                            const max =
                              Number(subject.iaMax) || 0;

                            const numericMark =
                              mark === ""
                                ? null
                                : Number(mark);

                            // Highlight if mark is below minimum
                            // OR above maximum
                            const invalid =
                              mark !== "" &&
                              (
                                (min > 0 &&
                                  numericMark < min) ||
                                (max > 0 &&
                                  numericMark > max)
                              );

                            return (
                              <td
                                key={subject.subjectId}
                                className="w-[115px] min-w-[115px] border-r border-b border-gray-200 px-1.5 py-1.5"
                              >

                                <input
                                  type="number"
                                  min="0"
                                  max={
                                    max ||
                                    undefined
                                  }
                                  value={mark}
                                  onChange={(e) =>
                                    handleMarkChange(
                                      student.studentId,
                                      subject.subjectId,
                                      e.target.value
                                    )
                                  }
                                  disabled={
                                    status !== "draft"
                                  }

                                  className={`no-spinner h-8 w-full rounded-md border px-1 text-center text-sm outline-none ${invalid
                                      ? "border-red-500 bg-red-100 text-red-700 font-bold focus:border-red-600"
                                      : "border-gray-200 bg-white text-gray-800 focus:border-amber-500"
                                    } disabled:bg-gray-100`}

                                />

                              </td>
                            );
                          }
                        )}

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>

          </div>
        )}

      {/* ======================================================
          NO STUDENTS
      ====================================================== */}

      {!loading &&
        semester &&
        batch &&
        students.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">

            <div className="text-base font-semibold text-gray-700">
              No students found
            </div>

            <p className="mt-1 text-xs text-gray-500">
              No active students were found for the selected semester and batch.
            </p>

          </div>
        )}

      {/* ======================================================
          ACTION BUTTONS
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="mt-3 flex justify-end gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

            <button
              type="button"
              onClick={
                saveFinalIA
              }
              disabled={
                saving ||
                submitting ||
                status !== "draft"
              }
              className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {saving
                ? "Saving..."
                : "Save Final IA"}
            </button>

            <button
              type="button"
              onClick={
                submitFinalIA
              }
              disabled={
                saving ||
                submitting ||
                status !== "draft"
              }
              className="rounded-lg bg-green-600 px-5 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:bg-gray-300"
            >
              {submitting
                ? "Submitting..."
                : "Submit Final IA"}
            </button>

          </div>
        )}

    </div>
  );
}