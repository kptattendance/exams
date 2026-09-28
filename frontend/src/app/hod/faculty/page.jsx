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
  Mail,
  Phone,
  Building2,
  UserRound,
} from "lucide-react";

export default function HODFacultyPage() {
  const { getToken } = useAuth();

  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [sortBy, setSortBy] = useState("name");

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // =====================================================
  // FETCH FACULTY
  // =====================================================

  const fetchFaculty = async () => {
    try {
      setLoading(true);
      setError("");

      const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/users/getusers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        response.data?.data ||
        response.data?.users ||
        [];

      setFaculty(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      console.error(
        "Faculty fetch error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to load faculty details."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  // =====================================================
  // DEPARTMENTS
  // =====================================================

  const departments = useMemo(() => {
    return [
      ...new Set(
        faculty
          .map((item) =>
            String(
              item.department || ""
            )
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)
      ),
    ].sort();
  }, [faculty]);

  // =====================================================
  // FILTER + SORT
  // =====================================================

  const filteredFaculty = useMemo(() => {
    let result = [...faculty];

    // Search
    if (search.trim()) {
      const q = search
        .toLowerCase()
        .trim();

      result = result.filter((item) =>
        [
          item.name,
          item.email,
          item.phone,
          item.department,
          item.role,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(q)
          )
      );
    }

    // Department
    if (department) {
      result = result.filter(
        (item) =>
          String(
            item.department || ""
          ).toLowerCase() ===
          department.toLowerCase()
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") {
        return String(
          a.name || ""
        ).localeCompare(
          String(b.name || "")
        );
      }

      if (sortBy === "department") {
        return String(
          a.department || ""
        ).localeCompare(
          String(b.department || "")
        );
      }

      if (sortBy === "email") {
        return String(
          a.email || ""
        ).localeCompare(
          String(b.email || "")
        );
      }

      return 0;
    });

    return result;
  }, [
    faculty,
    search,
    department,
    sortBy,
  ]);

  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setSortBy("name");
  };

  // =====================================================
  // EXCEL DOWNLOAD
  // =====================================================

  const downloadExcel = () => {
    if (!filteredFaculty.length) {
      return;
    }

    const excelData =
      filteredFaculty.map(
        (item, index) => ({
          "Sl. No.": index + 1,
          "Name":
            item.name || "",
          "Email":
            item.email || "",
          "Phone":
            item.phone || "",
          "Department":
            item.department || "",
          "Role":
            item.role || "",
        })
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        excelData
      );

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 30 },
      { wch: 35 },
      { wch: 18 },
      { wch: 18 },
      { wch: 15 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Faculty"
    );

    XLSX.writeFile(
      workbook,
      `HOD_Faculty_Report_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">

      <div className="mx-auto max-w-7xl">

        {/* ================================================= */}
        {/* HEADER */}
        {/* ================================================= */}

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
              <Users size={22} />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Faculty
              </h1>

              <p className="text-sm text-slate-500">
                Faculty members of the department
              </p>
            </div>

          </div>

          <div className="flex gap-2">

            <button
              onClick={fetchFaculty}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-amber-50/30 disabled:opacity-50"
            >
              <RefreshCw
                size={17}
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
              />
              Refresh
            </button>

            <button
              onClick={downloadExcel}
              disabled={
                !filteredFaculty.length
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download size={17} />
              Excel
            </button>

          </div>
        </div>

      

        {/* ================================================= */}
        {/* FILTERS */}
        {/* ================================================= */}

        <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">

          <div className="mb-3 flex items-center gap-2">
            <Filter
              size={17}
              className="text-slate-500"
            />

            <span className="text-sm font-semibold text-slate-700">
              Faculty Filters
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">

            {/* SEARCH */}
            <div className="relative md:col-span-2">

              <Search
                size={18}
                className="absolute left-3 top-3 text-slate-400"
              />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Search name, email, phone..."
                className="w-full rounded-xl border border-amber-200 bg-amber-50/30 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-amber-500 focus:bg-white focus:ring-2 focus:ring-amber-100"
              />

            </div>

            {/* DEPARTMENT */}
            <select
              value={department}
              onChange={(e) =>
                setDepartment(
                  e.target.value
                )
              }
              className="rounded-xl border border-amber-200 bg-amber-50/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="">
                All Departments
              </option>

              {departments.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item.toUpperCase()}
                  </option>
                )
              )}
            </select>

            {/* SORT */}
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value
                )
              }
              className="rounded-xl border border-amber-200 bg-amber-50/30 px-4 py-2.5 text-sm outline-none focus:border-amber-500 focus:bg-white"
            >
              <option value="name">
                Sort: Name
              </option>

              <option value="department">
                Sort: Department
              </option>

              <option value="email">
                Sort: Email
              </option>
            </select>

          </div>

          <button
            onClick={clearFilters}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-amber-50/30"
          >
            <X size={14} />
            Clear Filters
          </button>

        </div>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ================================================= */}
        {/* TABLE */}
        {/* ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">

          <div className="border-b border-amber-200 px-5 py-4">

            <h2 className="font-semibold text-slate-900">
              Faculty List
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Showing{" "}
              {filteredFaculty.length}{" "}
              of{" "}
              {faculty.length}{" "}
              faculty
            </p>

          </div>

          {/* LOADING */}

          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw
                size={28}
                className="animate-spin text-amber-600"
              />
            </div>
          ) : filteredFaculty.length === 0 ? (

            <div className="flex h-60 flex-col items-center justify-center text-center">

              <Users
                size={40}
                className="mb-3 text-amber-300"
              />

              <p className="font-medium text-slate-700">
                No faculty found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing the filters.
              </p>

            </div>

          ) : (

            <>
              {/* ================================================= */}
              {/* DESKTOP TABLE */}
              {/* ================================================= */}

              <div className="hidden overflow-x-auto md:block">

                <table className="w-full text-left text-sm">

                  <thead className="bg-amber-50/30 text-xs uppercase text-slate-500">

                    <tr>

                      <th className="px-5 py-3">
                        #
                      </th>

                      <th className="px-5 py-3">
                        Faculty
                      </th>

                      <th className="px-5 py-3">
                        Email
                      </th>

                      <th className="px-5 py-3">
                        Phone
                      </th>

                      <th className="px-5 py-3">
                        Department
                      </th>

                      <th className="px-5 py-3">
                        Role
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-amber-100">

                    {filteredFaculty.map(
                      (item, index) => (

                        <tr
                          key={
                            item._id ||
                            item.clerkId ||
                            index
                          }
                          className="hover:bg-amber-50/30"
                        >

                          {/* SL NO */}

                          <td className="px-5 py-4 text-slate-500">
                            {index + 1}
                          </td>

                          {/* FACULTY */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-3">

                              {item.imageUrl ? (
                                <img
                                  src={
                                    item.imageUrl
                                  }
                                  alt=""
                                  className="h-10 w-10 rounded-full object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 font-semibold text-amber-600">
                                  {String(
                                    item.name ||
                                      "?"
                                  )
                                    .charAt(
                                      0
                                    )
                                    .toUpperCase()}
                                </div>
                              )}

                              <div>

                                <p className="font-semibold text-slate-800">
                                  {item.name ||
                                    "-"}
                                </p>

                                <p className="text-xs text-slate-400">
                                  Faculty
                                </p>

                              </div>

                            </div>

                          </td>

                          {/* EMAIL */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2 text-slate-600">

                              <Mail
                                size={15}
                                className="text-slate-400"
                              />

                              {item.email ||
                                "-"}

                            </div>

                          </td>

                          {/* PHONE */}

                          <td className="px-5 py-4">

                            <div className="flex items-center gap-2 text-slate-600">

                              <Phone
                                size={15}
                                className="text-slate-400"
                              />

                              {item.phone ||
                                "-"}

                            </div>

                          </td>

                          {/* DEPARTMENT */}

                          <td className="px-5 py-4">

                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold uppercase text-amber-700">
                              {item.department ||
                                "-"}
                            </span>

                          </td>

                          {/* ROLE */}

                          <td className="px-5 py-4">

                            <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              {item.role ||
                                "-"}
                            </span>

                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

              {/* ================================================= */}
              {/* MOBILE */}
              {/* ================================================= */}

              <div className="divide-y divide-amber-100 md:hidden">

                {filteredFaculty.map(
                  (item, index) => (

                    <div
                      key={
                        item._id ||
                        item.clerkId ||
                        index
                      }
                      className="p-4"
                    >

                      <div className="flex gap-3">

                        {item.imageUrl ? (
                          <img
                            src={
                              item.imageUrl
                            }
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 font-semibold text-amber-600">
                            {String(
                              item.name ||
                                "?"
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">

                          <div className="flex items-start justify-between gap-2">

                            <div>

                              <p className="font-semibold text-slate-800">
                                {item.name ||
                                  "-"}
                              </p>

                              <p className="mt-1 text-xs text-slate-500">
                                {item.department
                                  ? item.department.toUpperCase()
                                  : "-"}
                              </p>

                            </div>

                            <span className="text-xs text-slate-400">
                              #{index + 1}
                            </span>

                          </div>

                          <div className="mt-3 space-y-2 text-xs text-slate-500">

                            <p className="flex items-center gap-2">
                              <Mail
                                size={13}
                              />
                              {item.email ||
                                "-"}
                            </p>

                            <p className="flex items-center gap-2">
                              <Phone
                                size={13}
                              />
                              {item.phone ||
                                "-"}
                            </p>

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