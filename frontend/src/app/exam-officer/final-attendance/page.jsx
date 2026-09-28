"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================================
// DEPARTMENTS
// ============================================================

const DEPARTMENTS = [
  {
    value: "cse",
    label: "Computer Science & Engineering",
  },
  {
    value: "ece",
    label: "Electronics & Communication Engineering",
  },
  {
    value: "eee",
    label: "Electrical & Electronics Engineering",
  },
  {
    value: "me",
    label: "Mechanical Engineering",
  },
  {
    value: "ce",
    label: "Civil Engineering",
  },
];

// ============================================================
// PAGE
// ============================================================

export default function ExamOfficerFinalAttendancePage() {
  const {
    getToken,
    isLoaded,
    isSignedIn,
  } = useAuth();

  // ============================================================
  // FILTERS
  // ============================================================

  const [academicYear, setAcademicYear] =
    useState("2025-26");

  const [department, setDepartment] =
    useState("");

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

  const [status, setStatus] =
    useState(null);

  // ============================================================
  // LOADING
  // ============================================================

  const [loading, setLoading] =
    useState(false);

  const [freezing, setFreezing] =
    useState(false);

  const [returning, setReturning] =
    useState(false);

  // ============================================================
  // MESSAGES
  // ============================================================

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  // ============================================================
  // CORRECTION MODAL
  // ============================================================

  const [showCorrectionModal, setShowCorrectionModal] =
    useState(false);

  const [correctionReason, setCorrectionReason] =
    useState("");

  // ============================================================
  // LOAD ATTENDANCE
  // ============================================================

  const loadAttendance = async () => {
    if (
      !academicYear ||
      !department ||
      !semester ||
      !batch
    ) {
      setError(
        "Please select Academic Year, Department, Semester and Batch."
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
        "Please login before accessing Attendance review."
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
        `${API_URL}/api/final-attendance/get`,
        {
          params: {
            academicYear,
            department,
            semester,
            batch,
          },

          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (
        response.data?.exists &&
        response.data?.data
      ) {
        const data =
          response.data.data;

        setSubjects(
          data.subjects || []
        );

        setStudents(
          data.students || []
        );

        setStatus(
          data.status || "draft"
        );
      } else {
        setSubjects([]);

        setStudents([]);

        setStatus(null);

        setMessage(
          "No Attendance record found for the selected details."
        );
      }
    } catch (err) {
      console.error(
        "Attendance Load Error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to load Attendance record."
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // GET ATTENDANCE VALUE
  // ============================================================

  const getAttendanceValue = (
    student,
    subjectId
  ) => {
    const item = (
      student.attendance || []
    ).find(
      (attendance) =>
        String(
          attendance.subjectId
        ) === String(subjectId)
    );

    if (
      item?.classesAttended === null ||
      item?.classesAttended === undefined
    ) {
      return "";
    }

    return item.classesAttended;
  };

  // ============================================================
  // GET ATTENDANCE PERCENTAGE
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
      Number(subject.maxClasses);

    if (
      attended === "" ||
      maxClasses <= 0
    ) {
      return null;
    }

    return Number(
      (
        (Number(attended) /
          maxClasses) *
        100
      ).toFixed(2)
    );
  };

  // ============================================================
  // RESET
  // ============================================================

  const resetRecord = () => {
    setSubjects([]);

    setStudents([]);

    setStatus(null);

    setError("");

    setMessage("");
  };

  // ============================================================
  // FREEZE ATTENDANCE
  // ============================================================

  const freezeAttendance = async () => {
    if (!department) {
      setError(
        "Please select a department."
      );

      return;
    }

    if (status !== "submitted") {
      setError(
        "Only submitted Attendance records can be frozen."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Are you sure you want to freeze Attendance for ${department.toUpperCase()}, Semester ${semester}, Batch ${batch}?\n\nAfter freezing, the HOD will not be able to edit it.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setFreezing(true);

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
          `${API_URL}/api/final-attendance/confirm`,
          {
            academicYear,

            department,

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

      setStatus("confirmed");

      setMessage(
        response.data?.message ||
          "Attendance has been frozen successfully."
      );
    } catch (err) {
      console.error(
        "Freeze Attendance Error:",
        err
      );

      setError(
        err?.response?.data?.message ||
          "Failed to freeze Attendance."
      );
    } finally {
      setFreezing(false);
    }
  };

  // ============================================================
  // OPEN CORRECTION MODAL
  // ============================================================

  const openCorrectionModal =
    () => {
      if (status !== "submitted") {
        setError(
          "Only submitted Attendance records can be returned for correction."
        );

        return;
      }

      setCorrectionReason("");

      setShowCorrectionModal(true);
    };

  // ============================================================
  // RETURN ATTENDANCE FOR CORRECTION
  // ============================================================

  const returnForCorrection =
    async () => {
      if (!correctionReason.trim()) {
        setError(
          "Please enter the reason for correction."
        );

        return;
      }

      try {
        setReturning(true);

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
            `${API_URL}/api/final-attendance/return-for-correction`,
            {
              academicYear,

              department,

              semester:
                Number(semester),

              batch,

              reason:
                correctionReason.trim(),
            },
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        setStatus(
          "correction_required"
        );

        setShowCorrectionModal(
          false
        );

        setMessage(
          response.data?.message ||
            "Attendance has been returned to the HOD for correction."
        );
      } catch (err) {
        console.error(
          "Return Attendance Error:",
          err
        );

        setError(
          err?.response?.data?.message ||
            "Failed to return Attendance for correction."
        );
      } finally {
        setReturning(false);
      }
    };

  // ============================================================
  // STATUS BADGE
  // ============================================================

  const renderStatus = (
    currentStatus
  ) => {
    if (!currentStatus) {
      return (
        <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
          Not Available
        </span>
      );
    }

    if (
      currentStatus === "draft"
    ) {
      return (
        <span className="rounded-full bg-yellow-100 px-3 py-1.5 text-xs font-semibold text-yellow-700">
          Draft
        </span>
      );
    }

    if (
      currentStatus === "submitted"
    ) {
      return (
        <span className="rounded-full bg-blue-100 px-3 py-1.5 text-xs font-semibold text-blue-700">
          Submitted
        </span>
      );
    }

    if (
      currentStatus ===
      "correction_required"
    ) {
      return (
        <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-700">
          Correction Required
        </span>
      );
    }

    if (
      currentStatus === "confirmed"
    ) {
      return (
        <span className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
          Frozen
        </span>
      );
    }

    return (
      <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
        {currentStatus}
      </span>
    );
  };

  // ============================================================
  // RESET WHEN FILTER CHANGES
  // ============================================================

  useEffect(() => {
    resetRecord();
  }, [
    academicYear,
    department,
    semester,
    batch,
  ]);

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-gray-50 p-3 md:p-5">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <h1 className="text-xl font-bold text-gray-800 md:text-2xl">
            Final Attendance
          </h1>

          <p className="text-xs text-gray-500 md:text-sm">
            Review and freeze final student attendance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {renderStatus(status)}
        </div>

      </div>

      {/* ======================================================
          FILTERS
      ====================================================== */}

      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">

          {/* Academic Year */}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Academic Year
            </label>

            <select
              value={academicYear}
              onChange={(e) =>
                setAcademicYear(
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
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

          {/* Department */}

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Department
            </label>

            <select
              value={department}
              onChange={(e) =>
                setDepartment(
                  e.target.value
                )
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">
                Select Department
              </option>

              {DEPARTMENTS.map(
                (item) => (
                  <option
                    key={item.value}
                    value={item.value}
                  >
                    {item.label}
                  </option>
                )
              )}
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

                setBatch("");
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
              onChange={(e) =>
                setBatch(
                  e.target.value
                )
              }
              disabled={!semester}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none disabled:bg-gray-100 focus:border-blue-500"
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

          {/* LOAD */}

          <div className="flex items-end">

            <button
              type="button"
              onClick={
                loadAttendance
              }
              disabled={
                loading ||
                !department ||
                !semester ||
                !batch ||
                !isLoaded ||
                !isSignedIn
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading
                ? "Loading..."
                : "Load Attendance"}
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
          SUMMARY
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex flex-wrap gap-2">

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Department
                  </span>

                  <span className="ml-1.5 text-sm font-bold uppercase text-gray-800">
                    {department}
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Students
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {students.length}
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Subjects
                  </span>

                  <span className="ml-1.5 text-sm font-bold text-gray-800">
                    {subjects.length}
                  </span>
                </div>

                <div className="rounded-lg bg-gray-50 px-3 py-1.5">
                  <span className="text-[11px] text-gray-500">
                    Semester
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

              <div>
                {renderStatus(
                  status
                )}
              </div>

            </div>

          </div>
        )}

      {/* ======================================================
          NO RECORD
      ====================================================== */}

      {!loading &&
        department &&
        semester &&
        batch &&
        students.length === 0 && (

          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">

            <div className="text-base font-semibold text-gray-700">
              No Attendance record found
            </div>

            <p className="mt-1 text-xs text-gray-500">
              The selected department, semester and batch does not have a Final Attendance record for review.
            </p>

          </div>
        )}

      {/* ======================================================
          ATTENDANCE TABLE
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

            {/* TABLE HEADER */}

            <div className="flex items-center justify-between border-b bg-white px-3 py-2">

              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  Final Attendance Review
                </h2>

                <p className="hidden text-[11px] text-gray-500 sm:block">
                  Read-only review before freezing.
                </p>
              </div>

              <span className="text-[11px] text-gray-400">
                Scroll inside table →
              </span>

            </div>

            {/* TABLE */}

            <div className="max-h-[65vh] w-full overflow-auto">

              <table className="w-max min-w-full border-collapse text-xs">

                <thead>

                  {/* SUBJECT HEADER */}

                  <tr className="bg-slate-800 text-white">

                    <th className="sticky left-0 z-40 w-[45px] min-w-[45px] border-r border-slate-600 bg-slate-800 px-2 py-3 text-center">
                      Sl.
                    </th>

                    <th className="sticky left-[45px] z-40 w-[245px] min-w-[245px] border-r border-slate-600 bg-slate-800 px-3 py-2 text-left">
                      Student Details
                    </th>

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

                  {/* MAXIMUM CLASSES */}

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
                          className="w-[115px] min-w-[115px] border-r border-amber-200 bg-amber-50 px-1.5 py-2 text-center"
                        >

                          <span className="text-sm font-bold text-gray-800">
                            {subject.maxClasses ??
                              "-"}
                          </span>

                        </th>
                      )
                    )}

                  </tr>

                </thead>

                {/* STUDENTS */}

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
                            : "bg-slate-50"
                        }
                      >

                        {/* SL */}

                        <td className="sticky left-0 z-20 w-[45px] min-w-[45px] border-r border-b border-gray-200 bg-inherit px-1 text-center font-semibold text-gray-600">
                          {index + 1}
                        </td>

                        {/* STUDENT */}

                        <td className="sticky left-[45px] z-20 w-[245px] min-w-[245px] border-r border-b border-gray-200 bg-inherit px-2 py-1.5">

                          <div className="flex items-center gap-2">

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
                                {
                                  student.phone ||
                                  "No phone"
                                }
                              </div>

                            </div>

                          </div>

                        </td>

                        {/* ATTENDANCE */}

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

                            return (
                              <td
                                key={
                                  subject.subjectId
                                }
                                className="w-[115px] min-w-[115px] border-r border-b border-gray-200 px-1.5 py-1.5"
                              >

                                <div className="rounded-md bg-gray-50 px-2 py-1.5 text-center text-sm font-semibold text-gray-800">
                                  {attended ===
                                  ""
                                    ? "-"
                                    : attended}
                                </div>

                                <div
                                  className={`mt-1 text-center text-[10px] font-semibold ${
                                    percentage ===
                                    null
                                      ? "text-gray-400"
                                      : percentage <
                                          75
                                        ? "text-red-600"
                                        : "text-green-600"
                                  }`}
                                >
                                  {percentage ===
                                  null
                                    ? "--"
                                    : `${percentage}%`}
                                </div>

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
          ACTION BUTTONS
      ====================================================== */}

      {students.length > 0 &&
        subjects.length > 0 && (

          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between">

            {/* STATUS INFORMATION */}

            <div className="text-xs text-gray-500">

              {status ===
                "submitted" && (
                <span>
                  HOD has submitted this Attendance record. It is ready for review.
                </span>
              )}

              {status ===
                "confirmed" && (
                <span className="font-semibold text-green-700">
                  Attendance is frozen. No further HOD editing is allowed.
                </span>
              )}

              {status ===
                "correction_required" && (
                <span className="font-semibold text-orange-700">
                  Attendance has been returned to the HOD for correction.
                </span>
              )}

              {status ===
                "draft" && (
                <span>
                  Attendance has not yet been submitted by the HOD.
                </span>
              )}

            </div>

            {/* BUTTONS */}

            <div className="flex flex-col gap-2 sm:flex-row">

              {/* RETURN */}

              <button
                type="button"
                onClick={
                  openCorrectionModal
                }
                disabled={
                  returning ||
                  freezing ||
                  status !==
                    "submitted"
                }
                className="rounded-lg border border-orange-500 bg-white px-5 py-2 text-xs font-semibold text-orange-600 hover:bg-orange-50 disabled:border-gray-300 disabled:text-gray-400"
              >
                Return for Correction
              </button>

              {/* FREEZE */}

              <button
                type="button"
                onClick={
                  freezeAttendance
                }
                disabled={
                  freezing ||
                  returning ||
                  status !==
                    "submitted"
                }
                className="rounded-lg bg-green-600 px-6 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:bg-gray-300"
              >
                {freezing
                  ? "Freezing..."
                  : "Freeze Attendance"}
              </button>

            </div>

          </div>
        )}

      {/* ======================================================
          CORRECTION MODAL
      ====================================================== */}

      {showCorrectionModal && (

        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="border-b px-5 py-4">

              <h2 className="text-base font-bold text-gray-800">
                Return Attendance for Correction
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                The HOD will be allowed to edit the Attendance again.
              </p>

            </div>

            {/* DETAILS */}

            <div className="space-y-3 p-5">

              <div className="grid grid-cols-2 gap-2 text-xs">

                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-gray-500">
                    Academic Year
                  </div>

                  <div className="font-semibold text-gray-800">
                    {academicYear}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-gray-500">
                    Department
                  </div>

                  <div className="font-semibold uppercase text-gray-800">
                    {department}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-gray-500">
                    Semester
                  </div>

                  <div className="font-semibold text-gray-800">
                    {semester}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-2">
                  <div className="text-gray-500">
                    Batch
                  </div>

                  <div className="font-semibold text-gray-800">
                    {batch}
                  </div>
                </div>

              </div>

              {/* REASON */}

              <div>

                <label className="mb-1 block text-xs font-semibold text-gray-700">
                  Reason for Correction
                </label>

                <textarea
                  value={
                    correctionReason
                  }
                  onChange={(e) =>
                    setCorrectionReason(
                      e.target.value
                    )
                  }
                  rows={5}
                  placeholder="Enter the details that need to be corrected..."
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-orange-500"
                />

              </div>

            </div>

            {/* BUTTONS */}

            <div className="flex justify-end gap-2 border-t bg-gray-50 px-5 py-3">

              <button
                type="button"
                onClick={() =>
                  setShowCorrectionModal(
                    false
                  )
                }
                disabled={returning}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  returnForCorrection
                }
                disabled={
                  returning ||
                  !correctionReason.trim()
                }
                className="rounded-lg bg-orange-600 px-5 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:bg-gray-300"
              >
                {returning
                  ? "Sending..."
                  : "Send to HOD"}
              </button>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}