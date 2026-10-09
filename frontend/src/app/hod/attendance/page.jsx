"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useAuth } from "@clerk/nextjs";
import { batchFor, currentAcademicYear } from "../../components/academicYear";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function AttendancePage() {
  const {
    getToken,
    isLoaded,
    isSignedIn,
  } = useAuth();

  const fileInputRef = useRef(null);

  // ============================================================
  // FILTERS
  // ============================================================

  const [academicYear, setAcademicYear] =
    useState(currentAcademicYear);

  const [semester, setSemester] =
    useState("");

  const [batch, setBatch] =
    useState("");

  // ============================================================
  // DATA
  // ============================================================

  const [subjects, setSubjects] =
    useState([]);

  const [students, setStudents] =
    useState([]);

  // ============================================================
  // STATES
  // ============================================================

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
  // LOAD ATTENDANCE
  // ============================================================

  const loadAttendance = async () => {
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
        "Please login before entering attendance."
      );

      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token =
        await getToken();

      if (!token) {
        setError(
          "Authentication token not available. Please login again."
        );

        return;
      }

      const response =
        await axios.get(
          `${API_URL}/api/final-attendance/prepare`,
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

      if (!data) {
        throw new Error(
          "Invalid response received from server."
        );
      }

      setSubjects(
        data.subjects || []
      );

      const sortedStudents = [...(data.students || [])].sort(
        (a, b) => {
          const rollCompare =
            String(a.rollNumber ?? "").localeCompare(
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

          const registerCompare =
            String(a.registerNumber ?? "").localeCompare(
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

      const sortedSubjects = [
        ...(data.subjects || []),
      ].sort(
        (a, b) => {
          const sequenceCompare =
            String(a.sequence ?? "").localeCompare(
              String(b.sequence ?? ""),
              undefined,
              {
                numeric: true,
                sensitivity: "base",
              }
            );

          if (sequenceCompare !== 0) {
            return sequenceCompare;
          }

          return String(
            a.code ?? ""
          ).localeCompare(
            String(b.code ?? ""),
            undefined,
            {
              numeric: true,
              sensitivity: "base",
            }
          );
        }
      );

      setStudents(sortedStudents);
      setSubjects(sortedSubjects);

      setStatus(
        data.status || "draft"
      );

      setReturnedReason(
        data.returnedReason || ""
      );
    } catch (err) {
      console.error(
        "Attendance Load Error:",
        err
      );

      setSubjects([]);
      setStudents([]);

      setError(
        err?.response?.data?.message ||
        err?.message ||
        "Failed to load attendance data."
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
  // MAXIMUM CLASSES CHANGE
  // ============================================================

  const handleMaxClassesChange = (
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
            ) ===
              String(subjectId)
              ? {
                ...subject,

                maxClasses:
                  value === ""
                    ? ""
                    : Number(value),
              }
              : subject
        )
    );
  };

  // ============================================================
  // ATTENDANCE CHANGE
  // ============================================================

  const handleAttendanceChange = (
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

              attendance:
                (
                  student.attendance ||
                  []
                ).map(
                  (item) =>
                    String(
                      item.subjectId
                    ) ===
                      String(subjectId)
                      ? {
                        ...item,

                        classesAttended:
                          value === ""
                            ? ""
                            : Number(
                              value
                            ),
                      }
                      : item
                ),
            };
          }
        )
    );
  };

  // ============================================================
  // GET ATTENDANCE VALUE
  // ============================================================

  const getAttendanceValue = (
    student,
    subjectId
  ) => {
    const item =
      (
        student.attendance ||
        []
      ).find(
        (attendance) =>
          String(
            attendance.subjectId
          ) ===
          String(subjectId)
      );

    if (
      item?.classesAttended ===
      null ||
      item?.classesAttended ===
      undefined
    ) {
      return "";
    }

    return item.classesAttended;
  };

  // ============================================================
  // CALCULATE PERCENTAGE
  // ============================================================

  const getAttendancePercentage = (
    student,
    subject
  ) => {
    const attended =
      getAttendanceValue(
        student,
        subject.subjectId
      );

    const maxClasses =
      Number(
        subject.maxClasses
      );

    if (
      attended === "" ||
      attended === null ||
      attended === undefined
    ) {
      return null;
    }

    if (
      !Number.isFinite(
        maxClasses
      ) ||
      maxClasses <= 0
    ) {
      return null;
    }

    const percentage =
      (Number(attended) /
        maxClasses) *
      100;

    return Number(
      percentage.toFixed(2)
    );
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

      // --------------------------------------------------------
      // MAXIMUM CLASSES
      // --------------------------------------------------------

      for (
        const subject of subjects
      ) {
        if (
          subject.maxClasses ===
          "" ||
          subject.maxClasses ===
          null ||
          subject.maxClasses ===
          undefined ||
          !Number.isFinite(
            Number(
              subject.maxClasses
            )
          ) ||
          Number(
            subject.maxClasses
          ) <= 0
        ) {
          return `Enter maximum classes for ${subject.code}.`;
        }
      }

      // --------------------------------------------------------
      // STUDENT ATTENDANCE
      // --------------------------------------------------------

      for (
        const student of students
      ) {
        for (
          const subject of subjects
        ) {
          const attended =
            getAttendanceValue(
              student,
              subject.subjectId
            );

          if (
            attended === "" ||
            attended === null ||
            attended === undefined
          ) {
            return `Enter attendance for ${student.studentName} - ${subject.code}.`;
          }

          const numericAttended =
            Number(attended);

          const maxClasses =
            Number(
              subject.maxClasses
            );

          if (
            !Number.isFinite(
              numericAttended
            )
          ) {
            return `Invalid attendance for ${student.studentName} - ${subject.code}.`;
          }

          if (
            numericAttended < 0
          ) {
            return `Classes attended cannot be negative for ${student.studentName} - ${subject.code}.`;
          }

          if (
            numericAttended >
            maxClasses
          ) {
            return `${student.studentName}: Classes attended cannot exceed ${maxClasses} for ${subject.code}.`;
          }
        }
      }

      return null;
    };

  // ============================================================
  // CREATE SAVE PAYLOAD
  // ============================================================

  const createSavePayload =
    () => {
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

              maxClasses:
                Number(
                  subject.maxClasses
                ),
            })
          ),

        students:
          students.map(
            (student) => ({
              studentId:
                student.studentId,

              attendance:
                subjects.map(
                  (subject) => ({
                    subjectId:
                      subject.subjectId,

                    classesAttended:
                      Number(
                        getAttendanceValue(
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
  // SAVE ATTENDANCE
  // ============================================================

  const saveAttendance =
    async () => {
      const validationError =
        validateBeforeSave();

      if (validationError) {
        setError(
          validationError
        );

        setMessage("");

        return;
      }

      if (!isSignedIn) {
        setError(
          "Please login before saving attendance."
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
            `${API_URL}/api/final-attendance/save`,
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
          "Attendance saved successfully."
        );
      } catch (err) {
        console.error(
          "Save Attendance Error:",
          err
        );

        setError(
          err?.response?.data?.message ||
          "Failed to save attendance."
        );
      } finally {
        setSaving(false);
      }
    };

  // ============================================================
  // SUBMIT ATTENDANCE
  // ============================================================

  const submitAttendance =
    async () => {
      const validationError =
        validateBeforeSave();

      if (validationError) {
        setError(
          validationError
        );

        setMessage("");

        return;
      }

      const confirmed =
        window.confirm(
          "Once attendance is submitted, it cannot be edited by the HOD.\n\nDo you want to submit attendance?"
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

        // ------------------------------------------------------
        // SAVE LATEST DATA FIRST
        // ------------------------------------------------------

        await axios.post(
          `${API_URL}/api/final-attendance/save`,
          createSavePayload(),
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        // ------------------------------------------------------
        // SUBMIT
        // ------------------------------------------------------

        const response =
          await axios.post(
            `${API_URL}/api/final-attendance/submit`,
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

        setStatus(
          "submitted"
        );

        setMessage(
          response.data?.message ||
          "Attendance submitted successfully."
        );
      } catch (err) {
        console.error(
          "Submit Attendance Error:",
          err
        );

        setError(
          err?.response?.data?.message ||
          "Failed to submit attendance."
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

        // ------------------------------------------------------
        // HEADER
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // MAXIMUM CLASSES
        // ------------------------------------------------------

        const maxRow = [
          "",
          "MAX",
          "Maximum Classes",
          "",
          "",

          ...subjects.map(
            (subject) =>
              subject.maxClasses ??
              ""
          ),
        ];

        // ------------------------------------------------------
        // STUDENTS
        // ------------------------------------------------------

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
                    const attended =
                      getAttendanceValue(
                        student,
                        subject.subjectId
                      );

                    return attended ===
                      ""
                      ? ""
                      : attended;
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

        // ------------------------------------------------------
        // COLUMN WIDTHS
        // ------------------------------------------------------

        worksheet["!cols"] = [
          {
            wch: 7,
          },

          {
            wch: 18,
          },

          {
            wch: 26,
          },

          {
            wch: 15,
          },

          {
            wch: 40,
          },

          ...subjects.map(
            () => ({
              wch: 12,
            })
          ),
        ];

        // ------------------------------------------------------
        // FREEZE
        // ------------------------------------------------------

        worksheet["!freeze"] = {
          xSplit: 5,
          ySplit: 2,
        };

        const workbook =
          XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Attendance"
        );

        const filename =
          `Attendance_${academicYear}_Sem${semester}_${batch}.xlsx`;

        XLSX.writeFile(
          workbook,
          filename
        );

        setMessage(
          "Excel attendance template downloaded successfully."
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

        // ------------------------------------------------------
        // HEADER
        // ------------------------------------------------------

        const headerRow =
          rows[0];

        const maxRow =
          rows[1];

        // ------------------------------------------------------
        // REGISTER NUMBER COLUMN
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // SUBJECT COLUMNS
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // CHECK SUBJECTS
        // ------------------------------------------------------

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

        // ------------------------------------------------------
        // MAXIMUM CLASSES
        // ------------------------------------------------------

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

                    maxClasses:
                      numericMax,
                  };
                }
              }

              return subject;
            }
          );

        // ------------------------------------------------------
        // STUDENT MAP
        // ------------------------------------------------------

        const studentMap =
          {};

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

        // ------------------------------------------------------
        // COPY STUDENTS
        // ------------------------------------------------------

        const updatedStudents =
          students.map(
            (student) => ({
              ...student,

              attendance:
                (
                  student.attendance ||
                  []
                ).map(
                  (item) => ({
                    ...item,
                  })
                ),
            })
          );

        let importedCount =
          0;

        let skippedCount =
          0;

        // ------------------------------------------------------
        // READ EXCEL STUDENTS
        // ------------------------------------------------------

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

          // ----------------------------------------------------
          // SUBJECT ATTENDANCE
          // ----------------------------------------------------

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

              const numericValue =
                Number(value);

              if (
                !Number.isFinite(
                  numericValue
                )
              ) {
                return;
              }

              const attendance =
                updatedStudents[
                  studentIndex
                ].attendance || [];

              const attendanceIndex =
                attendance.findIndex(
                  (item) =>
                    String(
                      item.subjectId
                    ) ===
                    String(
                      subject.subjectId
                    )
                );

              if (
                attendanceIndex !==
                -1
              ) {
                attendance[
                  attendanceIndex
                ] = {
                  ...attendance[
                  attendanceIndex
                  ],

                  classesAttended:
                    numericValue,
                };
              } else {
                attendance.push({
                  subjectId:
                    subject.subjectId,

                  classesAttended:
                    numericValue,
                });
              }

              updatedStudents[
                studentIndex
              ].attendance =
                attendance;
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
  // AUTOMATIC LOAD
  // ============================================================

  useEffect(() => {
    if (
      isLoaded &&
      isSignedIn &&
      semester &&
      batch
    ) {
      loadAttendance();
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
    <div className="min-h-screen w-full overflow-x-hidden bg-white p-3 md:p-5">


<style jsx>{`
  /* Hide number input spinner - Chrome / Edge / Safari */
  input.no-spinner::-webkit-outer-spin-button,
  input.no-spinner::-webkit-inner-spin-button {
    -webkit-appearance: none !important;
    appearance: none !important;
    display: none !important;
    margin: 0 !important;
  }

  /* Hide number input spinner - Firefox */
  input.no-spinner {
    -moz-appearance: textfield !important;
    appearance: textfield !important;
  }
`}</style>

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-xl font-bold text-gray-800 md:text-2xl">
            Attendance Entry
          </h1>

          <p className="text-xs text-gray-500 md:text-sm">
            Enter classes attended or upload the Excel template.
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
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
              Draft
            </span>
          )}

          {status === "submitted" && (
            <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
              Submitted
            </span>
          )}

          {status === "confirmed" && (
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
              Confirmed
            </span>
          )}
        </div>

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="mb-4 rounded-xl border border-amber-200 bg-white p-3 shadow-sm">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {/* Academic Year */}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Academic Year
            </label>

            <select
              value={academicYear}
              onChange={(e) => {
                setAcademicYear(
                  e.target.value
                );
                if (semester) setBatch(batchFor(e.target.value, semester));

                clearTable();
              }}
              className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
            >
              <option value="2025-26">
                2025-26
              </option>

              <option value="2026-27">
                2026-27
              </option>

              <option value="2027-28">
                2027-28
              </option>
            </select>
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
              className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm outline-none focus:border-amber-500"
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
              className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm outline-none disabled:bg-gray-100"
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
              onClick={
                loadAttendance
              }
              disabled={
                loading ||
                !semester ||
                !batch ||
                !isLoaded ||
                !isSignedIn
              }
              className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:bg-gray-300"
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
        <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-amber-700">
          {message}
        </div>
      )}

      {/* ======================================================
          SUMMARY + EXCEL
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="mb-3 rounded-xl border border-amber-200 bg-white p-3 shadow-sm">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              {/* SUMMARY */}

              <div className="flex flex-wrap gap-2">

                <div className="rounded-lg bg-white px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Students
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {studentCount}
                  </span>
                </div>

                <div className="rounded-lg bg-white px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Subjects
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {subjectCount}
                  </span>
                </div>

                <div className="rounded-lg bg-white px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Sem
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {semester}
                  </span>
                </div>

                <div className="rounded-lg bg-white px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Batch
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {batch}
                  </span>
                </div>

              </div>

              {/* EXCEL BUTTONS */}

              <div className="flex flex-col gap-2 sm:flex-row">

                <button
                  type="button"
                  onClick={
                    downloadExcelTemplate
                  }
                  disabled={
                    status !== "draft"
                  }
                  className="rounded-lg border border-amber-600 bg-white px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:border-amber-300 disabled:text-gray-400"
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
                  className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:bg-gray-300"
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
          ATTENDANCE TABLE
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="w-full overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">

            {/* TABLE HEADER */}

            <div className="flex items-center justify-between border-b bg-white px-3 py-2">

              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Attendance
                </h2>

                <p className="hidden text-[11px] text-gray-500 sm:block">
                  Enter classes attended for each subject.
                </p>
              </div>

              <span className="text-[11px] text-gray-400">
                Scroll inside table →
              </span>

            </div>

            {/* ==================================================
                TABLE SCROLL AREA
            ================================================== */}

            <div className="max-h-[65vh] w-full overflow-auto">

              <table className="w-max min-w-full border-collapse text-xs">

                <thead>

                  {/* =================================================
                      SUBJECT HEADER
                  ================================================= */}

                  <tr className="bg-amber-600 text-white">

                    {/* SL */}

                    <th className="sticky left-0 z-40 w-[45px] min-w-[45px] border-r border-amber-500 bg-amber-600 px-2 py-3 text-center">
                      Sl.
                    </th>

                    {/* STUDENT DETAILS */}

                    <th className="sticky left-[45px] z-40 w-[245px] min-w-[245px] border-r border-amber-500 bg-amber-600 px-3 py-2 text-left">
                      Student Details
                    </th>

                    {/* SUBJECTS */}

                    {subjects.map(
                      (subject) => (
                        <th
                          key={
                            subject.subjectId
                          }
                          className="w-[115px] min-w-[115px] max-w-[115px] border-r border-amber-500 px-2 py-2 text-center"
                        >

                          <div className="text-xs font-bold">
                            {subject.code}
                          </div>

                          <div className="mt-1 line-clamp-2 text-[10px] font-normal leading-tight text-amber-50">
                            {subject.name}
                          </div>

                        </th>
                      )
                    )}

                  </tr>

                  {/* =================================================
                      MAXIMUM CLASSES ROW
                  ================================================= */}

                  <tr className="bg-amber-50">

                    <th className="sticky left-0 z-30 border-r border-amber-200 bg-amber-50" />

                    <th className="sticky left-[45px] z-30 border-r border-amber-200 bg-amber-50 px-3 py-2 text-right text-xs font-bold text-gray-700">
                      Maximum Classes
                    </th>

                    {subjects.map(
                      (subject) => (
                        <th
                          key={
                            subject.subjectId
                          }
                          className="w-[115px] min-w-[115px] border-r border-amber-200 bg-amber-50 px-1.5 py-1.5"
                        >

                          <input
                            type="number"
                            min="1"
                            value={
                              subject.maxClasses ??
                              ""
                            }
                            onChange={(e) =>
                              handleMaxClassesChange(
                                subject.subjectId,
                                e.target.value
                              )
                            }
                            disabled={
                              status !==
                              "draft"
                            }
                            className="no-spinner h-8 w-full rounded-md border border-amber-300 bg-white px-1 text-center text-sm font-bold text-gray-800 outline-none focus:border-amber-500 disabled:bg-gray-100"
                            placeholder="Max"
                          />

                        </th>
                      )
                    )}

                  </tr>

                </thead>

                {/* ==================================================
                    STUDENT ROWS
                ================================================== */}

                <tbody>

                  {students.map(
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
                            : "bg-amber-50"
                        }
                      >

                        {/* SL */}

                        <td className="sticky left-0 z-20 w-[45px] min-w-[45px] border-r border-b border-amber-200 bg-inherit px-1 text-center font-semibold text-gray-600">
                          {index + 1}
                        </td>

                        {/* =================================================
                            STUDENT DETAILS
                        ================================================= */}

                        <td className="sticky left-[45px] z-20 w-[245px] min-w-[245px] border-r border-b border-amber-200 bg-inherit px-2 py-1.5">

                          <div className="flex items-center gap-2">

                            {/* PHOTO */}

                            {student.imageUrl ? (
                              <img
                                src={
                                  student.imageUrl
                                }
                                alt=""
                                className="h-9 w-9 flex-shrink-0 rounded-full border border-amber-300 object-cover"
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

                              <div className="mt-0.5 truncate text-[10px] text-gray-500">
                                {
                                  student.registerNumber
                                }
                              </div>

                              <div className="truncate text-[10px] text-gray-400">
                                {student.phone ||
                                  "No phone"}
                              </div>

                            </div>

                          </div>

                        </td>

                        {/* =================================================
                            ATTENDANCE CELLS
                        ================================================= */}

                        {subjects.map(
                          (subject) => {

                            const attended =
                              getAttendanceValue(
                                student,
                                subject.subjectId
                              );

                            const percentage =
                              getAttendancePercentage(
                                student,
                                subject
                              );

                            const max =
                              Number(
                                subject.maxClasses
                              ) || 0;

                            const invalid =
                              attended !==
                              "" &&
                              max > 0 &&
                              Number(
                                attended
                              ) > max;

                            return (
                              <td
                                key={
                                  subject.subjectId
                                }
                                className={`w-[115px] min-w-[115px] border-r border-b border-amber-200 px-1.5 py-1.5 ${percentage !== null &&
                                    percentage < 75
                                    ? "bg-red-50"
                                    : ""
                                  }`}
                              >

                                <input
                                  type="number"
                                  min="0"
                                  max={
                                    max ||
                                    undefined
                                  }
                                  value={
                                    attended
                                  }
                                  onChange={(e) =>
                                    handleAttendanceChange(
                                      student.studentId,
                                      subject.subjectId,
                                      e.target.value
                                    )
                                  }
                                  disabled={
                                    status !==
                                    "draft"
                                  }
                                  className={`no-spinner h-8 w-full rounded-md border px-1 text-center text-sm outline-none ${invalid ||
                                      (percentage !== null &&
                                        percentage < 75)
                                      ? "border-red-500 bg-red-100 text-red-700 font-semibold focus:border-red-500"
                                      : "border-amber-200 bg-white focus:border-amber-500"
                                    } disabled:bg-gray-100`}
                                  placeholder="0"
                                />

                                {/* PERCENTAGE */}

                             
{percentage !== null && (
  <div
    className={`mt-1 text-center text-[10px] font-semibold ${
      percentage < 75
        ? "rounded bg-red-100 px-1 py-0.5 text-red-700"
        : "text-green-600"
    }`}
  >
    {percentage}%
  </div>
)}

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

          <div className="rounded-xl border border-amber-200 bg-white p-8 text-center shadow-sm">

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

          <div className="mt-3 flex justify-end gap-2 rounded-xl border border-amber-200 bg-white p-3 shadow-sm">

            <button
              type="button"
              onClick={
                saveAttendance
              }
              disabled={
                saving ||
                submitting ||
                status !== "draft"
              }
              className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:bg-gray-300"
            >
              {saving
                ? "Saving..."
                : "Save Attendance"}
            </button>

            <button
              type="button"
              onClick={
                submitAttendance
              }
              disabled={
                saving ||
                submitting ||
                status !== "draft"
              }
              className="rounded-lg bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:bg-gray-300"
            >
              {submitting
                ? "Submitting..."
                : "Submit Attendance"}
            </button>

          </div>
        )}

    </div>
  );
}