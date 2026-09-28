"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const departments = [
  {
    value: "at",
    label: "Automobile Engineering",
  },
  {
    value: "ch",
    label: "Chemical Engineering",
  },
  {
    value: "ce",
    label: "Civil Engineering",
  },
  {
    value: "cs",
    label: "Computer Science Engineering",
  },
  {
    value: "ec",
    label: "Electronics & Communication",
  },
  {
    value: "ee",
    label: "Electrical & Electronics",
  },
  {
    value: "me",
    label: "Mechanical Engineering",
  },
  {
    value: "ps",
    label: "Polymer Engineering",
  },
  {
    value: "sc",
    label: "Science & English",
  },
  {
    value: "ot",
    label: "Others",
  },
];

const roles = [
  {
    value: "admin",
    label: "Admin",
  },
  {
    value: "principal",
    label: "Principal",
  },
  {
    value: "coe",
    label: "COE",
  },
  {
    value: "exam_officer",
    label: "Exam Officer",
  },
  {
    value: "hod",
    label: "HOD",
  },
];

const getDepartmentName = (value) => {
  return (
    departments.find(
      (department) => department.value === value
    )?.label ||
    value ||
    "-"
  );
};

const getRoleName = (role) => {
  const found = roles.find(
    (item) => item.value === role
  );

  if (found) {
    return found.label;
  }

  if (role === "staff") {
    return "Staff";
  }

  if (role === "student") {
    return "Student";
  }

  return role || "Not assigned";
};

const getRoleBadgeClass = (role) => {
  return "bg-amber-50 text-amber-700 border-amber-200";
};

export default function UsersPage() {
  const { getToken } = useAuth();

  const [users, setUsers] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [searchText, setSearchText] =
    useState("");

  const [roleFilter, setRoleFilter] =
    useState("");

  const [
    departmentFilter,
    setDepartmentFilter,
  ] = useState("");

  const [
    selectedUsers,
    setSelectedUsers,
  ] = useState([]);

  /*
  |--------------------------------------------------------------------------
  | FETCH USERS
  |--------------------------------------------------------------------------
  */

  const fetchUsers = async () => {
    try {
      setLoading(true);

      const token =
        await getToken();

      const response =
        await axios.get(
          `${API_URL}/api/users/clerk-users`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      if (
        response.data?.success
      ) {
        setUsers(
          response.data.data || []
        );
      }
    } catch (error) {
      console.error(
        "Failed to fetch users:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to fetch users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  /*
  |--------------------------------------------------------------------------
  | FILTER
  |--------------------------------------------------------------------------
  */

  const filteredUsers =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      return users.filter(
        (user) => {
          const matchesSearch =
            !search ||
            user.name
              ?.toLowerCase()
              .includes(search) ||
            user.email
              ?.toLowerCase()
              .includes(search);

          const matchesRole =
            !roleFilter ||
            user.role === roleFilter;

          const matchesDepartment =
            !departmentFilter ||
            user.department ===
              departmentFilter;

          return (
            matchesSearch &&
            matchesRole &&
            matchesDepartment
          );
        }
      );
    }, [
      users,
      searchText,
      roleFilter,
      departmentFilter,
    ]);

  /*
  |--------------------------------------------------------------------------
  | SELECT USER
  |--------------------------------------------------------------------------
  */

  const toggleUserSelection = (
    clerkId
  ) => {
    setSelectedUsers(
      (previous) =>
        previous.includes(clerkId)
          ? previous.filter(
              (id) =>
                id !== clerkId
            )
          : [
              ...previous,
              clerkId,
            ]
    );
  };

  /*
  |--------------------------------------------------------------------------
  | SELECT ALL
  |--------------------------------------------------------------------------
  */

  const toggleSelectAll = () => {
    const visibleIds =
      filteredUsers.map(
        (user) => user.clerkId
      );

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) =>
        selectedUsers.includes(id)
      );

    if (allSelected) {
      setSelectedUsers(
        (previous) =>
          previous.filter(
            (id) =>
              !visibleIds.includes(
                id
              )
          )
      );
    } else {
      setSelectedUsers(
        (previous) => [
          ...new Set([
            ...previous,
            ...visibleIds,
          ]),
        ]
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | CLEAR FILTERS
  |--------------------------------------------------------------------------
  */

  const clearFilters = () => {
    setSearchText("");
    setRoleFilter("");
    setDepartmentFilter("");
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE SINGLE
  |--------------------------------------------------------------------------
  */

  const handleDelete = async (
    clerkId
  ) => {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this user account?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const token =
        await getToken();

      await axios.delete(
        `${API_URL}/api/users/clerk-users/${clerkId}`,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      setUsers(
        (previous) =>
          previous.filter(
            (user) =>
              user.clerkId !==
              clerkId
          )
      );

      setSelectedUsers(
        (previous) =>
          previous.filter(
            (id) =>
              id !== clerkId
          )
      );
    } catch (error) {
      console.error(
        "Delete user error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete user."
      );
    }
  };

  /*
  |--------------------------------------------------------------------------
  | DELETE SELECTED
  |--------------------------------------------------------------------------
  */

  const handleDeleteSelected =
    async () => {
      if (
        selectedUsers.length === 0
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Are you sure you want to delete ${selectedUsers.length} selected user(s)?`
        );

      if (!confirmed) {
        return;
      }

      try {
        setLoading(true);

        const token =
          await getToken();

        await Promise.all(
          selectedUsers.map(
            (clerkId) =>
              axios.delete(
                `${API_URL}/api/users/clerk-users/${clerkId}`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                }
              )
          )
        );

        setUsers(
          (previous) =>
            previous.filter(
              (user) =>
                !selectedUsers.includes(
                  user.clerkId
                )
            )
        );

        setSelectedUsers([]);

      } catch (error) {
        console.error(
          "Bulk delete error:",
          error
        );

        alert(
          error.response?.data?.message ||
            "Failed to delete selected users."
        );

        await fetchUsers();

        setSelectedUsers([]);

      } finally {
        setLoading(false);
      }
    };

  /*
  |--------------------------------------------------------------------------
  | CHECKBOX STATE
  |--------------------------------------------------------------------------
  */

  const allVisibleSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every(
      (user) =>
        selectedUsers.includes(
          user.clerkId
        )
    );

  /*
  |--------------------------------------------------------------------------
  | DOWNLOAD USERS TO EXCEL
  |--------------------------------------------------------------------------
  */

  const downloadUsersExcel = () => {
    const exportData = filteredUsers.map(
      (user, index) => ({
        "Sl No": index + 1,
        Name: user.name || "",
        Email: user.email || "",
        Role: getRoleName(user.role),
        "Role Code": user.role || "",
        Department: getDepartmentName(
          user.department
        ),
        "Department Code":
          user.department || "",
      })
    );

    if (exportData.length === 0) {
      alert("There are no users to download.");
      return;
    }

    const worksheet =
      XLSX.utils.json_to_sheet(exportData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 35 },
      { wch: 20 },
      { wch: 18 },
      { wch: 32 },
      { wch: 18 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Users"
    );

    XLSX.writeFile(
      workbook,
      "users_list.xlsx"
    );
  };

  /*
  |--------------------------------------------------------------------------
  | UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="min-h-screen bg-white p-4 sm:p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

        <div>
          <p className="text-sm font-semibold text-amber-600">
            Examination Management
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            User Management
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage administrative and examination system users.
          </p>
        </div>

        <div className="flex items-center gap-3">

          {/* TOTAL USERS */}
          <div className="hidden rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 sm:block">
            <p className="text-xs font-medium text-amber-600">
              Total Users =
              <span className="ml-1 text-xl font-bold text-amber-700">
                {users.length}
              </span>
            </p>
          </div>

          {/* ADD USER */}
          <Link
            href="/admin/users/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600"
          >
            <span className="text-xl leading-none">
              +
            </span>
            Add New User
          </Link>

        </div>
      </div>

      {/* FILTER CARD */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">

          {/* SEARCH */}
          <div className="relative min-w-0 flex-1">

            <input
              type="text"
              value={searchText}
              onChange={(e) =>
                setSearchText(
                  e.target.value
                )
              }
              placeholder="Search by name or email..."
              className="h-11 w-full rounded-xl border border-amber-200 bg-white px-4 pr-10 text-sm text-slate-700 outline-none transition focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
            />

            {searchText && (
              <button
                type="button"
                onClick={() =>
                  setSearchText("")
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-amber-600"
              >
                ✕
              </button>
            )}

          </div>

          {/* ROLE */}
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(
                e.target.value
              )
            }
            className="h-11 rounded-xl border border-amber-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
          >
            <option value="">
              All Roles
            </option>

            {roles.map((role) => (
              <option
                key={role.value}
                value={role.value}
              >
                {role.label}
              </option>
            ))}
          </select>

          {/* DEPARTMENT */}
          <select
            value={departmentFilter}
            onChange={(e) =>
              setDepartmentFilter(
                e.target.value
              )
            }
            className="h-11 rounded-xl border border-amber-200 bg-white px-4 text-sm text-slate-700 outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
          >
            <option value="">
              All Departments
            </option>

            {departments.map(
              (department) => (
                <option
                  key={department.value}
                  value={
                    department.value
                  }
                >
                  {department.label}
                </option>
              )
            )}
          </select>

          {/* CLEAR */}
          {(searchText ||
            roleFilter ||
            departmentFilter) && (
            <button
              onClick={clearFilters}
              className="h-11 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              Clear Filters
            </button>
          )}

          {/* DELETE */}
          <button
            onClick={
              handleDeleteSelected
            }
            disabled={
              selectedUsers.length ===
                0 || loading
            }
            className="h-11 rounded-xl bg-amber-500 px-5 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete Selected

            {selectedUsers.length >
              0 &&
              ` (${selectedUsers.length})`}
          </button>

        </div>
      </div>

      {/* COUNT + EXCEL DOWNLOAD */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        <div className="flex items-center gap-4">

          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {filteredUsers.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800">
              {users.length}
            </span>{" "}
            users
          </p>

          {selectedUsers.length > 0 && (
            <p className="text-sm font-semibold text-amber-600">
              {selectedUsers.length} selected
            </p>
          )}

        </div>

        <button
          type="button"
          onClick={downloadUsersExcel}
          disabled={filteredUsers.length === 0}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-4 w-4"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>

          Download Excel
        </button>

      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">

            <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-100 border-t-amber-500" />

          </div>
        ) : filteredUsers.length ===
          0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-500">

              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-7 w-7"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>

            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No users found
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Try changing the search or filters.
            </p>

          </div>
        ) : (

          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px]">

              <thead>
                <tr className="border-b border-amber-400 bg-amber-500">

                  {/* CHECKBOX */}
                  <th className="w-12 px-3 py-3 text-center">

                    <input
                      type="checkbox"
                      checked={
                        allVisibleSelected
                      }
                      onChange={
                        toggleSelectAll
                      }
                      className="h-4 w-4 cursor-pointer accent-amber-600"
                    />

                  </th>

                  {/* SL NO */}
                  <th className="w-14 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-white">
                    #
                  </th>

                  {/* USER */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-white">
                    User
                  </th>

                  {/* EMAIL */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-white">
                    Email
                  </th>

                  {/* ROLE */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-white">
                    Role
                  </th>

                  {/* DEPARTMENT */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-white">
                    Department
                  </th>

                  {/* ACTION */}
                  <th className="w-24 px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-white">
                    Action
                  </th>

                </tr>
              </thead>

              <tbody className="divide-y divide-amber-100">

                {filteredUsers.map(
                  (user, index) => {

                    const selected =
                      selectedUsers.includes(
                        user.clerkId
                      );

                    return (
                      <tr
                        key={
                          user.clerkId
                        }
                        className={`transition ${
                          selected
                            ? "bg-amber-50"
                            : "hover:bg-amber-50/50"
                        }`}
                      >

                        {/* CHECKBOX */}
                        <td className="px-3 py-3 text-center">

                          <input
                            type="checkbox"
                            checked={
                              selected
                            }
                            onChange={() =>
                              toggleUserSelection(
                                user.clerkId
                              )
                            }
                            className="h-4 w-4 cursor-pointer accent-amber-600"
                          />

                        </td>

                        {/* SL NO */}
                        <td className="px-2 py-3 text-sm font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* USER */}
                        <td className="px-3 py-3">

                          <div className="flex items-center gap-3">

                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-amber-50 ring-1 ring-amber-200">

                              <img
                                src={
                                  user.imageUrl ||
                                  "/default-avatar.png"
                                }
                                alt={
                                  user.name ||
                                  "User"
                                }
                                className="h-full w-full object-cover"
                              />

                            </div>

                            <div className="min-w-0">

                              <p className="truncate text-sm font-semibold text-slate-900">
                                {user.name ||
                                  "Unnamed User"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                KPT Examination System
                              </p>

                            </div>

                          </div>

                        </td>

                        {/* EMAIL */}
                        <td className="px-3 py-3">

                          <p className="max-w-[250px] truncate text-sm text-slate-600">
                            {user.email ||
                              "-"}
                          </p>

                        </td>

                        {/* ROLE */}
                        <td className="px-3 py-3">

                          <span
                            className={`inline-flex rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${getRoleBadgeClass(
                              user.role
                            )}`}
                          >
                            {getRoleName(
                              user.role
                            )}
                          </span>

                        </td>

                        {/* DEPARTMENT */}
                        <td className="px-3 py-3">

                          <span className="inline-flex rounded-lg border border-amber-100 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-700">
                            {getDepartmentName(
                              user.department
                            )}
                          </span>

                        </td>

                        {/* DELETE */}
                        <td className="px-3 py-3">

                          <div className="flex justify-end">

                            <button
                              onClick={() =>
                                handleDelete(
                                  user.clerkId
                                )
                              }
                              title="Delete User"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 text-amber-500 transition hover:bg-amber-50 hover:text-amber-700"
                            >

                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                className="h-4 w-4"
                              >
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v5" />
                                <path d="M14 11v5" />
                              </svg>

                            </button>

                          </div>

                        </td>

                      </tr>
                    );
                  }
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* SELECTED INFORMATION */}
      {selectedUsers.length >
        0 && (
        <div className="mt-3 flex items-center justify-between px-1">

          <p className="text-xs font-medium text-amber-600">
            {selectedUsers.length} user
            {selectedUsers.length !==
            1
              ? "s"
              : ""}{" "}
            selected
          </p>

          <button
            onClick={() =>
              setSelectedUsers([])
            }
            className="text-xs font-semibold text-slate-500 transition hover:text-amber-600"
          >
            Clear Selection
          </button>

        </div>
      )}

    </div>
  );
}