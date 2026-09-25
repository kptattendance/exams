"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const departments = [
  { value: "at", label: "Automobile Engineering" },
  { value: "ch", label: "Chemical Engineering" },
  { value: "ce", label: "Civil Engineering" },
  { value: "cs", label: "Computer Science Engineering" },
  { value: "ec", label: "Electronics & Communication" },
  { value: "ee", label: "Electrical & Electronics" },
  { value: "me", label: "Mechanical Engineering" },
  { value: "ps", label: "Polymer Engineering" },
  { value: "sc", label: "Science & English" },
  { value: "ot", label: "Others" },
];

const getDepartmentName = (value) => {
  return (
    departments.find(
      (department) => department.value === value
    )?.label || value || "-"
  );
};

export default function ClerkUsersPage() {
  const { getToken } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [selectedUsers, setSelectedUsers] = useState([]);

  // ==========================================================
  // FETCH CLERK USERS
  // ==========================================================

  const fetchClerkUsers = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/users/clerk-users`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        setUsers(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch Clerk users:", error);

      alert(
        error.response?.data?.message ||
          "Failed to fetch Clerk users."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClerkUsers();
  }, []);
const filteredUsers = users.filter((user) => {
  const search = searchText.trim().toLowerCase();

  const matchesSearch =
    !search ||
    user.name?.toLowerCase().includes(search) ||
    user.email?.toLowerCase().includes(search);

  const matchesRole =
    !roleFilter || user.role === roleFilter;

  const matchesDepartment =
    !departmentFilter ||
    user.department === departmentFilter;

  return (
    matchesSearch &&
    matchesRole &&
    matchesDepartment
  );
});

  // ==========================================================
  // SELECT / DESELECT USER
  // ==========================================================

  const toggleUserSelection = (clerkId) => {
    setSelectedUsers((prev) =>
      prev.includes(clerkId)
        ? prev.filter((id) => id !== clerkId)
        : [...prev, clerkId]
    );
  };

  // ==========================================================
  // SELECT / DESELECT ALL FILTERED USERS
  // ==========================================================

  const toggleSelectAll = () => {
    const visibleIds = filteredUsers.map(
      (user) => user.clerkId
    );

    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) =>
        selectedUsers.includes(id)
      );

    if (allSelected) {
      setSelectedUsers((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setSelectedUsers((prev) => [
        ...new Set([...prev, ...visibleIds]),
      ]);
    }
  };

  const clearFilters = () => {
  setSearchText("");
  setRoleFilter("");
  setDepartmentFilter("");
};

  // ==========================================================
  // DELETE SINGLE USER
  // ==========================================================

  const handleDelete = async (clerkId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this Clerk account?"
    );

    if (!confirmed) return;

    try {
      const token = await getToken();

      await axios.delete(
        `${API_URL}/api/users/clerk-users/${clerkId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUsers((prev) =>
        prev.filter((user) => user.clerkId !== clerkId)
      );

      setSelectedUsers((prev) =>
        prev.filter((id) => id !== clerkId)
      );

      alert("Clerk account deleted successfully.");
    } catch (error) {
      console.error(
        "Delete Clerk User Error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete Clerk account."
      );
    }
  };

  // ==========================================================
  // DELETE SELECTED USERS
  // ==========================================================

  const handleDeleteSelected = async () => {
    if (selectedUsers.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedUsers.length} selected Clerk account(s)?`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      const token = await getToken();

      await Promise.all(
        selectedUsers.map((clerkId) =>
          axios.delete(
            `${API_URL}/api/users/clerk-users/${clerkId}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
        )
      );

      setUsers((prev) =>
        prev.filter(
          (user) =>
            !selectedUsers.includes(user.clerkId)
        )
      );

      setSelectedUsers([]);

      alert(
        "Selected Clerk accounts deleted successfully."
      );
    } catch (error) {
      console.error(
        "Bulk delete Clerk users error:",
        error
      );

      alert(
        error.response?.data?.message ||
          "Failed to delete one or more Clerk accounts."
      );

      await fetchClerkUsers();
      setSelectedUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-8">
        <p className="text-sm font-semibold text-slate-500">
          User Management
        </p>

        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Clerk Users
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Manage user accounts registered in Clerk.
        </p>
      </div>

      {/* FILTER CARD */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          {/* FILTERS */}
          <div className="flex flex-col gap-3 sm:flex-row">
{/* SEARCH */}
<div className="relative w-full sm:min-w-72">
  <input
    type="text"
    value={searchText}
    onChange={(e) => setSearchText(e.target.value)}
    placeholder="Search by name or email..."
    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 pr-10 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white"
  />

  {searchText && (
    <button
      type="button"
      onClick={() => setSearchText("")}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
      aria-label="Clear search"
    >
      ✕
    </button>
  )}
</div>
            {/* ROLE */}
          <select
  value={roleFilter}
  onChange={(e) => setRoleFilter(e.target.value)}
  className="min-w-44 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
>
  <option value="">All Roles</option>

  <option value="admin">Admin</option>

  <option value="principal">Principal</option>

  <option value="coe">COE</option>

  <option value="exam_officer">Exam Officer</option>

  <option value="hod">HOD</option>

  <option value="staff">Staff</option>

  <option value="student">Student</option>
</select>

            {/* DEPARTMENT */}
            <select
              value={departmentFilter}
              onChange={(e) =>
                setDepartmentFilter(e.target.value)
              }
              className="min-w-56 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
            >
              <option value="">
                All Departments
              </option>

              {departments.map((department) => (
                <option
                  key={department.value}
                  value={department.value}
                >
                  {department.label}
                </option>
              ))}
            </select>

            {/* CLEAR */}
     {(searchText || roleFilter || departmentFilter) && (
              <button
                onClick={clearFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Clear Filters
              </button>
            )}
          </div>

          {/* DELETE SELECTED */}
          <button
            onClick={handleDeleteSelected}
            disabled={selectedUsers.length === 0 || loading}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Delete Selected
            {selectedUsers.length > 0 &&
              ` (${selectedUsers.length})`}
          </button>
        </div>
      </div>

      {/* USER COUNT */}
      <div className="mb-3 flex items-center justify-between">
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
          <p className="text-sm font-medium text-red-600">
            {selectedUsers.length} selected
          </p>
        )}
      </div>

      {/* CONTENT */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
              👤
            </div>

            <p className="mt-4 font-semibold text-slate-800">
              No users found
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Try changing the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full min-w-[950px]">

              {/* TABLE HEADER */}
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">

                  {/* SELECT ALL */}
                  <th className="w-14 px-6 py-4">
                    <input
                      type="checkbox"
                      checked={
                        filteredUsers.length > 0 &&
                        filteredUsers.every((user) =>
                          selectedUsers.includes(
                            user.clerkId
                          )
                        )
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer"
                    />
                  </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Sl. No.
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Email
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Department
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>

                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody>

                {filteredUsers.map((user,index) => (
                  <tr
                    key={user.clerkId}
                    className={`border-b border-slate-100 last:border-0 transition hover:bg-slate-50 ${
                      selectedUsers.includes(
                        user.clerkId
                      )
                        ? "bg-red-50/40"
                        : ""
                    }`}
                  >

                    {/* CHECKBOX */}
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(
                          user.clerkId
                        )}
                        onChange={() =>
                          toggleUserSelection(
                            user.clerkId
                          )
                        }
                        className="h-4 w-4 cursor-pointer"
                      />
                    </td>
 <td className="px-6 py-4 text-sm text-slate-600">
                      {index+1 || "-"}
                    </td>
                    {/* USER */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">

                        {user.imageUrl ? (
                          <img
                            src={user.imageUrl}
                            alt={user.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                            {user.name
                              ?.charAt(0)
                              ?.toUpperCase() || "?"}
                          </div>
                        )}

                        <div>
                          <p className="font-medium text-slate-800">
                            {user.name || "Unnamed User"}
                          </p>

                          <p className="text-xs text-slate-400">
                            {user.clerkId}
                          </p>
                        </div>

                      </div>
                    </td>

                    {/* EMAIL */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {user.email || "-"}
                    </td>

                    {/* ROLE */}
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                        {user.role || "Not assigned"}
                      </span>
                    </td>

                    {/* DEPARTMENT */}
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {getDepartmentName(
                        user.department
                      )}
                    </td>

                    {/* ACTION */}
                    <td className="px-6 py-4">
                      <div className="flex justify-end">

                        <button
                          onClick={() =>
                            handleDelete(
                              user.clerkId
                            )
                          }
                          className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>

                      </div>
                    </td>

                  </tr>
                ))}

              </tbody>

            </table>
          </div>
        )}

      </div>
    </div>
  );
}