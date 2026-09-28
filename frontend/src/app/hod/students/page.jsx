"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useAuth } from "@clerk/nextjs";
import {
  Search,
  Download,
  RefreshCw,
  Users,
  Filter,
  X,
  ChevronDown,
  GraduationCap,
  CalendarDays,
  Layers,
  UserRound,
} from "lucide-react";

export default function HODStudentsPage() {
  const { getToken } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("");
  const [batch, setBatch] = useState("");
  const [admissionYear, setAdmissionYear] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/students`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        response.data?.data ||
        response.data?.students ||
        response.data ||
        [];

      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Student fetch error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load student details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const semesters = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => student.semester)
          .filter(
            (value) =>
              value !== undefined &&
              value !== null &&
              value !== ""
          )
      ),
    ].sort((a, b) => Number(a) - Number(b));
  }, [students]);

  const batches = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => student.batch)
          .filter(Boolean)
      ),
    ].sort();
  }, [students]);

  const admissionYears = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => student.admissionYear)
          .filter(Boolean)
      ),
    ].sort((a, b) => Number(b) - Number(a));
  }, [students]);

  const statuses = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => student.status)
          .filter(Boolean)
      ),
    ].sort();
  }, [students]);

  const compareNatural = (a, b) =>
    String(a ?? "").localeCompare(String(b ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });

  const filteredStudents = useMemo(() => {
    let result = [...students];

    if (search.trim()) {
      const q = search.toLowerCase().trim();

      result = result.filter((student) =>
        [
          student.name,
          student.registerNumber,
          student.email,
          student.phone,
          student.fatherName,
          student.motherName,
          student.satsNumber,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(q)
          )
      );
    }

    if (semester) {
      result = result.filter(
        (student) =>
          String(student.semester) === String(semester)
      );
    }

    if (batch) {
      result = result.filter(
        (student) =>
          String(student.batch || "") === String(batch)
      );
    }

    if (admissionYear) {
      result = result.filter(
        (student) =>
          String(student.admissionYear || "") ===
          String(admissionYear)
      );
    }

    if (status) {
      result = result.filter(
        (student) =>
          String(student.status || "") === status
      );
    }

    result.sort((a, b) => {
      const registerCompare = compareNatural(
        a.registerNumber,
        b.registerNumber
      );

      if (registerCompare !== 0) {
        return registerCompare;
      }

      return compareNatural(
        a.rollNumber,
        b.rollNumber
      );
    });

    return result;
  }, [
    students,
    search,
    semester,
    batch,
    admissionYear,
    status,
    sortBy,
  ]);

  const clearFilters = () => {
    setSearch("");
    setSemester("");
    setBatch("");
    setAdmissionYear("");
    setStatus("");
    setSortBy("name");
  };

  const downloadExcel = () => {
    if (!filteredStudents.length) return;

    const excelData = filteredStudents.map(
      (student, index) => ({
        "Sl. No.": index + 1,
        "Register Number":
          student.registerNumber || "",
        "Student Name":
          student.name || "",
        "Father Name":
          student.fatherName || "",
        "Mother Name":
          student.motherName || "",
        "Semester":
          student.semester || "",
        "Batch":
          student.batch || "",
        "Admission Year":
          student.admissionYear || "",
        "Gender":
          student.gender || "",
        "Email":
          student.email || "",
        "Phone":
          student.phone || "",
        "Status":
          student.status || "",
      })
    );

    const worksheet =
      XLSX.utils.json_to_sheet(excelData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 30 },
      { wch: 28 },
      { wch: 28 },
      { wch: 12 },
      { wch: 18 },
      { wch: 15 },
      { wch: 15 },
      { wch: 32 },
      { wch: 18 },
      { wch: 15 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students"
    );

    XLSX.writeFile(
      workbook,
      `HOD_Student_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="min-h-screen bg-amber-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
              <GraduationCap size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Students
              </h1>

              <p className="text-sm text-amber-700">
                Students belonging to the department
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchStudents}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-amber-50 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>

            <button
              onClick={downloadExcel}
              disabled={!filteredStudents.length}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            >
              <Download size={17} />
              Excel
            </button>
          </div>
        </div>

   

        {/* FILTERS */}
        <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Filter size={17} className="text-amber-700" />

            <span className="text-sm font-semibold text-gray-700">
              Student Filters
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">

            <div className="relative lg:col-span-2">
              <Search
                size={18}
                className="absolute left-3 top-3 text-gray-500"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search name, register no..."
                className="w-full rounded-xl border border-amber-200 bg-amber-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />
            </div>

            <select
              value={semester}
              onChange={(e) =>
                setSemester(e.target.value)
              }
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="">
                All Semesters
              </option>

              {semesters.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  Semester {item}
                </option>
              ))}
            </select>

            <select
              value={batch}
              onChange={(e) =>
                setBatch(e.target.value)
              }
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="">
                All Batches
              </option>

              {batches.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

            <select
              value={admissionYear}
              onChange={(e) =>
                setAdmissionYear(e.target.value)
              }
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="">
                Admission Year
              </option>

              {admissionYears.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value)
              }
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="name">
                Sort: Name
              </option>

              <option value="registerNumber">
                Sort: Register No.
              </option>

              <option value="semester">
                Sort: Semester
              </option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
              className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-600 outline-none"
            >
              <option value="">
                All Status
              </option>

              {statuses.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-amber-50"
            >
              <X size={14} />
              Clear Filters
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">

          <div className="border-b border-amber-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Student List
            </h2>

            <p className="mt-1 text-xs text-amber-700">
              Showing {filteredStudents.length} of{" "}
              {students.length} students
            </p>
          </div>

          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw
                size={28}
                className="animate-spin text-amber-600"
              />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center">
              <GraduationCap
                size={40}
                className="mb-3 text-amber-300"
              />

              <p className="font-medium text-gray-700">
                No students found
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Try changing the filters.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-amber-50 text-xs uppercase text-amber-700">
                    <tr>
                      <th className="px-5 py-3">
                        #
                      </th>

                      <th className="px-5 py-3">
                        Student
                      </th>

                      <th className="px-5 py-3">
                        Register No.
                      </th>

                      <th className="px-5 py-3">
                        Semester
                      </th>

                      <th className="px-5 py-3">
                        Batch
                      </th>

                      <th className="px-5 py-3">
                        Admission
                      </th>

                      <th className="px-5 py-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-amber-100">
                    {filteredStudents.map(
                      (student, index) => (
                        <tr
                          key={
                            student._id ||
                            student.id ||
                            index
                          }
                          className="hover:bg-amber-50"
                        >
                          <td className="px-5 py-4 text-amber-700">
                            {index + 1}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
  {student.imageUrl ? (
    <img
      src={student.imageUrl}
      alt={student.name || "Student"}
      className="h-10 w-10 rounded-full object-cover border border-amber-200"
      onError={(e) => {
        e.currentTarget.style.display = "none";
        e.currentTarget.nextElementSibling.style.display = "flex";
      }}
    />
  ) : null}

  <div
    className={`h-10 w-10 items-center justify-center rounded-full bg-amber-50 font-semibold text-amber-600 ${
      student.imageUrl ? "hidden" : "flex"
    }`}
  >
    {String(student.name || "?")
      .charAt(0)
      .toUpperCase()}
  </div>

  <div>
    <p className="font-semibold text-gray-800">
      {student.name || "-"}
    </p>

    <p className="text-xs text-gray-500">
      {student.gender || ""}
    </p>
  </div>
</div>
                          </td>

                          <td className="px-5 py-4 font-medium text-gray-700">
                            {student.registerNumber ||
                              "-"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Sem{" "}
                              {student.semester || "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {student.batch || "-"}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {student.admissionYear ||
                              "-"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              {student.status || "Active"}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="divide-y divide-amber-100 md:hidden">
                {filteredStudents.map(
                  (student, index) => (
                    <div
                      key={
                        student._id ||
                        student.id ||
                        index
                      }
                      className="p-4"
                    >
                      <div className="flex gap-3">
                    {student.imageUrl ? (
  <img
    src={student.imageUrl}
    alt={student.name || "Student"}
    className="h-11 w-11 shrink-0 rounded-full object-cover border border-amber-200"
    onError={(e) => {
      e.currentTarget.style.display = "none";
      e.currentTarget.nextElementSibling.style.display = "flex";
    }}
  />
) : null}

<div
  className={`h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 font-semibold text-amber-600 ${
    student.imageUrl ? "hidden" : "flex"
  }`}
>
  {String(student.name || "?")
    .charAt(0)
    .toUpperCase()}
</div>

                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {student.name || "-"}
                              </p>

                              <p className="mt-0.5 text-xs text-amber-700">
                                {student.registerNumber ||
                                  "No register number"}
                              </p>
                            </div>

                            <span className="text-xs text-gray-500">
                              #{index + 1}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              Sem{" "}
                              {student.semester ||
                                "-"}
                            </span>

                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              {student.batch || "-"}
                            </span>

                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              {student.status ||
                                "Active"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}