"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import * as XLSX from "xlsx";

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
];

const getDepartmentName = (value) => {
  return (
    departments.find(
      (department) => department.value === value
    )?.label || value
  );
};

export default function SubjectsPage() {
  const { getToken } = useAuth();

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");

  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const [editingSubject, setEditingSubject] = useState(null);

  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    code: "",
    name: "",
    semester: "",
    department: "",
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // =====================================================
  // FETCH SUBJECTS
  // =====================================================

  const fetchSubjects = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/subjects/getsubjects`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setSubjects(response.data?.data || []);
      setSelectedSubjects([]);
    } catch (error) {
      console.error("Failed to fetch subjects:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to load subjects."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredSubjects = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return subjects.filter((subject) => {
      const matchesSearch =
        !searchText ||
        subject.code?.toLowerCase().includes(searchText) ||
        subject.name?.toLowerCase().includes(searchText);

      const matchesDepartment =
        !departmentFilter ||
        subject.department === departmentFilter;

      const matchesSemester =
        !semesterFilter ||
        String(subject.semester) === semesterFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesSemester
      );
    });
  }, [
    subjects,
    search,
    departmentFilter,
    semesterFilter,
  ]);

  // =====================================================
  // SELECTION
  // =====================================================

  const isAllSelected =
    filteredSubjects.length > 0 &&
    filteredSubjects.every((subject) =>
      selectedSubjects.includes(subject._id)
    );

  const toggleSelectSubject = (id) => {
    setSelectedSubjects((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedSubjects((previous) =>
        previous.filter(
          (id) =>
            !filteredSubjects.some(
              (subject) => subject._id === id
            )
        )
      );
    } else {
      setSelectedSubjects((previous) => {
        const ids = filteredSubjects.map(
          (subject) => subject._id
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

  // =====================================================
  // FORM
  // =====================================================

  const handleFormChange = (e) => {
    setForm((previous) => ({
      ...previous,
      [e.target.name]: e.target.value,
    }));
  };

  const openAddModal = () => {
    setEditingSubject(null);

    setForm({
      code: "",
      name: "",
      semester: "",
      department: "",
    });

    setShowAddModal(true);
  };

  const openEditModal = (subject) => {
    setEditingSubject(subject);

    setForm({
      code: subject.code || "",
      name: subject.name || "",
      semester: subject.semester || "",
      department: subject.department || "",
    });

    setShowAddModal(true);
  };

  const closeAddModal = () => {
    if (saving) return;

    setShowAddModal(false);
    setEditingSubject(null);
  };

  // =====================================================
  // ADD / UPDATE
  // =====================================================

  const handleSaveSubject = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const token = await getToken();

      if (editingSubject) {
        await axios.put(
          `${API_URL}/api/subjects/updatesubject/${editingSubject._id}`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        await axios.post(
          `${API_URL}/api/subjects/addsubject`,
          form,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      }

      closeAddModal();
      await fetchSubjects();
    } catch (error) {
      console.error("Save subject error:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to save subject."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE SINGLE
  // =====================================================

  const handleDelete = async (subject) => {
    const confirmed = window.confirm(
      `Delete "${subject.code} - ${subject.name}"?`
    );

    if (!confirmed) return;

    try {
      const token = await getToken();

      await axios.delete(
        `${API_URL}/api/subjects/deletesubject/${subject._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      await fetchSubjects();
    } catch (error) {
      console.error("Delete subject error:", error);

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete subject."
      );
    }
  };

  // =====================================================
  // DELETE SELECTED
  // =====================================================

  const handleDeleteSelected = async () => {
    if (selectedSubjects.length === 0) return;

    const selected = subjects.filter((subject) =>
      selectedSubjects.includes(subject._id)
    );

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selected.length} selected subject${
        selected.length !== 1 ? "s" : ""
      }?`
    );

    if (!confirmed) return;

    try {
      setDeletingSelected(true);

      const token = await getToken();

      await Promise.all(
        selected.map((subject) =>
          axios.delete(
            `${API_URL}/api/subjects/deletesubject/${subject._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          )
        )
      );

      await fetchSubjects();
    } catch (error) {
      console.error(
        "Bulk subject delete error:",
        error
      );

      alert(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to delete selected subjects."
      );
    } finally {
      setDeletingSelected(false);
    }
  };

  // =====================================================
  // BULK UPLOAD
  // =====================================================

  const openBulkModal = () => {
    setSelectedFile(null);
    setUploadResult(null);
    setShowBulkModal(true);
  };

  const closeBulkModal = () => {
    if (uploading) return;

    setShowBulkModal(false);
    setSelectedFile(null);
    setUploadResult(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      alert("Please select a CSV file.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("File size must be less than 5 MB.");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setUploadResult(null);
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) {
      alert("Please select a CSV file first.");
      return;
    }

    try {
      setUploading(true);
      setUploadResult(null);

      const token = await getToken();

      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await axios.post(
        `${API_URL}/api/subjects/bulk-upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setUploadResult(response.data);

      await fetchSubjects();
    } catch (error) {
      console.error("Bulk upload error:", error);

      setUploadResult({
        success: false,
        message:
          error.response?.data?.message ||
          "Bulk upload failed.",
      });
    } finally {
      setUploading(false);
    }
  };

  // =====================================================
  // DOWNLOAD TEMPLATE
  // =====================================================

  const downloadTemplate = () => {
    const csv =
      "code,name,semester,department\n" +
      "CS301,Data Structures,3,cs\n" +
      "CS302,Database Management Systems,3,cs\n" +
      "EC301,Digital Electronics,3,ec\n";

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "subjects_template.csv";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  };

    // =====================================================
  // DOWNLOAD SUBJECTS TO EXCEL
  // =====================================================

  const downloadSubjectsExcel = () => {
    const exportData = filteredSubjects.map(
      (subject, index) => ({
        "Sl No": index + 1,
        "Subject Code": subject.code || "",
        "Subject Name": subject.name || "",
        Semester: subject.semester || "",
        Department: getDepartmentName(
          subject.department
        ),
        "Department Code":
          subject.department || "",
      })
    );

    if (exportData.length === 0) {
      alert("There are no subjects to download.");
      return;
    }

    const worksheet =
      XLSX.utils.json_to_sheet(exportData);

    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 18 },
      { wch: 40 },
      { wch: 12 },
      { wch: 32 },
      { wch: 18 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Subjects"
    );

    XLSX.writeFile(
      workbook,
      "subjects_list.xlsx"
    );
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-5 sm:px-6 lg:px-7">

      {/* HEADER */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Subjects
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {subjects.length} subject
            {subjects.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">

          <button
            onClick={openBulkModal}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M12 16V4" />
              <path d="m7 9 5-5 5 5" />
              <path d="M5 20h14" />
            </svg>

            Bulk Upload
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <span className="text-lg leading-none">
              +
            </span>

            Add Subject
          </button>

        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">

        <div className="flex flex-col gap-3 lg:flex-row">

          {/* SEARCH */}
          <div className="relative min-w-0 flex-1">

            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search code or subject..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
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

          {/* SEMESTER */}
          <select
            value={semesterFilter}
            onChange={(e) =>
              setSemesterFilter(e.target.value)
            }
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100 sm:w-40"
          >
            <option value="">
              All Semesters
            </option>

            {[1, 2, 3, 4, 5, 6, 7, 8].map(
              (semester) => (
                <option
                  key={semester}
                  value={semester}
                >
                  Semester {semester}
                </option>
              )
            )}
          </select>

          {/* DELETE SELECTED */}
          {selectedSubjects.length > 0 && (
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
                : `Delete ${selectedSubjects.length}`}
            </button>
          )}

        </div>
            </div>
      {/* SUBJECT COUNT + EXCEL DOWNLOAD */}
      <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">

        <p className="text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-700">
            {filteredSubjects.length}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-700">
            {subjects.length}
          </span>{" "}
          subject
          {subjects.length !== 1 ? "s" : ""}
        </p>

        <button
          type="button"
          onClick={downloadSubjectsExcel}
          disabled={filteredSubjects.length === 0}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
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
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {loading ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : filteredSubjects.length === 0 ? (

          <div className="flex min-h-60 flex-col items-center justify-center px-6 text-center">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
              📚
            </div>

            <h3 className="mt-3 text-sm font-semibold text-slate-900">
              No subjects found
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              {search ||
              departmentFilter ||
              semesterFilter
                ? "Try changing your filters."
                : "Add a subject or upload them in bulk."}
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

                  {/* CODE */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Code
                  </th>

                  {/* SUBJECT */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Subject
                  </th>

                  {/* SEMESTER */}
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Sem
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

                {filteredSubjects.map(
                  (subject, index) => {

                    const selected =
                      selectedSubjects.includes(
                        subject._id
                      );

                    return (
                      <tr
                        key={subject._id}
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
                              toggleSelectSubject(
                                subject._id
                              )
                            }
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900"
                          />
                        </td>

                        {/* SL NO */}
                        <td className="px-2 py-3 text-sm font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* CODE */}
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                            {subject.code}
                          </span>
                        </td>

                        {/* SUBJECT */}
                        <td className="px-3 py-3">
                          <p className="max-w-[280px] truncate text-sm font-semibold text-slate-900">
                            {subject.name}
                          </p>
                        </td>

                        {/* SEMESTER */}
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            {subject.semester}
                          </span>
                        </td>

                        {/* DEPARTMENT */}
                        <td className="px-3 py-3">
                          <span className="inline-flex max-w-[200px] truncate rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                            {getDepartmentName(
                              subject.department
                            )}
                          </span>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-3 py-3">

                          <div className="flex justify-end gap-1.5">

                            {/* EDIT */}
                            <button
                              onClick={() =>
                                openEditModal(
                                  subject
                                )
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
                                handleDelete(
                                  subject
                                )
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
                  }
                )}

              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SELECTION FOOTER */}
      {selectedSubjects.length > 0 && (
        <div className="mt-3 flex items-center justify-between px-1">

          <p className="text-xs font-medium text-slate-500">
            {selectedSubjects.length} subject
            {selectedSubjects.length !== 1
              ? "s"
              : ""}{" "}
            selected
          </p>

          <button
            onClick={() => setSelectedSubjects([])}
            className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            Clear selection
          </button>

        </div>
      )}

      {/* =====================================================
          ADD / EDIT MODAL
      ===================================================== */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={closeAddModal}
          />

          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {editingSubject
                    ? "Edit Subject"
                    : "Add Subject"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Enter subject details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            {/* FORM */}
            <form
              onSubmit={handleSaveSubject}
              className="space-y-4 p-5"
            >

              {/* CODE + SEMESTER */}
              <div className="grid gap-4 sm:grid-cols-2">

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Subject Code
                  </label>

                  <input
                    name="code"
                    value={form.code}
                    onChange={handleFormChange}
                    placeholder="CS301"
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm uppercase outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Semester
                  </label>

                  <select
                    name="semester"
                    value={form.semester}
                    onChange={handleFormChange}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                  >
                    <option value="">
                      Select semester
                    </option>

                    {[1, 2, 3, 4, 5, 6, 7, 8].map(
                      (semester) => (
                        <option
                          key={semester}
                          value={semester}
                        >
                          Semester {semester}
                        </option>
                      )
                    )}
                  </select>
                </div>

              </div>

              {/* NAME */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Subject Name
                </label>

                <input
                  name="name"
                  value={form.name}
                  onChange={handleFormChange}
                  placeholder="Data Structures"
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
              </div>

              {/* DEPARTMENT */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Department
                </label>

                <select
                  name="department"
                  value={form.department}
                  onChange={handleFormChange}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm outline-none transition focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department.value}
                        value={department.value}
                      >
                        {department.label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* BUTTONS */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">

                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingSubject
                    ? "Save Changes"
                    : "Add Subject"}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}

      {/* =====================================================
          BULK UPLOAD MODAL
      ===================================================== */}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={closeBulkModal}
          />

          <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

            {/* HEADER */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Bulk Upload
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Import subjects using a CSV file.
                </p>
              </div>

              <button
                onClick={closeBulkModal}
                disabled={uploading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                ✕
              </button>

            </div>

            <div className="space-y-4 p-5">

              {/* CSV INFO */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">

                <p className="text-sm font-semibold text-blue-900">
                  CSV format
                </p>

                <p className="mt-1 text-xs leading-5 text-blue-700">
                  Required columns:
                  <span className="font-semibold">
                    {" "}
                    code, name, semester, department
                  </span>
                </p>

              </div>

              {/* FILE */}
              <label
                htmlFor="subject-csv"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition ${
                  selectedFile
                    ? "border-slate-300 bg-slate-50"
                    : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">

                  <svg
                    className="h-5 w-5 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>

                </div>

                {selectedFile ? (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {selectedFile.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {(
                        selectedFile.size / 1024
                      ).toFixed(1)}{" "}
                      KB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      Click to select CSV
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      Maximum 5 MB
                    </p>
                  </>
                )}

                <input
                  id="subject-csv"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

              </label>

              {/* TEMPLATE */}
              <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">

                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700">
                    Need a template?
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Download the sample CSV.
                  </p>
                </div>

                <button
                  onClick={downloadTemplate}
                  className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Download
                </button>

              </div>

              {/* RESULT */}
              {uploadResult && (
                <div
                  className={`rounded-xl border p-4 ${
                    uploadResult.success
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-red-100 bg-red-50"
                  }`}
                >

                  {uploadResult.success ? (
                    <>
                      <p className="text-sm font-semibold text-emerald-800">
                        Upload completed
                      </p>

                      {uploadResult.summary && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">

                          <div className="rounded-lg bg-white p-2">
                            <p className="text-lg font-bold text-slate-900">
                              {
                                uploadResult
                                  .summary
                                  .totalRows
                              }
                            </p>

                            <p className="text-[10px] uppercase text-slate-400">
                              Total
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-2">
                            <p className="text-lg font-bold text-emerald-600">
                              {
                                uploadResult
                                  .summary
                                  .inserted
                              }
                            </p>

                            <p className="text-[10px] uppercase text-slate-400">
                              Added
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-2">
                            <p className="text-lg font-bold text-red-600">
                              {
                                uploadResult
                                  .summary
                                  .failed
                              }
                            </p>

                            <p className="text-[10px] uppercase text-slate-400">
                              Failed
                            </p>
                          </div>

                        </div>
                      )}

                      {uploadResult.errors?.length >
                        0 && (
                        <div className="mt-3 max-h-36 overflow-y-auto rounded-lg bg-white p-3">

                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Errors
                          </p>

                          <div className="space-y-1.5">
                            {uploadResult.errors.map(
                              (error, index) => (
                                <p
                                  key={index}
                                  className="text-xs text-red-600"
                                >
                                  {error.row && (
                                    <span className="font-bold">
                                      Row {error.row}:{" "}
                                    </span>
                                  )}

                                  {error.message}
                                </p>
                              )
                            )}
                          </div>

                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm font-semibold text-red-700">
                      {uploadResult.message}
                    </p>
                  )}

                </div>
              )}

              {/* FOOTER */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">

                <button
                  onClick={closeBulkModal}
                  disabled={uploading}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Close
                </button>

                {!uploadResult?.success && (
                  <button
                    onClick={handleBulkUpload}
                    disabled={
                      !selectedFile || uploading
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Uploading...
                      </>
                    ) : (
                      "Upload Subjects"
                    )}
                  </button>
                )}

                {uploadResult?.success && (
                  <button
                    onClick={closeBulkModal}
                    className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Done
                  </button>
                )}

              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}