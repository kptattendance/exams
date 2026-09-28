"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

const genders = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

const statuses = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "passed", label: "Passed" },
  { value: "detained", label: "Detained" },
  { value: "discontinued", label: "Discontinued" },
  { value: "transferred", label: "Transferred" },
];

const emptyForm = {
  rollNumber: "",
  registerNumber: "",
  name: "",
  fatherName: "",
  motherName: "",
  dob: "",
  gender: "",
  email: "",
  phone: "",
  parentPhone: "",
  caste: "",
  category: "",
  aadhaarNumber: "",
  satsNumber: "",
  department: "",
  admissionYear: "",
  batch: "",
  batchNumber: "",
  semester: "",
  status: "active",
};

const getDepartmentName = (value) => {
  return (
    departments.find(
      (item) =>
        item.value ===
        value?.trim().toLowerCase()
    )?.label ||
    value ||
    "—"
  );
};

const getStatusName = (value) => {
  return (
    statuses.find(
      (item) => item.value === value
    )?.label ||
    value ||
    "—"
  );
};

export default function StudentTable({
  onAddStudent,
  onBulkUpload,
}) {
  const { getToken } = useAuth();

  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] =
    useState("");
  const [semesterFilter, setSemesterFilter] =
    useState("");
  const [batchFilter, setBatchFilter] =
    useState("");
  const [statusFilter, setStatusFilter] =
    useState("");

  // View
  const [viewStudent, setViewStudent] =
    useState(null);

  // Edit
  const [editingStudent, setEditingStudent] =
    useState(null);
  const [editForm, setEditForm] =
    useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] =
    useState(null);

  // Selection
  const [selectedStudents, setSelectedStudents] =
    useState([]);
  const [deletingSelected, setDeletingSelected] =
    useState(false);

  // =====================================================
  // TABLE DRAG SCROLL
  // =====================================================

  const tableScrollRef = useRef(null);
  const isDraggingTable = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);

  const handleTableMouseDown = (e) => {
    if (e.button !== 0) return;

    const target = e.target;

    // Do not start table dragging when interacting with controls.
    if (
      target.closest(
        "button, input, select, textarea, option, a, label"
      )
    ) {
      return;
    }

    const container = tableScrollRef.current;
    if (!container) return;

    isDraggingTable.current = true;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = container.scrollLeft;

    container.style.cursor = "grabbing";
    container.style.userSelect = "none";
  };

  const handleTableMouseMove = (e) => {
    if (!isDraggingTable.current) return;

    const container = tableScrollRef.current;
    if (!container) return;

    const distance = e.clientX - dragStartX.current;
    container.scrollLeft =
      dragStartScrollLeft.current - distance;
  };

  const stopTableDragging = () => {
    if (!isDraggingTable.current) return;

    isDraggingTable.current = false;

    const container = tableScrollRef.current;
    if (container) {
      container.style.cursor = "grab";
      container.style.userSelect = "";
    }
  };

  // Messages
  const [message, setMessage] = useState("");
  const [actionError, setActionError] =
    useState("");

const downloadStudentsExcel = () => {
  if (!filteredStudents || filteredStudents.length === 0) {
    alert("No students available to download.");
    return;
  }

  const excelData = filteredStudents.map((student, index) => ({
    "Sl. No.": index + 1,
    "Roll Number": student.rollNumber || "",
    "Register Number": student.registerNumber || "",
    "Name": student.name || "",
    "Father Name": student.fatherName || "",
    "Mother Name": student.motherName || "",
    "Date of Birth": student.dob
      ? new Date(student.dob).toLocaleDateString("en-GB")
      : "",
    "Gender": student.gender || "",
    "Email": student.email || "",
    "Phone": student.phone || "",
    "Parent Phone": student.parentPhone || "",
    "Department": getDepartmentName(student.department),
    "Admission Year": student.admissionYear || "",
    "Batch": student.batch || "",
    "Batch Number": student.batchNumber || "",
    "Semester": student.semester || "",
    "Status": getStatusName(student.status),
    "Caste": student.caste || "",
    "Category": student.category || "",
    "Aadhaar Number": student.aadhaarNumber || "",
    "SATS Number": student.satsNumber || "",
    "Image URL": student.imageUrl || "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Students"
  );

  XLSX.writeFile(
    workbook,
    `Students_${new Date().toISOString().split("T")[0]}.xlsx`
  );
};


  // =====================================================
  // FETCH STUDENTS
  // =====================================================

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

      setStudents(
        Array.isArray(response.data?.data)
          ? response.data.data
          : []
      );
    } catch (err) {
      console.error(
        "Fetch students error:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Failed to load students."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // =====================================================
  // BATCH LIST
  // =====================================================

  const batches = useMemo(() => {
    return [
      ...new Set(
        students
          .map((student) => student.batch)
          .filter(Boolean)
      ),
    ].sort();
  }, [students]);

  // =====================================================
  // FILTER
  // =====================================================

  const filteredStudents = useMemo(() => {
    const text =
      search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !text ||
        student.name
          ?.toLowerCase()
          .includes(text) ||
        student.rollNumber
          ?.toLowerCase()
          .includes(text) ||
        student.registerNumber
          ?.toLowerCase()
          .includes(text) ||
        student.email
          ?.toLowerCase()
          .includes(text) ||
        student.satsNumber
          ?.toLowerCase()
          .includes(text);

      const matchesDepartment =
        !departmentFilter ||
        student.department ===
          departmentFilter;

      const matchesSemester =
        !semesterFilter ||
        String(student.semester) ===
          String(semesterFilter);

      const matchesBatch =
        !batchFilter ||
        String(student.batch) ===
          String(batchFilter);

      const matchesStatus =
        !statusFilter ||
        student.status === statusFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesSemester &&
        matchesBatch &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    departmentFilter,
    semesterFilter,
    batchFilter,
    statusFilter,
  ]);

  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  const clearFilters = () => {
    setSearch("");
    setDepartmentFilter("");
    setSemesterFilter("");
    setBatchFilter("");
    setStatusFilter("");
  };

  // =====================================================
  // SELECT
  // =====================================================

  const filteredIds = filteredStudents.map(
    (student) => student._id
  );

  const allSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((student) =>
      selectedStudents.includes(student._id)
    );

  const toggleStudent = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedStudents((prev) =>
        prev.filter(
          (id) => !filteredIds.includes(id)
        )
      );
    } else {
      setSelectedStudents((prev) => [
        ...prev,
        ...filteredIds.filter(
          (id) => !prev.includes(id)
        ),
      ]);
    }
  };

  // =====================================================
  // VIEW
  // =====================================================

  const handleView = async (student) => {
    try {
      setActionError("");

      const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/students/${student._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setViewStudent(
        response.data?.data || student
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Failed to load student details."
      );
    }
  };

  // =====================================================
  // EDIT
  // =====================================================

  const handleEdit = async (student) => {
    try {
      setActionError("");

      const token = await getToken();

      const response = await axios.get(
        `${API_URL}/api/students/${student._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data =
        response.data?.data || student;

      setEditingStudent(data);

      setEditForm({
        rollNumber: data.rollNumber || "",
        registerNumber:
          data.registerNumber || "",

        name: data.name || "",

        fatherName:
          data.fatherName || "",

        motherName:
          data.motherName || "",

        dob: data.dob
          ? new Date(data.dob)
              .toISOString()
              .split("T")[0]
          : "",

        gender: data.gender || "",

        email: data.email || "",

        phone: data.phone || "",

        parentPhone:
          data.parentPhone || "",

        caste: data.caste || "",

        category:
          data.category || "",

        aadhaarNumber:
          data.aadhaarNumber || "",

        satsNumber:
          data.satsNumber || "",

        department:
          data.department || "",

        admissionYear:
          data.admissionYear || "",

        batch: data.batch || "",

        batchNumber:
          data.batchNumber || "",

        semester:
          data.semester || "",

        status:
          data.status || "active",
      });
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Failed to load student."
      );
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setActionError("");
      setMessage("");

      const token = await getToken();

      // IMPORTANT:
      // registerNumber and email are intentionally
      // NOT sent because they cannot be edited.

      const payload = {
        rollNumber: editForm.rollNumber.trim(),
        name: editForm.name.trim(),

        fatherName:
          editForm.fatherName.trim(),

        motherName:
          editForm.motherName.trim(),

        dob: editForm.dob,

        gender: editForm.gender,

        phone:
          editForm.phone.trim(),

        parentPhone:
          editForm.parentPhone.trim(),

        caste:
          editForm.caste.trim(),

        category:
          editForm.category.trim(),

        aadhaarNumber:
          editForm.aadhaarNumber.trim(),

        satsNumber:
          editForm.satsNumber.trim(),

        department:
          editForm.department,

        admissionYear:
          Number(editForm.admissionYear),

        batch:
          editForm.batch.trim(),

        batchNumber:
          Number(editForm.batchNumber),

        semester:
          Number(editForm.semester),

        status:
          editForm.status,
      };

      await axios.put(
        `${API_URL}/api/students/${editingStudent._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setEditingStudent(null);

      setMessage(
        "Student updated successfully."
      );

      await fetchStudents();
    } catch (err) {
      console.error(
        "Update student error:",
        err
      );

      setActionError(
        err.response?.data?.message ||
          "Failed to update student."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete = async (student) => {
    const confirmed = window.confirm(
      `Delete ${student.name}?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingId(student._id);
      setActionError("");
      setMessage("");

      const token = await getToken();

      await axios.delete(
        `${API_URL}/api/students/${student._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStudents((prev) =>
        prev.filter(
          (item) =>
            item._id !== student._id
        )
      );

      setSelectedStudents((prev) =>
        prev.filter(
          (id) => id !== student._id
        )
      );

      setMessage(
        "Student deleted successfully."
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Failed to delete student."
      );
    } finally {
      setDeletingId(null);
    }
  };

  // =====================================================
  // BULK DELETE
  // =====================================================

  const handleBulkDelete = async () => {
    if (!selectedStudents.length) return;

    const confirmed = window.confirm(
      `Delete ${selectedStudents.length} selected student(s)?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setDeletingSelected(true);
      setActionError("");
      setMessage("");

      const token = await getToken();

      await axios.delete(
        `${API_URL}/api/students/bulk-delete`,
        {
          data: {
            ids: selectedStudents,
          },
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setStudents((prev) =>
        prev.filter(
          (student) =>
            !selectedStudents.includes(
              student._id
            )
        )
      );

      setSelectedStudents([]);

      setMessage(
        "Selected students deleted successfully."
      );
    } catch (err) {
      setActionError(
        err.response?.data?.message ||
          "Failed to delete selected students."
      );
    } finally {
      setDeletingSelected(false);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-amber-200 bg-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-amber-200 border-t-amber-500" />

          <p className="mt-3 text-sm text-slate-500">
            Loading students...
          </p>
        </div>
      </div>
    );
  }

  // =====================================================
  // ERROR
  // =====================================================

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-8 text-center">
        <p className="font-semibold text-red-600">
          Unable to load students
        </p>

        <p className="mt-2 text-sm text-slate-500">
          {error}
        </p>

        <button
          onClick={fetchStudents}
          className="mt-4 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style jsx>{`
        .student-table-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* =================================================
          MESSAGES
      ================================================= */}

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
          {message}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actionError}
        </div>
      )}

      {/* =================================================
          FILTER BAR
      ================================================= */}

      <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">

        <div className="grid gap-3 xl:grid-cols-5">

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="Search student..."
            className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm outline-none focus:border-amber-500 focus:bg-white"
          />

          <select
            value={departmentFilter}
            onChange={(e) =>
              setDepartmentFilter(
                e.target.value
              )
            }
            className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm outline-none focus:border-amber-500 focus:bg-white"
          >
            <option value="">
              All Departments
            </option>

            {departments.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

          <select
            value={semesterFilter}
            onChange={(e) =>
              setSemesterFilter(
                e.target.value
              )
            }
            className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm outline-none focus:border-amber-500 focus:bg-white"
          >
            <option value="">
              All Semesters
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

          <select
            value={batchFilter}
            onChange={(e) =>
              setBatchFilter(e.target.value)
            }
            className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm outline-none focus:border-amber-500 focus:bg-white"
          >
            <option value="">
              All Batches
            </option>

            {batches.map((batch) => (
              <option
                key={batch}
                value={batch}
              >
                {batch}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
            className="h-10 rounded-xl border border-amber-200 bg-amber-50 px-3 text-sm outline-none focus:border-amber-500 focus:bg-white"
          >
            <option value="">
              All Status
            </option>

            {statuses.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>

        </div>

        <div className="mt-3 flex items-center justify-between">

          <p className="text-xs text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-800">
              {filteredStudents.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-800">
              {students.length}
            </span>{" "}
            students
          </p>

          {(search ||
            departmentFilter ||
            semesterFilter ||
            batchFilter ||
            statusFilter) && (
            <button
              onClick={clearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              Clear filters
            </button>
          )}

        </div>
      </div>

   {/* =================================================
    TABLE
================================================= */}

<div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">

  {/* TABLE HEADER */}
  <div className="flex flex-col gap-3 border-b border-amber-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">

    <div>
      <h2 className="text-base font-bold text-slate-900">
        Students
      </h2>

      <p className="mt-0.5 text-xs text-slate-400">
        {filteredStudents.length} student
        {filteredStudents.length !== 1 ? "s" : ""}
      </p>
    </div>

    <div className="flex flex-wrap gap-2">

      {selectedStudents.length > 0 && (
        <button
          onClick={handleBulkDelete}
          disabled={deletingSelected}
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
        >
          {deletingSelected
            ? "Deleting..."
            : `Delete ${selectedStudents.length}`}
        </button>
      )}

      <button
        onClick={onBulkUpload}
        className="rounded-lg border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-400 hover:bg-amber-50"
      >
        Bulk Upload
      </button>

      <button
        onClick={onAddStudent}
        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600"
      >
        + Add Student
      </button>

      <button
        type="button"
        onClick={downloadStudentsExcel}
        className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
      >
        ↓ Download Excel
      </button>

    </div>
  </div>

  {filteredStudents.length === 0 ? (

    <div className="flex min-h-[280px] items-center justify-center text-center">
      <div>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-xl">
          👤
        </div>

        <h3 className="mt-4 font-semibold text-slate-900">
          No students found
        </h3>

        <p className="mt-1 text-sm text-slate-500">
          Try changing the filters.
        </p>

      </div>
    </div>

  ) : (

    /*
      IMPORTANT:

      The table is intentionally very wide.

      Fixed columns:
        1. Checkbox
        2. #
        3. Student

      Scrollable columns:
        All remaining student information

      Fixed right column:
        Actions
    */
    <div
      ref={tableScrollRef}
      className="student-table-scroll overflow-x-auto"
      onMouseDown={handleTableMouseDown}
      onMouseMove={handleTableMouseMove}
      onMouseUp={stopTableDragging}
      onMouseLeave={stopTableDragging}
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        cursor: "grab",
      }}
    >

      <table className="min-w-[2700px] border-separate border-spacing-0 text-sm">

        {/* =================================================
            TABLE HEADER
        ================================================= */}

        <thead>

          <tr className="bg-amber-500">

            {/* FIXED CHECKBOX */}
            <th
              className="sticky left-0 z-40 w-[48px] min-w-[48px] border-b border-amber-600 bg-amber-500 px-2 py-3 text-center"
            >
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                onMouseDown={(e) => e.stopPropagation()}
                className="h-4 w-4 cursor-pointer accent-amber-700"
              />
            </th>

            {/* FIXED SERIAL NUMBER */}
            <th
              className="sticky left-[48px] z-40 w-[48px] min-w-[48px] border-b border-amber-600 bg-amber-500 px-2 py-3 text-center text-[11px] font-bold uppercase text-white"
            >
              #
            </th>

            {/* FIXED STUDENT */}
            <th
              className="sticky left-[96px] z-40 w-[250px] min-w-[250px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white"
            >
              Student
            </th>

            {/* SCROLLABLE COLUMNS */}

            <th className="w-[115px] min-w-[115px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Roll No.
            </th>

            <th className="w-[135px] min-w-[135px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Register No.
            </th>

            <th className="w-[190px] min-w-[190px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Father Name
            </th>

            <th className="w-[190px] min-w-[190px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Mother Name
            </th>

            <th className="w-[105px] min-w-[105px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              DOB
            </th>

            <th className="w-[85px] min-w-[85px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Gender
            </th>

            <th className="w-[220px] min-w-[220px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Email
            </th>

            <th className="w-[125px] min-w-[125px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Phone
            </th>

            <th className="w-[125px] min-w-[125px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Parent Phone
            </th>

            <th className="w-[120px] min-w-[120px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Caste
            </th>

            <th className="w-[120px] min-w-[120px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Category
            </th>

            <th className="w-[150px] min-w-[150px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Aadhaar
            </th>

            <th className="w-[130px] min-w-[130px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              SATS No.
            </th>

            <th className="w-[190px] min-w-[190px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Department
            </th>

            <th className="w-[120px] min-w-[120px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Admission Year
            </th>

            <th className="w-[120px] min-w-[120px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Batch
            </th>

            <th className="w-[100px] min-w-[100px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-center text-[11px] font-bold uppercase text-white">
              Batch No.
            </th>

            <th className="w-[90px] min-w-[90px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-center text-[11px] font-bold uppercase text-white">
              Sem
            </th>

            <th className="w-[115px] min-w-[115px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-left text-[11px] font-bold uppercase text-white">
              Status
            </th>

            {/* FIXED ACTIONS */}
            <th
              className="sticky right-0 z-40 w-[220px] min-w-[220px] border-b border-amber-600 bg-amber-500 px-3 py-3 text-center text-[11px] font-bold uppercase text-white"
            >
              Actions
            </th>

          </tr>

        </thead>

        {/* =================================================
            TABLE BODY
        ================================================= */}

        <tbody>

          {filteredStudents.map((student, index) => {

            const selected =
              selectedStudents.includes(student._id);

            const rowBackground =
              selected
                ? "bg-amber-50"
                : "bg-white";

            return (

              <tr
                key={student._id}
                className={`group border-b border-amber-100 ${rowBackground} hover:bg-amber-50`}
              >

                {/* =================================================
                    FIXED CHECKBOX
                ================================================= */}

                <td
                  className={`sticky left-0 z-30 w-[48px] min-w-[48px] border-b border-amber-100 px-2 py-2.5 text-center ${rowBackground} group-hover:bg-amber-50`}
                >

                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() =>
                      toggleStudent(student._id)
                    }
                    onMouseDown={(e) =>
                      e.stopPropagation()
                    }
                    className="h-4 w-4 cursor-pointer accent-amber-600"
                  />

                </td>

                {/* =================================================
                    FIXED #
                ================================================= */}

                <td
                  className={`sticky left-[48px] z-30 w-[48px] min-w-[48px] border-b border-amber-100 px-2 py-2.5 text-center text-xs text-slate-400 ${rowBackground} group-hover:bg-amber-50`}
                >
                  {index + 1}
                </td>

                {/* =================================================
                    FIXED STUDENT NAME
                ================================================= */}

                <td
                  className={`sticky left-[96px] z-30 w-[250px] min-w-[250px] border-b border-amber-100 px-3 py-2.5 ${rowBackground} group-hover:bg-amber-50`}
                >

                  <div className="flex items-center gap-2.5">

                    {student.imageUrl ? (

                      <img
                        src={student.imageUrl}
                        alt={student.name || "Student"}
                        className="h-9 w-9 shrink-0 rounded-lg border border-amber-200 object-cover"
                        draggable={false}
                      />

                    ) : (

                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-xs font-bold text-amber-700">
                        {student.name
                          ?.charAt(0)
                          ?.toUpperCase() || "S"}
                      </div>

                    )}

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold text-slate-900">
                        {student.name || "—"}
                      </p>

                      <p className="truncate text-[11px] text-slate-400">
                        {student.email || "—"}
                      </p>

                    </div>

                  </div>

                </td>

                {/* =================================================
                    ROLL NUMBER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5">

                  <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1.5 font-mono text-xs font-semibold text-amber-700">
                    {student.rollNumber || "—"}
                  </span>

                </td>

                {/* =================================================
                    REGISTER NUMBER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5">

                  <span className="inline-flex rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-xs font-semibold text-amber-700">
                    {student.registerNumber || "—"}
                  </span>

                </td>

                {/* =================================================
                    FATHER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.fatherName || "—"}
                </td>

                {/* =================================================
                    MOTHER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.motherName || "—"}
                </td>

                {/* =================================================
                    DOB
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm whitespace-nowrap text-slate-600">
                  {student.dob
                    ? new Date(
                        student.dob
                      ).toLocaleDateString("en-IN")
                    : "—"}
                </td>

                {/* =================================================
                    GENDER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm capitalize text-slate-600">
                  {student.gender || "—"}
                </td>

                {/* =================================================
                    EMAIL
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  <span className="block max-w-[210px] truncate">
                    {student.email || "—"}
                  </span>
                </td>

                {/* =================================================
                    PHONE
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.phone || "—"}
                </td>

                {/* =================================================
                    PARENT PHONE
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.parentPhone || "—"}
                </td>

                {/* =================================================
                    CASTE
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.caste || "—"}
                </td>

                {/* =================================================
                    CATEGORY
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.category || "—"}
                </td>

                {/* =================================================
                    AADHAAR
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 font-mono text-sm text-slate-600">
                  {student.aadhaarNumber || "—"}
                </td>

                {/* =================================================
                    SATS
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 font-mono text-sm text-slate-600">
                  {student.satsNumber || "—"}
                </td>

                {/* =================================================
                    DEPARTMENT
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {getDepartmentName(student.department)}
                </td>

                {/* =================================================
                    ADMISSION YEAR
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.admissionYear || "—"}
                </td>

                {/* =================================================
                    BATCH
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-sm text-slate-600">
                  {student.batch || "—"}
                </td>

                {/* =================================================
                    BATCH NUMBER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-center">

                  <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {student.batchNumber || "—"}
                  </span>

                </td>

                {/* =================================================
                    SEMESTER
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5 text-center">

                  <span className="inline-flex rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    {student.semester
                      ? `Sem ${student.semester}`
                      : "—"}
                  </span>

                </td>

                {/* =================================================
                    STATUS
                ================================================= */}

                <td className="border-b border-amber-100 px-3 py-2.5">

                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      student.status === "active"
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {getStatusName(student.status)}
                  </span>

                </td>

                {/* =================================================
                    FIXED ACTIONS
                ================================================= */}

                <td
                  className={`sticky right-0 z-30 w-[220px] min-w-[220px] border-b border-amber-100 px-3 py-2.5 ${rowBackground} group-hover:bg-amber-50`}
                >

                  <div
                    className="flex items-center justify-center gap-1.5"
                    onMouseDown={(e) =>
                      e.stopPropagation()
                    }
                  >

                    <button
                      type="button"
                      onClick={() =>
                        handleView(student)
                      }
                      className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleEdit(student)
                      }
                      className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDelete(student)
                      }
                      disabled={
                        deletingId === student._id
                      }
                      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      {deletingId === student._id
                        ? "..."
                        : "Delete"}
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
      {/* =================================================
          VIEW MODAL
      ================================================= */}

      {viewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-500/50 p-4 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={() =>
              setViewStudent(null)
            }
          />

          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-100 bg-white px-6 py-4">

              <div className="flex items-center gap-3">

                {viewStudent.imageUrl ? (
                  <img
                    src={
                      viewStudent.imageUrl
                    }
                    alt={viewStudent.name}
                    className="h-12 w-12 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 font-bold text-white">
                    {viewStudent.name
                      ?.charAt(0)
                      ?.toUpperCase() ||
                      "S"}
                  </div>
                )}

                <div>
                  <h2 className="font-bold text-slate-900">
                    {viewStudent.name}
                  </h2>

                  <p className="text-xs text-slate-400">
                    {
                      viewStudent.registerNumber
                    }
                  </p>
                </div>

              </div>

              <button
                onClick={() =>
                  setViewStudent(null)
                }
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-amber-50 hover:text-slate-900"
              >
                ✕
              </button>

            </div>

            <div className="space-y-6 p-6">

              <DetailSection title="Personal Information">

                <Detail
                  label="Full Name"
                  value={viewStudent.name}
                />

                <Detail
                  label="Father Name"
                  value={
                    viewStudent.fatherName
                  }
                />

                <Detail
                  label="Mother Name"
                  value={
                    viewStudent.motherName
                  }
                />

                <Detail
                  label="Date of Birth"
                  value={
                    viewStudent.dob
                      ? new Date(
                          viewStudent.dob
                        ).toLocaleDateString(
                          "en-IN"
                        )
                      : "—"
                  }
                />

                <Detail
                  label="Gender"
                  value={
                    viewStudent.gender
                  }
                />

                <Detail
                  label="Caste"
                  value={
                    viewStudent.caste
                  }
                />

                <Detail
                  label="Category"
                  value={
                    viewStudent.category
                  }
                />

              </DetailSection>

              <DetailSection title="Contact Information">

                <Detail
                  label="Email"
                  value={
                    viewStudent.email
                  }
                />

                <Detail
                  label="Phone"
                  value={
                    viewStudent.phone
                  }
                />

                <Detail
                  label="Parent Phone"
                  value={
                    viewStudent.parentPhone
                  }
                />

              </DetailSection>

              <DetailSection title="Academic Information">

                <Detail
                  label="Roll Number"
                  value={viewStudent.rollNumber}
                />

                <Detail
                  label="Register Number"
                  value={
                    viewStudent.registerNumber
                  }
                />

                <Detail
                  label="Department"
                  value={getDepartmentName(
                    viewStudent.department
                  )}
                />

                <Detail
                  label="Admission Year"
                  value={
                    viewStudent.admissionYear
                  }
                />

                <Detail
                  label="Batch"
                  value={
                    viewStudent.batch
                  }
                />

                <Detail
                  label="Batch Number"
                  value={
                    viewStudent.batchNumber
                  }
                />

                <Detail
                  label="Semester"
                  value={
                    viewStudent.semester
                  }
                />

                <Detail
                  label="Status"
                  value={getStatusName(
                    viewStudent.status
                  )}
                />

              </DetailSection>

              <DetailSection title="Other Information">

                <Detail
                  label="Aadhaar Number"
                  value={
                    viewStudent.aadhaarNumber
                  }
                />

                <Detail
                  label="SATS Number"
                  value={
                    viewStudent.satsNumber
                  }
                />

              </DetailSection>

            </div>

          </div>
        </div>
      )}

      {/* =================================================
          EDIT MODAL
      ================================================= */}

      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-500/50 p-4 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={() =>
              !saving &&
              setEditingStudent(null)
            }
          />

          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-amber-100 bg-white px-6 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Edit Student
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Register number and email cannot be changed. Roll number can be edited.
                </p>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditingStudent(null)
                }
                className="rounded-lg px-3 py-2 text-slate-400 hover:bg-amber-50"
              >
                ✕
              </button>

            </div>

            <form
              onSubmit={handleUpdate}
              className="space-y-6 p-6"
            >

              {/* LOCKED */}
              <div className="grid gap-4 sm:grid-cols-2">

                <ReadOnlyField
                  label="Register Number"
                  value={
                    editForm.registerNumber
                  }
                />

                <ReadOnlyField
                  label="Email"
                  value={editForm.email}
                />

              </div>

              {/* ROLL NUMBER */}
              <EditSection title="Academic Identification">
                <Input
                  label="Roll Number"
                  name="rollNumber"
                  value={editForm.rollNumber}
                  onChange={handleEditChange}
                  required
                />
              </EditSection>

              {/* PERSONAL */}
              <EditSection title="Personal Information">

                <Input
                  label="Full Name"
                  name="name"
                  value={editForm.name}
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Input
                  label="Father Name"
                  name="fatherName"
                  value={
                    editForm.fatherName
                  }
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Input
                  label="Mother Name"
                  name="motherName"
                  value={
                    editForm.motherName
                  }
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Input
                  label="Date of Birth"
                  type="date"
                  name="dob"
                  value={editForm.dob}
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Select
                  label="Gender"
                  name="gender"
                  value={editForm.gender}
                  onChange={
                    handleEditChange
                  }
                  options={genders}
                />

                <Input
                  label="Caste"
                  name="caste"
                  value={editForm.caste}
                  onChange={
                    handleEditChange
                  }
                />

                <Input
                  label="Category"
                  name="category"
                  value={
                    editForm.category
                  }
                  onChange={
                    handleEditChange
                  }
                />

              </EditSection>

              {/* CONTACT */}
              <EditSection title="Contact Information">

                <Input
                  label="Phone"
                  name="phone"
                  value={editForm.phone}
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Input
                  label="Parent Phone"
                  name="parentPhone"
                  value={
                    editForm.parentPhone
                  }
                  onChange={
                    handleEditChange
                  }
                />

              </EditSection>

              {/* ACADEMIC */}
              <EditSection title="Academic Information">

                <Select
                  label="Department"
                  name="department"
                  value={
                    editForm.department
                  }
                  onChange={
                    handleEditChange
                  }
                  options={departments}
                />

                <Input
                  label="Admission Year"
                  type="number"
                  name="admissionYear"
                  value={
                    editForm.admissionYear
                  }
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Input
                  label="Batch"
                  name="batch"
                  value={editForm.batch}
                  onChange={
                    handleEditChange
                  }
                  required
                />

                <Select
                  label="Batch Number"
                  name="batchNumber"
                  value={
                    editForm.batchNumber
                  }
                  onChange={
                    handleEditChange
                  }
                  options={[
                    {
                      value: "1",
                      label: "Batch 1",
                    },
                    {
                      value: "2",
                      label: "Batch 2",
                    },
                  ]}
                />

                <Select
                  label="Semester"
                  name="semester"
                  value={
                    editForm.semester
                  }
                  onChange={
                    handleEditChange
                  }
                  options={[1, 2, 3, 4, 5, 6].map(
                    (value) => ({
                      value: String(value),
                      label: `Semester ${value}`,
                    })
                  )}
                />

                <Select
                  label="Status"
                  name="status"
                  value={editForm.status}
                  onChange={
                    handleEditChange
                  }
                  options={statuses}
                />

              </EditSection>

              {/* OTHER */}
              <EditSection title="Other Information">

                <Input
                  label="Aadhaar Number"
                  name="aadhaarNumber"
                  value={
                    editForm.aadhaarNumber
                  }
                  onChange={
                    handleEditChange
                  }
                />

                <Input
                  label="SATS Number"
                  name="satsNumber"
                  value={
                    editForm.satsNumber
                  }
                  onChange={
                    handleEditChange
                  }
                />

              </EditSection>

              {/* FOOTER */}
              <div className="flex justify-end gap-2 border-t border-amber-100 pt-4">

                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setEditingStudent(null)
                  }
                  className="rounded-xl border border-amber-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-amber-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : "Save Changes"}
                </button>

              </div>

            </form>

          </div>
        </div>
      )}
    </div>
  );
}


// =====================================================
// UI COMPONENTS
// =====================================================

function DetailSection({
  title,
  children,
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-slate-900">
        {title}
      </h3>

      <div className="grid overflow-hidden rounded-xl border border-amber-200 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Detail({
  label,
  value,
}) {
  return (
    <div className="border-b border-amber-100 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-800">
        {value || "—"}
      </p>
    </div>
  );
}

function EditSection({
  title,
  children,
}) {
  return (
    <section>
      <h3 className="mb-3 text-sm font-bold text-slate-900">
        {title}
      </h3>

      <div className="grid gap-4 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function ReadOnlyField({
  label,
  value,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <input
        value={value}
        disabled
        className="h-11 w-full rounded-xl border border-amber-200 bg-amber-50 px-3.5 text-sm text-slate-500"
      />
    </div>
  );
}

function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="h-11 w-full rounded-xl border border-amber-200 bg-amber-50 px-3.5 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
      />
    </div>
  );
}

function Select({
  label,
  name,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        required
        className="h-11 w-full rounded-xl border border-amber-200 bg-amber-50 px-3.5 text-sm outline-none focus:border-amber-500 focus:bg-white focus:ring-4 focus:ring-amber-100"
      >
        <option value="">
          Select {label}
        </option>

        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}