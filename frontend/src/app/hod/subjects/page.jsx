"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useAuth } from "@clerk/nextjs";
import {
  Search,
  Download,
  RefreshCw,
  BookOpen,
  Filter,
  X,
  Layers,
  Hash,
} from "lucide-react";

export default function HODSubjectsPage() {
  const { getToken } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [semester, setSemester] = useState("");
  const [sortBy, setSortBy] = useState("sequence");

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

const fetchSubjects = async () => {
  try {
    setLoading(true);
    setError("");

    const token = await getToken();

    // =====================================================
    // GET LOGGED-IN HOD DETAILS
    // =====================================================

    const meResponse = await axios.get(
      `${API_URL}/api/users/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const me =
      meResponse.data?.data ||
      meResponse.data;

    const hodDepartment =
      me?.department
        ?.trim()
        .toLowerCase() || "";

    if (!hodDepartment) {
      setSubjects([]);
      setError(
        "Your department is not configured."
      );
      return;
    }

    // =====================================================
    // GET SUBJECTS
    // =====================================================

    const response = await axios.get(
      `${API_URL}/api/subjects/getsubjects`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data =
      response.data?.data ||
      response.data?.subjects ||
      response.data ||
      [];

    // =====================================================
    // FILTER ONLY HOD DEPARTMENT
    // =====================================================

    const departmentSubjects = data.filter(
      (subject) =>
        subject.department
          ?.trim()
          .toLowerCase() === hodDepartment
    );

    setSubjects(departmentSubjects);

  } catch (err) {
    console.error(
      "Subject fetch error:",
      err
    );

    setError(
      err.response?.data?.message ||
        "Unable to load subject details."
    );
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchSubjects();
  }, []);

  const semesters = useMemo(() => {
    return [
      ...new Set(
        subjects
          .map((subject) => subject.semester)
          .filter(
            (value) =>
              value !== undefined &&
              value !== null &&
              value !== ""
          )
      ),
    ].sort((a, b) => Number(a) - Number(b));
  }, [subjects]);

  const filteredSubjects = useMemo(() => {
    let result = [...subjects];

    if (search.trim()) {
      const q = search.toLowerCase().trim();

      result = result.filter((subject) =>
        [
          subject.code,
          subject.name,
          subject.department,
          subject.semester,
        ]
          .filter(
            (value) =>
              value !== undefined &&
              value !== null
          )
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(q)
          )
      );
    }

    if (semester) {
      result = result.filter(
        (subject) =>
          String(subject.semester) ===
          String(semester)
      );
    }

    result.sort((a, b) => {
      if (sortBy === "sequence") {
        const sequence =
          Number(a.sequence || 0) -
          Number(b.sequence || 0);

        if (sequence !== 0) return sequence;

        const sem =
          Number(a.semester || 0) -
          Number(b.semester || 0);

        if (sem !== 0) return sem;

        return String(a.code || "").localeCompare(
          String(b.code || "")
        );
      }

      if (sortBy === "semester") {
        const sem =
          Number(a.semester || 0) -
          Number(b.semester || 0);

        if (sem !== 0) return sem;

        return String(a.code || "").localeCompare(
          String(b.code || "")
        );
      }

      if (sortBy === "code") {
        return String(a.code || "").localeCompare(
          String(b.code || "")
        );
      }

      if (sortBy === "name") {
        return String(a.name || "").localeCompare(
          String(b.name || "")
        );
      }

      return 0;
    });

    return result;
  }, [subjects, search, semester, sortBy]);

  const clearFilters = () => {
    setSearch("");
    setSemester("");
    setSortBy("sequence");
  };

  const downloadExcel = () => {
    if (!filteredSubjects.length) return;

    const excelData = filteredSubjects.map(
      (subject, index) => ({
        "Sl. No.": index + 1,
        "Sequence Number": subject.sequence || "",
        "Subject Code":
          subject.code || "",
        "Subject Name":
          subject.name || "",
        "Semester":
          subject.semester || "",
        "Department":
          subject.department || "",
      })
    );

    const worksheet =
      XLSX.utils.json_to_sheet(excelData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 18 },
      { wch: 45 },
      { wch: 12 },
      { wch: 18 },
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Subjects"
    );

    XLSX.writeFile(
      workbook,
      `HOD_Subject_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  const semesterCounts = useMemo(() => {
    const counts = {};

    subjects.forEach((subject) => {
      const sem = subject.semester || "Other";

      counts[sem] = (counts[sem] || 0) + 1;
    });

    return counts;
  }, [subjects]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <BookOpen size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Subjects
              </h1>

              <p className="text-sm text-slate-500">
                Subjects belonging to the department
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchSubjects}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-amber-50 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  loading ? "animate-spin" : ""
                }
              />
              Refresh
            </button>

            <button
              onClick={downloadExcel}
              disabled={!filteredSubjects.length}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50"
            >
              <Download size={17} />
              Excel
            </button>
          </div>
        </div>



        {/* FILTERS */}
        <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">

            <div className="relative md:col-span-1">
              <Search
                size={18}
                className="absolute left-3 top-3 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search code or subject name..."
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
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value)
              }
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="sequence">
                Sort: Sequence Number
              </option>

              <option value="semester">
                Sort: Semester
              </option>

              <option value="code">
                Sort: Subject Code
              </option>

              <option value="name">
                Sort: Subject Name
              </option>
            </select>
          </div>

          <button
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-amber-50"
          >
            <X size={14} />
            Clear Filters
          </button>
        </div>

        {/* ERROR */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* TABLE */}
        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">

          <div className="border-b border-amber-100 px-5 py-4">
            <h2 className="font-semibold text-slate-900">
              Subject List
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing {filteredSubjects.length} of{" "}
              {subjects.length} subjects
            </p>
          </div>

          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw
                size={28}
                className="animate-spin text-amber-600"
              />
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center">
              <BookOpen
                size={40}
                className="mb-3 text-slate-300"
              />

              <p className="font-medium text-slate-700">
                No subjects found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing the filters.
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-amber-500 text-xs uppercase text-white">
                    <tr>
                      <th className="px-5 py-3">
                        #
                      </th>

                      <th className="px-5 py-3">
                        Sequence
                      </th>

                      <th className="px-5 py-3">
                        Subject Code
                      </th>

                      <th className="px-5 py-3">
                        Subject Name
                      </th>

                      <th className="px-5 py-3">
                        Semester
                      </th>

                      <th className="px-5 py-3">
                        Department
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-amber-100">
                    {filteredSubjects.map(
                      (subject, index) => (
                        <tr
                          key={
                            subject._id ||
                            subject.id ||
                            index
                          }
                          className="hover:bg-amber-50"
                        >
                          <td className="px-5 py-4 text-slate-500">
                            {index + 1}
                          </td>

                          <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                            {subject.sequence ?? "-"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
                              {subject.code ||
                                "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4 font-medium text-slate-800">
                            {subject.name || "-"}
                          </td>

                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                              Semester{" "}
                              {subject.semester ||
                                "-"}
                            </span>
                          </td>

                          <td className="px-5 py-4 text-sm uppercase text-slate-500">
                            {subject.department ||
                              "-"}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* MOBILE */}
              <div className="divide-y divide-amber-100 md:hidden">
                {filteredSubjects.map(
                  (subject, index) => (
                    <div
                      key={
                        subject._id ||
                        subject.id ||
                        index
                      }
                      className="p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                          <BookOpen size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between gap-2">
                            <div>
                              <p className="font-bold text-amber-700">
                                {subject.code ||
                                  "-"}
                              </p>

                              <p className="mt-1 font-medium text-slate-800">
                                {subject.name ||
                                  "-"}
                              </p>
                            </div>

                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                              Seq. {subject.sequence ?? "-"}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                              Sem{" "}
                              {subject.semester ||
                                "-"}
                            </span>

                            <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs uppercase text-amber-700">
                              {subject.department ||
                                "-"}
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