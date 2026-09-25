"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
const departments = [
  { value: "", label: "Select department" },
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

const getDepartmentName = (code) => {
  const department = departments.find((item) => item.value === code);
  return department?.label || code || "Not assigned";
};

export default function FacultyPage() {
  const { getToken } = useAuth();

  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");

  const [selectedFaculty, setSelectedFaculty] = useState([]);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    role: "staff",
    image: null,
  });

  const [imagePreview, setImagePreview] = useState(null);

  // --------------------------------------------------
  // LOAD FACULTY
  // --------------------------------------------------

  const loadFaculty = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/getusers`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const users = response.data || [];

      const facultyUsers = users.filter(
        (user) => user.role?.toLowerCase() === "staff"
      );

      setFaculty(facultyUsers);
      setSelectedFaculty([]);
    } catch (error) {
      console.error("Failed to load faculty:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load faculty."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFaculty();
  }, []);

  // --------------------------------------------------
  // FILTER
  // --------------------------------------------------

  const filteredFaculty = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return faculty.filter((user) => {
      const matchesSearch =
        !searchValue ||
        user.name?.toLowerCase().includes(searchValue) ||
        user.email?.toLowerCase().includes(searchValue) ||
        user.phone?.toLowerCase().includes(searchValue);

      const matchesDepartment =
        !departmentFilter ||
        user.department === departmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [faculty, search, departmentFilter]);

  // --------------------------------------------------
  // SELECTION
  // --------------------------------------------------

  const isAllSelected =
    filteredFaculty.length > 0 &&
    filteredFaculty.every((user) =>
      selectedFaculty.includes(user._id)
    );

  const toggleSelectFaculty = (id) => {
    setSelectedFaculty((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFaculty((previous) =>
        previous.filter(
          (id) =>
            !filteredFaculty.some(
              (user) => user._id === id
            )
        )
      );
    } else {
      setSelectedFaculty((previous) => {
        const ids = filteredFaculty.map(
          (user) => user._id
        );

        return [
          ...previous,
          ...ids.filter(
            (id) => !previous.includes(id)
          ),
        ];
      });
    }
  };

  // --------------------------------------------------
  // FORM
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    setForm((previous) => ({
      ...previous,
      image: file || null,
    }));

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(null);
    }
  };

  // --------------------------------------------------
  // ADD
  // --------------------------------------------------

  const openAddModal = () => {
    setEditingFaculty(null);

    setForm({
      name: "",
      email: "",
      phone: "",
      department: "",
      role: "staff",
      image: null,
    });

    setImagePreview(null);
    setShowModal(true);
  };

  // --------------------------------------------------
  // EDIT
  // --------------------------------------------------

  const openEditModal = (user) => {
    setEditingFaculty(user);

    setForm({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      department: user.department || "",
      role: "staff",
      image: null,
    });

    setImagePreview(user.imageUrl || null);
    setShowModal(true);
  };

  // --------------------------------------------------
  // CLOSE
  // --------------------------------------------------

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);
    setEditingFaculty(null);
    setImagePreview(null);
  };

  // --------------------------------------------------
  // SAVE
  // --------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.department) {
      alert("Please select a department.");
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      const formData = new FormData();

      formData.append("name", form.name);
      formData.append("email", form.email);
      formData.append("phone", form.phone);
      formData.append("department", form.department);
      formData.append("role", "staff");

      if (form.image) {
        formData.append("image", form.image);
      }

      if (editingFaculty) {
        await axios.put(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/updateuser/${editingFaculty._id}`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/adduser`,
          formData,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      await loadFaculty();
      closeModal();
    } catch (error) {
      console.error("Faculty save error:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save faculty."
      );
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------
  // DELETE SINGLE
  // --------------------------------------------------

  const handleDelete = async (user) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}?`
    );

    if (!confirmed) return;

    try {
      const token = await getToken();

      await axios.delete(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/deleteuser/${user._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await loadFaculty();
    } catch (error) {
      console.error("Faculty delete error:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete faculty."
      );
    }
  };

  // --------------------------------------------------
  // DELETE SELECTED
  // --------------------------------------------------

  const handleDeleteSelected = async () => {
    if (selectedFaculty.length === 0) return;

    const selectedUsers = faculty.filter((user) =>
      selectedFaculty.includes(user._id)
    );

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedUsers.length} selected faculty member${
        selectedUsers.length !== 1 ? "s" : ""
      }?`
    );

    if (!confirmed) return;

    try {
      setDeletingSelected(true);

      const token = await getToken();

      await Promise.all(
        selectedUsers.map((user) =>
          axios.delete(
            `${process.env.NEXT_PUBLIC_API_URL}/api/users/deleteuser/${user._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
        )
      );

      await loadFaculty();
    } catch (error) {
      console.error("Bulk faculty delete error:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete selected faculty."
      );
    } finally {
      setDeletingSelected(false);
    }
  };

  // --------------------------------------------------
  // BULK UPLOAD
  // --------------------------------------------------

const openBulkUpload = () => {
  setBulkFile(null);
  setBulkResult(null);
  setShowBulkUpload(true);
};

const closeBulkUpload = () => {
  if (bulkUploading) return;

  setShowBulkUpload(false);
  setBulkFile(null);
  setBulkResult(null);
};

const handleBulkFileChange = (e) => {
  const file = e.target.files?.[0] || null;

  if (!file) {
    setBulkFile(null);
    return;
  }

  const validExtensions = [
    ".xlsx",
    ".xls",
    ".csv",
  ];

  const fileName = file.name.toLowerCase();

  const valid = validExtensions.some(
    (extension) =>
      fileName.endsWith(extension)
  );

  if (!valid) {
    alert(
      "Please select an Excel (.xlsx/.xls) or CSV file."
    );

    e.target.value = "";
    setBulkFile(null);

    return;
  }

  // Maximum Excel/CSV size = 10 MB
  if (file.size > 10 * 1024 * 1024) {
    alert(
      "File size must be 10 MB or less."
    );

    e.target.value = "";
    setBulkFile(null);

    return;
  }

  setBulkFile(file);
  setBulkResult(null);
};


const downloadBulkTemplate = () => {
  const data = [
    [
      "Name",
      "Email",
      "Phone",
      "Department",
      "Photo",
    ],

    [
      "Ravi Kumar",
      "ravi@example.com",
      "9876543210",
      "cs",
      "https://drive.google.com/file/d/FILE_ID_1/view?usp=sharing",
    ],

    [
      "Anitha Rao",
      "anitha@example.com",
      "9876543211",
      "ec",
      "https://drive.google.com/file/d/FILE_ID_2/view?usp=sharing",
    ],

    [
      "Kumar P",
      "kumar@example.com",
      "9876543212",
      "ot",
      "https://drive.google.com/file/d/FILE_ID_3/view?usp=sharing",
    ],
  ];

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 25 }, // Name
    { wch: 32 }, // Email
    { wch: 18 }, // Phone
    { wch: 18 }, // Department
    { wch: 70 }, // Photo
  ];

  // Make Phone column text
  for (let row = 2; row <= data.length; row++) {
    const phoneCell = worksheet[`C${row}`];

    if (phoneCell) {
      phoneCell.t = "s";
      phoneCell.v = String(phoneCell.v);
      phoneCell.z = "@";
    }
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Faculty"
  );

  // Generate XLSX file
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  // Create Excel blob
  const blob = new Blob(
    [excelBuffer],
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
  );

  // Download
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "faculty_bulk_upload_template.xlsx";

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
};

const handleBulkUpload = async () => {
  if (!bulkFile) {
    alert(
      "Please select an Excel or CSV file first."
    );

    return;
  }

  try {
    setBulkUploading(true);
    setBulkResult(null);

    const token =
      await getToken();

    const formData =
      new FormData();

    /*
    --------------------------------------------------
    Excel / CSV file
    --------------------------------------------------
    */

    formData.append(
      "file",
      bulkFile
    );

    /*
    --------------------------------------------------
    Send to backend
    --------------------------------------------------
    */

    const response =
      await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/users/bulk-upload-faculty`,
        formData,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    /*
    --------------------------------------------------
    Backend response
    --------------------------------------------------
    */

    const result =
      response.data?.data ||
      {};

    setBulkResult({
      success:
        response.data?.success !== false,

      message:
        response.data?.message ||
        "Bulk upload completed.",

      total:
        result.total || 0,

      created:
        result.created || 0,

      failed:
        result.failed || 0,

      errors:
        result.errors || [],
    });

    /*
    --------------------------------------------------
    Refresh faculty list
    --------------------------------------------------
    */

    await loadFaculty();
  } catch (error) {
    console.error(
      "Bulk faculty upload error:",
      error
    );

    const serverData =
      error.response?.data;

    const serverResult =
      serverData?.data || {};

    setBulkResult({
      success: false,

      message:
        serverData?.message ||
        serverData?.error ||
        "Bulk upload failed.",

      total:
        serverResult.total ||
        0,

      created:
        serverResult.created ||
        0,

      failed:
        serverResult.failed ||
        0,

      errors:
        serverResult.errors ||
        [],
    });
  } finally {
    setBulkUploading(false);
  }
};

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-7">

      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Faculty
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {faculty.length} faculty member
            {faculty.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openBulkUpload}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <span className="text-base leading-none">↑</span>
            Bulk Upload
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="text-lg leading-none">+</span>
            Add Faculty
          </button>
        </div>
      </div>

      {/* TOOLBAR */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">

          {/* SEARCH */}
          <div className="relative min-w-0 flex-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>

            <input
              type="text"
              placeholder="Search name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
            />
          </div>

          {/* DEPARTMENT */}
          <select
            value={departmentFilter}
            onChange={(e) =>
              setDepartmentFilter(e.target.value)
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 sm:w-64"
          >
            {departments.map((department) => (
              <option
                key={department.value}
                value={department.value}
              >
                {department.value
                  ? department.label
                  : "All Departments"}
              </option>
            ))}
          </select>

          {/* DELETE SELECTED */}
          {selectedFaculty.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
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

              {deletingSelected
                ? "Deleting..."
                : `Delete ${selectedFaculty.length}`}
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="h-6 w-6"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>

            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              No faculty found
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              {search || departmentFilter
                ? "Try changing your search or filter."
                : "Add your first faculty member to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">

              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">

                  {/* SELECT */}
                  <th className="w-12 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900"
                    />
                  </th>

                  {/* SL NO */}
                  <th className="w-12 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    #
                  </th>

                  {/* FACULTY */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Faculty
                  </th>

                  {/* CONTACT */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Contact
                  </th>

                  {/* DEPARTMENT */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Department
                  </th>

                  {/* ACTION */}
                  <th className="w-28 px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">

                {filteredFaculty.map((user, index) => {
                  const selected = selectedFaculty.includes(
                    user._id
                  );

                  return (
                    <tr
                      key={user._id}
                      className={`transition ${
                        selected
                          ? "bg-slate-50"
                          : "hover:bg-slate-50/70"
                      }`}
                    >

                      {/* CHECKBOX */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            toggleSelectFaculty(user._id)
                          }
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900"
                        />
                      </td>

                      {/* SL NO */}
                      <td className="px-2 py-3 text-sm font-medium text-slate-400">
                        {index + 1}
                      </td>

                      {/* FACULTY */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">

                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                            <img
                              src={
                                user.imageUrl ||
                                "/default-avatar.png"
                              }
                              alt={user.name || "Faculty"}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display =
                                  "none";
                              }}
                            />
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {user.name}
                            </p>

                            <p className="mt-0.5 truncate text-xs text-slate-400">
                              Faculty · Staff
                            </p>
                          </div>

                        </div>
                      </td>

                      {/* CONTACT */}
                      <td className="px-3 py-3">
                        <div className="max-w-[230px]">
                          <p className="truncate text-sm text-slate-600">
                            {user.email}
                          </p>

                          {user.phone ? (
                            <p className="mt-0.5 text-xs text-slate-400">
                              {user.phone}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-slate-300">
                              No phone
                            </p>
                          )}
                        </div>
                      </td>

                      {/* DEPARTMENT */}
                      <td className="px-3 py-3">
                        <span className="inline-flex max-w-[190px] truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                          {getDepartmentName(
                            user.department
                          )}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-1.5">

                          {/* EDIT */}
                          <button
                            onClick={() =>
                              openEditModal(user)
                            }
                            title="Edit"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="h-4 w-4"
                            >
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
                            </svg>
                          </button>

                          {/* DELETE */}
                          <button
                            onClick={() =>
                              handleDelete(user)
                            }
                            title="Delete"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 text-red-400 transition hover:bg-red-50 hover:text-red-600"
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
                })}

              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SELECTION FOOTER */}
      {selectedFaculty.length > 0 && (
        <div className="mt-3 flex items-center justify-between px-1">
          <p className="text-xs font-medium text-slate-500">
            {selectedFaculty.length} faculty member
            {selectedFaculty.length !== 1 ? "s" : ""} selected
          </p>

          <button
            onClick={() => setSelectedFaculty([])}
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={closeBulkUpload}
          />

          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Bulk Upload Faculty.............
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Upload multiple faculty accounts using Excel or CSV.
                </p>
              </div>

              <button
                type="button"
                onClick={closeBulkUpload}
                disabled={bulkUploading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Step 1 — Download template
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Required columns: Name, Email, Phone, Department.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={downloadBulkTemplate}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                  >
                    Download Template
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-semibold text-slate-800">
                  Step 2 — Select file
                </p>

                <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:border-slate-400 hover:bg-slate-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="mb-2 h-7 w-7 text-slate-400"
                  >
                    <path d="M12 3v12" />
                    <path d="m7 8 5-5 5 5" />
                    <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                  </svg>

                  <span className="text-sm font-semibold text-slate-600">
                    {bulkFile ? bulkFile.name : "Choose Excel or CSV file"}
                  </span>

                  <span className="mt-1 text-xs text-slate-400">
                    .xlsx, .xls or .csv · Maximum 10 MB
                  </span>

                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleBulkFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-800">
                  Department values
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Use: at, ch, ce, cs, ec, ee, me, ps or sc.
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-700">
                  All uploaded accounts will automatically get the role
                  <strong> staff</strong>.
                </p>
              </div>

              {bulkResult && (
                <div
                  className={`rounded-xl border p-4 ${
                    bulkResult.success
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <p
                    className={`text-sm font-semibold ${
                      bulkResult.success
                        ? "text-emerald-800"
                        : "text-red-800"
                    }`}
                  >
                    {bulkResult.message || "Upload completed."}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-[11px] text-slate-400">Created</p>
                      <p className="mt-1 text-lg font-bold text-emerald-700">
                        {bulkResult.created || 0}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-[11px] text-slate-400">Failed</p>
                      <p className="mt-1 text-lg font-bold text-red-600">
                        {bulkResult.failed || 0}
                      </p>
                    </div>

                    <div className="rounded-lg bg-white/70 p-3">
                      <p className="text-[11px] text-slate-400">Total</p>
                      <p className="mt-1 text-lg font-bold text-slate-800">
                        {(bulkResult.created || 0) +
                          (bulkResult.failed || 0)}
                      </p>
                    </div>
                  </div>

                  {Array.isArray(bulkResult.errors) &&
                    bulkResult.errors.length > 0 && (
                      <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-red-100 bg-white">
                        <div className="divide-y divide-slate-100">
                          {bulkResult.errors.map((item, index) => (
                            <div
                              key={index}
                              className="px-3 py-2 text-xs text-red-700"
                            >
                              <strong>
                                {item.row
                                  ? `Row ${item.row}: `
                                  : ""}
                              </strong>
                              {item.message || item.error || "Invalid row"}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeBulkUpload}
                  disabled={bulkUploading}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || !bulkFile}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkUploading ? "Uploading..." : "Upload Faculty"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={closeModal}
          />

          <div className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">

            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {editingFaculty
                    ? "Edit Faculty"
                    : "Add Faculty"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  {editingFaculty
                    ? "Update account information."
                    : "Create a new faculty account."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>

            </div>

            {/* FORM */}
            <form
              onSubmit={handleSubmit}
              className="space-y-4 p-5"
            >

              {/* NAME */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Full Name
                </label>

                <input
                  type="text"
                  name="name"
                  placeholder="Enter faculty name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
              </div>

              {/* EMAIL */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Email Address
                </label>

                <input
                  type="email"
                  name="email"
                  placeholder="faculty@example.com"
                  value={form.email}
                  onChange={handleChange}
                  required
                  disabled={!!editingFaculty}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />

                {editingFaculty && (
                  <p className="mt-1.5 text-[11px] text-slate-400">
                    Email cannot be changed.
                  </p>
                )}
              </div>

              {/* PHONE + DEPARTMENT */}
              <div className="grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Phone
                  </label>

                  <input
                    type="text"
                    name="phone"
                    placeholder="Phone number"
                    value={form.phone}
                    onChange={handleChange}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Department
                  </label>

                  <select
                    name="department"
                    value={form.department}
                    onChange={handleChange}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  >
                    {departments.map((department) => (
                      <option
                        key={department.value}
                        value={department.value}
                      >
                        {department.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              {/* IMAGE */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Profile Photo
                </label>

                <div className="flex items-center gap-3">

                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          className="h-6 w-6"
                        >
                          <circle
                            cx="12"
                            cy="8"
                            r="3"
                          />
                          <path d="M5 21a7 7 0 0 1 14 0" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <label className="flex h-11 min-w-0 flex-1 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-500 transition hover:border-slate-400 hover:bg-slate-100">
                    <span className="truncate">
                      {form.image
                        ? form.image.name
                        : "Choose profile image"}
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>

                </div>
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingFaculty
                    ? "Save Changes"
                    : "Add Faculty"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}