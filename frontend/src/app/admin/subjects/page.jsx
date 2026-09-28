"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import * as XLSX from "xlsx";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// =====================================================
// DEPARTMENTS
// =====================================================

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

const subjectTypes = [
  { value: "IT", label: "IT - Integrated Theory" },
  { value: "IP", label: "IP - Integrated Practical" },
  { value: "I", label: "I - Institutional" },
];

const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

const boards = [
  "SC",
  "EG",
  "ME",
  "AT",
  "CE",
  "CS",
  "EE",
  "CH",
  "EC",
  "PO",
  "KA",
];

const schemeYears = [2025, 2026, 2027, 2028, 2029, 2030];

// =====================================================
// HELPERS
// =====================================================

const getDepartmentName = (value) => {
  return (
    departments.find(
      (department) =>
        department.value === String(value || "").toLowerCase()
    )?.label || value || "-"
  );
};

const getDepartmentShortName = (value) => {
  return String(value || "").toUpperCase();
};

const getSubjectTypeName = (value) => {
  const found = subjectTypes.find(
    (item) =>
      item.value === String(value || "").toUpperCase()
  );

  return found?.label || value || "-";
};

const numberValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  return Number(value);
};

// =====================================================
// MAIN PAGE
// =====================================================

export default function SubjectsPage() {
  const { getToken } = useAuth();

  // =====================================================
  // DATA
  // =====================================================

  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // =====================================================
  // FILTERS
  // =====================================================

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("");
  const [subjectTypeFilter, setSubjectTypeFilter] = useState("");
  const [boardFilter, setBoardFilter] = useState("");
  const [schemeYearFilter, setSchemeYearFilter] = useState("");

  // =====================================================
  // SELECTION
  // =====================================================

  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [deletingSelected, setDeletingSelected] = useState(false);

  // =====================================================
  // MODALS
  // =====================================================

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [editingSubject, setEditingSubject] = useState(null);
  const [viewingSubject, setViewingSubject] = useState(null);

  // =====================================================
  // TABLE SCROLL
  // =====================================================

  const tableScrollRef = useRef(null);

  // =====================================================
  // MOUSE DRAG HORIZONTAL SCROLL
  // =====================================================

  const isDraggingTable = useRef(false);
  const dragStartX = useRef(0);
  const dragStartScrollLeft = useRef(0);
  const dragMoved = useRef(false);

  const handleTablePointerDown = (e) => {
    // Do not start table dragging when clicking controls.
    if (
      e.target.closest(
        "button, input, select, textarea, a"
      )
    ) {
      return;
    }

    const table = tableScrollRef.current;
    if (!table) return;

    isDraggingTable.current = true;
    dragMoved.current = false;
    dragStartX.current = e.clientX;
    dragStartScrollLeft.current = table.scrollLeft;

    table.setPointerCapture?.(e.pointerId);
    table.style.cursor = "grabbing";
    table.style.userSelect = "none";
  };

  const handleTablePointerMove = (e) => {
    const table = tableScrollRef.current;

    if (!table || !isDraggingTable.current) return;

    const distance = e.clientX - dragStartX.current;

    if (Math.abs(distance) > 3) {
      dragMoved.current = true;
    }

    table.scrollLeft =
      dragStartScrollLeft.current - distance;
  };

  const handleTablePointerUp = (e) => {
    const table = tableScrollRef.current;

    if (!table) return;

    isDraggingTable.current = false;

    table.releasePointerCapture?.(e.pointerId);
    table.style.cursor = "grab";
    table.style.userSelect = "";
  };

  const handleTablePointerCancel = (e) => {
    const table = tableScrollRef.current;

    if (!table) return;

    isDraggingTable.current = false;

    table.releasePointerCapture?.(e.pointerId);
    table.style.cursor = "grab";
    table.style.userSelect = "";
  };

  // =====================================================
  // FORM
  // =====================================================
const emptyForm = {
  subjectId: "",
  code: "",
  name: "",
  sequence: "",
  semester: "",
  department: "",

  // REGULAR or BRIDGE
  subjectCategory: "REGULAR",

  subjectType: "",
  board: "",

  iaMax: "",
  iaMin: "",

  theoryExamMax: "",
  theoryExamMin: "",

  practicalExamMax: "",
  practicalExamMin: "",

  totalMax: "",
  totalMin: "",

  credit: "",

  schemeYear: "2025",
};
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // =====================================================
  // BULK UPLOAD
  // =====================================================

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


      setSubjects(response.data?.subjects || []);
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
  // FILTER SUBJECTS
  // =====================================================

  const filteredSubjects = useMemo(() => {
    const searchText = search.trim().toLowerCase();

    return subjects.filter((subject) => {
      const matchesSearch =
        !searchText ||
        subject.sequence
          ?.toLowerCase()
          .includes(searchText) ||
        subject.subjectId
          ?.toLowerCase()
          .includes(searchText) ||
        subject.code
          ?.toLowerCase()
          .includes(searchText) ||
        subject.name
          ?.toLowerCase()
          .includes(searchText) ||
        subject.department
          ?.toLowerCase()
          .includes(searchText) ||
        subject.board
          ?.toLowerCase()
          .includes(searchText);

      const matchesDepartment =
        !departmentFilter ||
        String(subject.department).toLowerCase() ===
          departmentFilter.toLowerCase();

      const matchesSemester =
        !semesterFilter ||
        String(subject.semester) === semesterFilter;

      const matchesSubjectType =
        !subjectTypeFilter ||
        String(subject.subjectType).toUpperCase() ===
          subjectTypeFilter.toUpperCase();

      const matchesBoard =
        !boardFilter ||
        String(subject.board).toUpperCase() ===
          boardFilter.toUpperCase();

      const matchesSchemeYear =
        !schemeYearFilter ||
        String(subject.schemeYear) === schemeYearFilter;

      return (
        matchesSearch &&
        matchesDepartment &&
        matchesSemester &&
        matchesSubjectType &&
        matchesBoard &&
        matchesSchemeYear
      );
    });
  }, [
    subjects,
    search,
    departmentFilter,
    semesterFilter,
    subjectTypeFilter,
    boardFilter,
    schemeYearFilter,
  ]);

  // =====================================================
  // RESET FILTERS
  // =====================================================

  const resetFilters = () => {
    setSearch("");
    setDepartmentFilter("");
    setSemesterFilter("");
    setSubjectTypeFilter("");
    setBoardFilter("");
    setSchemeYearFilter("");
  };

  const hasActiveFilters =
    search ||
    departmentFilter ||
    semesterFilter ||
    subjectTypeFilter ||
    boardFilter ||
    schemeYearFilter;

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
  // FORM CHANGE
  // =====================================================

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =====================================================
  // OPEN ADD
  // =====================================================

  const openAddModal = () => {
    setEditingSubject(null);
    setForm(emptyForm);
    setShowAddModal(true);
  };

  // =====================================================
  // OPEN EDIT
  // =====================================================
const openEditModal = (subject) => {
  setEditingSubject(subject);

  setForm({
    subjectId: subject.subjectId || "",
    code: subject.code || "",
    name: subject.name || "",
    sequence: subject.sequence || "",
    semester: subject.semester || "",
    department: subject.department || "",

    subjectCategory:
      subject.subjectCategory || "REGULAR",

    subjectType: subject.subjectType || "",
    board: subject.board || "",

    iaMax: subject.iaMax ?? "",
    iaMin: subject.iaMin ?? "",

    theoryExamMax:
      subject.theoryExamMax ?? "",
    theoryExamMin:
      subject.theoryExamMin ?? "",

    practicalExamMax:
      subject.practicalExamMax ?? "",
    practicalExamMin:
      subject.practicalExamMin ?? "",

    totalMax: subject.totalMax ?? "",
    totalMin: subject.totalMin ?? "",

    credit: subject.credit ?? "",

    schemeYear: subject.schemeYear || "2025",
  });

  setShowAddModal(true);
};

  // =====================================================
  // CLOSE ADD MODAL
  // =====================================================

  const closeAddModal = () => {
    if (saving) return;

    setShowAddModal(false);
    setEditingSubject(null);
    setForm(emptyForm);
  };

  // =====================================================
  // SAVE SUBJECT
  // =====================================================

  const handleSaveSubject = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);

      const token = await getToken();

     const payload = {
  subjectId: form.subjectId,
  code: form.code,
  name: form.name,
  sequence: form.sequence,

  semester: Number(form.semester),
  department: form.department,

  // IMPORTANT
  subjectCategory: form.subjectCategory,

  subjectType: form.subjectType,
  board: form.board,

  iaMax: Number(form.iaMax) || 0,
  iaMin: Number(form.iaMin) || 0,

  theoryExamMax:
    Number(form.theoryExamMax) || 0,
  theoryExamMin:
    Number(form.theoryExamMin) || 0,

  practicalExamMax:
    Number(form.practicalExamMax) || 0,
  practicalExamMin:
    Number(form.practicalExamMin) || 0,

  totalMax: Number(form.totalMax) || 0,
  totalMin: Number(form.totalMin) || 0,

  credit: Number(form.credit) || 0,

  schemeYear:
    Number(form.schemeYear) || 2025,
};

      if (editingSubject) {
        await axios.put(
          `${API_URL}/api/subjects/updatesubject/${editingSubject._id}`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
      } else {
        await axios.post(
          `${API_URL}/api/subjects/addsubject`,
          payload,
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
  // VIEW DETAILS
  // =====================================================

  const openDetailsModal = (subject) => {
    setViewingSubject(subject);
    setShowDetailsModal(true);
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setViewingSubject(null);
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
  // DOWNLOAD CSV TEMPLATE
  // =====================================================

  const downloadTemplate = () => {
  const csv =
    "subjectId,code,name,sequence,semester,department,subjectCategory,subjectType,board,iaMax,iaMin,theoryExamMax,theoryExamMin,practicalExamMax,practicalExamMin,totalMax,totalMin,credit,schemeYear\n" +

    // REGULAR SUBJECT
    "25SC11T0,25SC11T0,Engineering Mathematics-I,1CS01,1,cs,REGULAR,IT,SC,50,20,50,20,0,0,100,40,6,2025\n" +

    // REGULAR SUBJECT
    "25CS010P,25CS010P,IT Skills,1CS02,1,cs,REGULAR,IP,CS,50,20,0,0,50,20,100,40,5,2025\n" +

    // REGULAR SUBJECT
    "25EE010P,25EE010P,Fundamentals of Electrical and Electronics Engineering,1CS03,1,cs,REGULAR,IP,EE,50,20,0,0,50,20,100,40,5,2025\n" +

    // REGULAR SUBJECT
    "25CS11T0,25CS11T0,Basics of Digital Logic and Computer Organization,1CS04,1,cs,REGULAR,IT,CS,50,20,50,20,0,0,100,40,6,2025\n" +

    // REGULAR SUBJECT
    "25CE1100,25CE1100,Environmental Sustainability,1CS05,1,cs,REGULAR,I,CE,50,20,0,0,0,0,50,20,2,2025\n" +

    // BRIDGE SUBJECT EXAMPLE
    "25AT340PA,25AT340PA,Engineering Mathematics-I Bridge Course,3AT01,3,at,BRIDGE,IT,AT,50,20,50,20,0,0,100,40,6,2025\n";

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
  // DOWNLOAD EXCEL
  // =====================================================

  const downloadSubjectsExcel = () => {
    const exportData = filteredSubjects.map(
      (subject, index) => ({
        "Sl No": index + 1,

        Sequence: subject.sequence || "",

        "Subject ID":
          subject.subjectId || "",

        "Subject Code":
          subject.code || "",

        "Subject Name":
          subject.name || "",

        Semester:
          subject.semester || "",

        "Department Code":
          getDepartmentShortName(
            subject.department
          ),

        Department:
          getDepartmentName(
            subject.department
          ),
"Subject Category":
  subject.subjectCategory || "REGULAR",
        "Subject Type":
          subject.subjectType || "",

        "Subject Type Name":
          getSubjectTypeName(
            subject.subjectType
          ),

        Board:
          subject.board || "",

        "IA Max":
          subject.iaMax ?? 0,

        "IA Min":
          subject.iaMin ?? 0,

        "Theory Exam Max":
          subject.theoryExamMax ?? 0,

        "Theory Exam Min":
          subject.theoryExamMin ?? 0,

        "Practical Exam Max":
          subject.practicalExamMax ?? 0,

        "Practical Exam Min":
          subject.practicalExamMin ?? 0,

        "Total Max":
          subject.totalMax ?? 0,

        "Total Min":
          subject.totalMin ?? 0,

        Credit:
          subject.credit ?? 0,

        "Scheme Year":
          subject.schemeYear || "",
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
      { wch: 15 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 50 },
      { wch: 10 },
      { wch: 15 },
      { wch: 32 },
      { wch: 14 },
      { wch: 28 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
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
    <div className="min-h-screen bg-amber-50/30 px-3 py-4 sm:px-5 lg:px-7">

      <style jsx global>{`
        .subjects-table-drag {
          scrollbar-width: none;
          -ms-overflow-style: none;
          cursor: grab;
        }

        .subjects-table-drag::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .subjects-table-drag:active {
          cursor: grabbing;
        }
      `}</style>

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
              >
                <path d="M4 5h16v14H4z" />
                <path d="M8 9h8" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Subjects
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                Manage syllabus subjects, marks,
                credits and sequence
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">

          {/* BULK UPLOAD */}

          <button
            onClick={openBulkModal}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50"
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

          {/* ADD */}

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
          >
            <span className="text-lg leading-none">
              +
            </span>

            Add Subject
          </button>
        </div>
      </div>

      {/* =================================================
          FILTER PANEL
      ================================================= */}

      <div className="mb-4 rounded-2xl border border-amber-100 bg-white p-3 shadow-sm">

        <div className="mb-3 flex items-center justify-between">

          <div>
            <p className="text-sm font-bold text-slate-800">
              Filters
            </p>

            <p className="text-xs text-slate-400">
              Search and filter the syllabus
            </p>
          </div>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-amber-600 hover:text-amber-700"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">

          {/* SEARCH */}

          <div className="relative xl:col-span-2">

            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <circle
                cx="11"
                cy="11"
                r="7"
              />
              <path d="m20 20-4-4" />
            </svg>

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search subject, code, ID or sequence..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
            />
          </div>

          {/* DEPARTMENT */}

          <select
            value={departmentFilter}
            onChange={(e) =>
              setDepartmentFilter(e.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
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
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
          >
            <option value="">
              All Semesters
            </option>

            {semesters.map((semester) => (
              <option
                key={semester}
                value={semester}
              >
                Semester {semester}
              </option>
            ))}
          </select>

          {/* SUBJECT TYPE */}

          <select
            value={subjectTypeFilter}
            onChange={(e) =>
              setSubjectTypeFilter(e.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
          >
            <option value="">
              All Types
            </option>

            {subjectTypes.map((type) => (
              <option
                key={type.value}
                value={type.value}
              >
                {type.value}
              </option>
            ))}
          </select>

          {/* BOARD */}

          <select
            value={boardFilter}
            onChange={(e) =>
              setBoardFilter(e.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
          >
            <option value="">
              All Boards
            </option>

            {boards.map((board) => (
              <option
                key={board}
                value={board}
              >
                {board}
              </option>
            ))}
          </select>

          {/* SCHEME YEAR */}

          <select
            value={schemeYearFilter}
            onChange={(e) =>
              setSchemeYearFilter(e.target.value)
            }
            className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700 outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
          >
            <option value="">
              All Scheme Years
            </option>

            {schemeYears.map((year) => (
              <option
                key={year}
                value={year}
              >
                {year} Scheme
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =================================================
          COUNT / ACTIONS
      ================================================= */}

      <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-bold text-amber-600">
              {filteredSubjects.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-700">
              {subjects.length}
            </span>{" "}
            subjects
          </p>

          {selectedSubjects.length > 0 && (
            <p className="mt-0.5 text-xs font-medium text-amber-600">
              {selectedSubjects.length} selected
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">

          {selectedSubjects.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={deletingSelected}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-600 transition hover:bg-amber-100 disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                viewBox="0 0 24 24"
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

          <button
            type="button"
            onClick={downloadSubjectsExcel}
            disabled={filteredSubjects.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3.5 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>

            Export Excel
          </button>
        </div>
      </div>

      {/* =================================================
          TABLE
      ================================================= */}

      <div className="overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">

        {loading ? (
          <div className="flex min-h-72 items-center justify-center">
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-100 border-t-amber-600" />
          </div>
        ) : filteredSubjects.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <svg
                className="h-7 w-7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                viewBox="0 0 24 24"
              >
                <path d="M4 5h16v14H4z" />
                <path d="M8 9h8" />
                <path d="M8 13h8" />
                <path d="M8 17h5" />
              </svg>
            </div>

            <h3 className="mt-3 text-sm font-bold text-slate-900">
              No subjects found
            </h3>

            <p className="mt-1 text-xs text-slate-400">
              Try changing the filters or add a new
              subject.
            </p>

            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              ref={tableScrollRef}
              onPointerDown={handleTablePointerDown}
              onPointerMove={handleTablePointerMove}
              onPointerUp={handleTablePointerUp}
              onPointerCancel={handleTablePointerCancel}
              className="subjects-table-drag overflow-x-auto"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                cursor: "grab",
                touchAction: "pan-y",
              }}
            >

            <table className="w-full min-w-[1900px]">

              <thead>
                <tr className="border-b border-amber-100 bg-amber-50">

                  {/* SELECT */}

                  <th className="sticky left-0 z-20 w-12 bg-amber-50 px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-amber-600"
                    />
                  </th>

                  {/* SL */}

                  <th className="w-12 px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    #
                  </th>

                  {/* SEQUENCE */}

                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Sequence
                  </th>

                  {/* SUBJECT ID */}

                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Subject ID
                  </th>

                  {/* CODE */}

                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Code
                  </th>

                  {/* NAME */}

                  <th className="min-w-[320px] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Subject Name
                  </th>

                  {/* SEM */}

                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Sem
                  </th>

                  {/* DEPARTMENT */}

                  <th className="min-w-[190px] px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Department
                  </th>
{/* CATEGORY */}

<th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
  Category
</th>
                  {/* TYPE */}

                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Type
                  </th>

                  {/* BOARD */}

                  <th className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Board
                  </th>

                  {/* IA */}

                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    IA
                  </th>

                  {/* THEORY */}

                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Theory
                  </th>

                  {/* PRACTICAL */}

                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Practical
                  </th>

                  {/* TOTAL */}

                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Total
                  </th>

                  {/* CREDIT */}

                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Credit
                  </th>

                  {/* SCHEME */}

                  <th className="px-3 py-3 text-center text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    Scheme
                  </th>

                  {/* ACTION */}

                  <th className="sticky right-0 z-20 bg-amber-50 px-3 py-3 text-right text-[10px] font-bold uppercase tracking-wide text-amber-700">
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
                            ? "bg-amber-50/60"
                            : "hover:bg-amber-50/30"
                        }`}
                      >

                        {/* SELECT */}

                        <td
                          className={`sticky left-0 z-10 px-3 py-3 text-center ${
                            selected
                              ? "bg-amber-50/60"
                              : "bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleSelectSubject(
                                subject._id
                              )
                            }
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-amber-600"
                          />
                        </td>

                        {/* SL */}

                        <td className="px-3 py-3 text-xs font-medium text-slate-400">
                          {index + 1}
                        </td>

                        {/* SEQUENCE */}

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-700">
                            {subject.sequence ||
                              "-"}
                          </span>
                        </td>

                        {/* SUBJECT ID */}

                        <td className="px-3 py-3">
                          <span className="font-mono text-xs font-semibold text-slate-600">
                            {subject.subjectId ||
                              "-"}
                          </span>
                        </td>

                        {/* CODE */}

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-blue-50 px-2.5 py-1.5 font-mono text-xs font-bold text-blue-700">
                            {subject.code}
                          </span>
                        </td>

                        {/* NAME */}

                        <td className="px-3 py-3">
                          <p className="max-w-[340px] text-sm font-semibold leading-5 text-slate-900">
                            {subject.name}
                          </p>
                        </td>

                        {/* SEMESTER */}

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700">
                            Sem {subject.semester}
                          </span>
                        </td>

                        {/* DEPARTMENT */}

                        <td className="px-3 py-3">
                          <div>
                            <p className="text-xs font-bold uppercase text-slate-800">
                              {getDepartmentShortName(
                                subject.department
                              )}
                            </p>

                            <p className="mt-0.5 max-w-[180px] truncate text-[11px] text-slate-400">
                              {getDepartmentName(
                                subject.department
                              )}
                            </p>
                          </div>
                        </td>
{/* CATEGORY */}

<td className="px-3 py-3">
  <span className="inline-flex rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-bold text-amber-700">
    {subject.subjectCategory || "REGULAR"}
  </span>
</td>
                        {/* TYPE */}

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-orange-50 px-2.5 py-1.5 text-xs font-bold text-orange-700">
                            {subject.subjectType ||
                              "-"}
                          </span>
                        </td>

                        {/* BOARD */}

                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-700">
                            {subject.board || "-"}
                          </span>
                        </td>

                        {/* IA */}

                        <td className="px-3 py-3 text-center">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">
                              {numberValue(
                                subject.iaMax
                              )}
                            </span>

                            <span className="mx-1 text-slate-300">
                              /
                            </span>

                            <span className="text-slate-500">
                              {numberValue(
                                subject.iaMin
                              )}
                            </span>
                          </div>
                        </td>

                        {/* THEORY */}

                        <td className="px-3 py-3 text-center">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">
                              {numberValue(
                                subject.theoryExamMax
                              )}
                            </span>

                            <span className="mx-1 text-slate-300">
                              /
                            </span>

                            <span className="text-slate-500">
                              {numberValue(
                                subject.theoryExamMin
                              )}
                            </span>
                          </div>
                        </td>

                        {/* PRACTICAL */}

                        <td className="px-3 py-3 text-center">
                          <div className="text-xs">
                            <span className="font-bold text-slate-800">
                              {numberValue(
                                subject.practicalExamMax
                              )}
                            </span>

                            <span className="mx-1 text-slate-300">
                              /
                            </span>

                            <span className="text-slate-500">
                              {numberValue(
                                subject.practicalExamMin
                              )}
                            </span>
                          </div>
                        </td>

                        {/* TOTAL */}

                        <td className="px-3 py-3 text-center">
                          <div className="rounded-lg bg-green-50 px-2 py-1.5">
                            <span className="text-xs font-bold text-green-700">
                              {numberValue(
                                subject.totalMax
                              )}
                            </span>

                            <span className="mx-1 text-green-300">
                              /
                            </span>

                            <span className="text-xs text-green-600">
                              {numberValue(
                                subject.totalMin
                              )}
                            </span>
                          </div>
                        </td>

                        {/* CREDIT */}

                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex min-w-8 justify-center rounded-lg bg-yellow-50 px-2.5 py-1.5 text-xs font-bold text-yellow-700">
                            {numberValue(
                              subject.credit
                            )}
                          </span>
                        </td>

                        {/* SCHEME */}

                        <td className="px-3 py-3 text-center">
                          <span className="text-xs font-semibold text-slate-600">
                            {subject.schemeYear ||
                              "-"}
                          </span>
                        </td>

                        {/* ACTION */}

                        <td
                          className={`sticky right-0 z-10 px-3 py-3 ${
                            selected
                              ? "bg-amber-50/60"
                              : "bg-white"
                          }`}
                        >
                          <div className="flex justify-end gap-1.5">

                            {/* VIEW */}

                            <button
                              onClick={() =>
                                openDetailsModal(
                                  subject
                                )
                              }
                              title="View Details"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 text-blue-500 transition hover:bg-blue-50 hover:text-blue-700"
                            >
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  cx="12"
                                  cy="12"
                                  r="9"
                                />
                                <path d="M12 10v6" />
                                <path d="M12 7h.01" />
                              </svg>
                            </button>

                            {/* EDIT */}

                            <button
                              onClick={() =>
                                openEditModal(
                                  subject
                                )
                              }
                              title="Edit"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <svg
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
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-100 text-amber-400 transition hover:bg-amber-50 hover:text-amber-600"
                            >
                              <svg
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
          </>
        )}
      </div>

      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={closeAddModal}
          />

          <div className="relative max-h-[94vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {editingSubject
                    ? "Edit Subject"
                    : "Add Subject"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Enter complete syllabus subject
                  details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeAddModal}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white hover:text-amber-600"
              >
                ✕
              </button>
            </div>

            {/* FORM */}

            <form
              onSubmit={handleSaveSubject}
              className="max-h-[calc(94vh-80px)] overflow-y-auto p-5"
            >

              {/* BASIC DETAILS */}

              <div className="mb-5">

                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">
                  Basic Information
                </p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  {/* SUBJECT ID */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Subject ID
                    </label>

                    <input
                      name="subjectId"
                      value={form.subjectId}
                      onChange={handleFormChange}
                      placeholder="25CS440PX"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm uppercase outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    />
                  </div>

                  {/* CODE */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Subject Code
                    </label>

                    <input
                      name="code"
                      value={form.code}
                      onChange={handleFormChange}
                      placeholder="25CS11T0"
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm uppercase outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    />
                  </div>

                  {/* SEQUENCE */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Sequence
                    </label>

                    <input
                      name="sequence"
                      type="text"
                      value={form.sequence}
                      onChange={(e) =>
                        setForm((previous) => ({
                          ...previous,
                          sequence: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="1CS01"
                      required
                      pattern="[1-8][A-Za-z]{2}[0-9]{2}"
                      title="Enter sequence in format 1CS01"
                      className="h-10 w-full rounded-xl border border-amber-200 bg-amber-50/40 px-3 text-sm font-semibold uppercase outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    />

                    <p className="mt-1 text-[10px] text-slate-400">
                      Format: Semester + Department + Number. Example: 1CS01
                    </p>
                  </div>

                  {/* NAME */}

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Subject Name
                    </label>

                    <input
                      name="name"
                      value={form.name}
                      onChange={handleFormChange}
                      placeholder="Engineering Mathematics-I"
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
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
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    >
                      <option value="">
                        Select department
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
                  </div>

                  {/* SEMESTER */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Semester
                    </label>

                    <select
                      name="semester"
                      value={form.semester}
                      onChange={handleFormChange}
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    >
                      <option value="">
                        Select semester
                      </option>

                      {semesters.map(
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

                  {/* SUBJECT CATEGORY */}

<div>
  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
    Subject Category
  </label>

  <select
    name="subjectCategory"
    value={form.subjectCategory}
    onChange={handleFormChange}
    required
    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
  >
    <option value="REGULAR">
      Regular
    </option>

    <option value="BRIDGE">
      Bridge
    </option>
  </select>

  <p className="mt-1 text-[10px] text-slate-400">
    Select Regular for normal subjects and Bridge for bridge courses.
  </p>
</div>

                  {/* TYPE */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Subject Type
                    </label>

                    <select
                      name="subjectType"
                      value={form.subjectType}
                      onChange={handleFormChange}
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    >
                      <option value="">
                        Select type
                      </option>

                      {subjectTypes.map(
                        (type) => (
                          <option
                            key={type.value}
                            value={type.value}
                          >
                            {type.label}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {/* BOARD */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Board
                    </label>

                    <select
                      name="board"
                      value={form.board}
                      onChange={handleFormChange}
                      required
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    >
                      <option value="">
                        Select board
                      </option>

                      {boards.map((board) => (
                        <option
                          key={board}
                          value={board}
                        >
                          {board}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SCHEME YEAR */}

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Scheme Year
                    </label>

                    <input
                      name="schemeYear"
                      type="number"
                      value={form.schemeYear}
                      onChange={handleFormChange}
                      min="2000"
                      max="2100"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                    />
                  </div>
                </div>
              </div>

              {/* MARKS */}

              <div className="mb-5">

                <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">
                  Examination Marks
                </p>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                  {/* IA */}

                  <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                    <p className="mb-2 text-xs font-bold text-amber-700">
                      Internal Assessment
                    </p>

                    <div className="grid grid-cols-2 gap-2">

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Maximum
                        </label>

                        <input
                          name="iaMax"
                          type="number"
                          min="0"
                          value={form.iaMax}
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Minimum
                        </label>

                        <input
                          name="iaMin"
                          type="number"
                          min="0"
                          value={form.iaMin}
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* THEORY */}

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-bold text-slate-700">
                      Theory Examination
                    </p>

                    <div className="grid grid-cols-2 gap-2">

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Maximum
                        </label>

                        <input
                          name="theoryExamMax"
                          type="number"
                          min="0"
                          value={
                            form.theoryExamMax
                          }
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Minimum
                        </label>

                        <input
                          name="theoryExamMin"
                          type="number"
                          min="0"
                          value={
                            form.theoryExamMin
                          }
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* PRACTICAL */}

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-bold text-slate-700">
                      Practical Examination
                    </p>

                    <div className="grid grid-cols-2 gap-2">

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Maximum
                        </label>

                        <input
                          name="practicalExamMax"
                          type="number"
                          min="0"
                          value={
                            form.practicalExamMax
                          }
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Minimum
                        </label>

                        <input
                          name="practicalExamMin"
                          type="number"
                          min="0"
                          value={
                            form.practicalExamMin
                          }
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* TOTAL */}

                  <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                    <p className="mb-2 text-xs font-bold text-green-700">
                      Total Marks
                    </p>

                    <div className="grid grid-cols-2 gap-2">

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Maximum
                        </label>

                        <input
                          name="totalMax"
                          type="number"
                          min="0"
                          value={form.totalMax}
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-green-400"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-[10px] font-semibold text-slate-500">
                          Minimum
                        </label>

                        <input
                          name="totalMin"
                          type="number"
                          min="0"
                          value={form.totalMin}
                          onChange={handleFormChange}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-green-400"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* CREDIT */}

              <div className="mb-5 max-w-xs">

                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Credit
                </label>

                <input
                  name="credit"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.credit}
                  onChange={handleFormChange}
                  placeholder="6"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-50"
                />
              </div>

              {/* FOOTER */}

              <div className="flex justify-end gap-2 border-t border-amber-100 pt-4">

                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
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

      {/* =================================================
          VIEW DETAILS MODAL
      ================================================= */}

      {showDetailsModal &&
        viewingSubject && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">

            <div
              className="absolute inset-0"
              onClick={closeDetailsModal}
            />

            <div className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl">

              {/* HEADER */}

              <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-5 py-4">

                <div>
                  <div className="flex items-center gap-2">

                    <span className="rounded-lg bg-amber-600 px-2.5 py-1 font-mono text-xs font-bold text-white">
                      {viewingSubject.sequence ||
                        "-"}
                    </span>

                    <h2 className="text-lg font-bold text-slate-950">
                      {viewingSubject.name}
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    Complete subject details
                  </p>
                </div>

                <button
                  onClick={closeDetailsModal}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-amber-600"
                >
                  ✕
                </button>
              </div>

              {/* DETAILS */}

              <div className="max-h-[calc(92vh-80px)] overflow-y-auto p-5">

                {/* BASIC */}

                <div className="mb-5">

                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">
                    Basic Information
                  </p>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                    <DetailBox
                      label="Sequence"
                      value={
                        viewingSubject.sequence
                      }
                      red
                    />

                    <DetailBox
                      label="Subject ID"
                      value={
                        viewingSubject.subjectId
                      }
                    />

                    <DetailBox
                      label="Subject Code"
                      value={
                        viewingSubject.code
                      }
                    />

                    <DetailBox
                      label="Semester"
                      value={
                        `Semester ${viewingSubject.semester}`
                      }
                    />

                    <DetailBox
                      label="Department"
                      value={getDepartmentShortName(
                        viewingSubject.department
                      )}
                    />

                    <DetailBox
                      label="Subject Type"
                      value={
                        viewingSubject.subjectType
                      }
                    />

                    <DetailBox
                      label="Board"
                      value={
                        viewingSubject.board
                      }
                    />

                    <DetailBox
                      label="Scheme Year"
                      value={
                        viewingSubject.schemeYear
                      }
                    />
                  </div>
                </div>

                {/* MARKS */}

                <div className="mb-5">

                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-amber-600">
                    Examination Marks
                  </p>

                  <div className="grid gap-3 md:grid-cols-4">

                    <MarkBox
                      label="Internal Assessment"
                      max={
                        viewingSubject.iaMax
                      }
                      min={
                        viewingSubject.iaMin
                      }
                    />

                    <MarkBox
                      label="Theory Examination"
                      max={
                        viewingSubject.theoryExamMax
                      }
                      min={
                        viewingSubject.theoryExamMin
                      }
                    />

                    <MarkBox
                      label="Practical Examination"
                      max={
                        viewingSubject.practicalExamMax
                      }
                      min={
                        viewingSubject.practicalExamMin
                      }
                    />

                    <MarkBox
                      label="Total"
                      max={
                        viewingSubject.totalMax
                      }
                      min={
                        viewingSubject.totalMin
                      }
                      green
                    />
                  </div>
                </div>

                {/* CREDIT */}

                <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4">

                  <div className="flex items-center justify-between">

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-yellow-700">
                        Credit
                      </p>

                      <p className="mt-1 text-xs text-yellow-700/70">
                        Subject credit value
                      </p>
                    </div>

                    <span className="text-2xl font-bold text-yellow-700">
                      {numberValue(
                        viewingSubject.credit
                      )}
                    </span>
                  </div>
                </div>

                {/* CLOSE */}

                <div className="mt-5 flex justify-end">

                  <button
                    onClick={closeDetailsModal}
                    className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* =================================================
          BULK UPLOAD MODAL
      ================================================= */}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">

          <div
            className="absolute inset-0"
            onClick={closeBulkModal}
          />

          <div className="relative max-h-[94vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* HEADER */}

            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50 px-5 py-4">

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Bulk Upload Subjects
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Import complete syllabus subject
                  details using CSV.
                </p>
              </div>

              <button
                onClick={closeBulkModal}
                disabled={uploading}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white hover:text-amber-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[calc(94vh-80px)] space-y-4 overflow-y-auto p-5">

              {/* INFORMATION */}

              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
  <p className="text-sm font-bold text-amber-800">
    CSV columns
  </p>

  <p className="mt-2 text-xs leading-5 text-amber-700">
    subjectId, code, name, sequence,
    semester, department, subjectCategory,
    subjectType, board, iaMax, iaMin,
    theoryExamMax, theoryExamMin,
    practicalExamMax, practicalExamMin,
    totalMax, totalMin, credit, schemeYear
  </p>

  <p className="mt-2 text-[11px] font-semibold text-amber-700">
    Subject Category must be either REGULAR or BRIDGE.
  </p>

  <p className="mt-2 text-[11px] text-amber-600">
    Sequence Number is generated automatically from
    semester, department and sequence.
  </p>
</div>

              {/* FILE */}

              <label
                htmlFor="subject-csv"
                className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                  selectedFile
                    ? "border-amber-300 bg-amber-50"
                    : "border-slate-200 hover:border-amber-300 hover:bg-amber-50/40"
                }`}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">

                  <svg
                    className="h-6 w-6"
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
                    <p className="mt-3 text-sm font-bold text-slate-900">
                      {selectedFile.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {(
                        selectedFile.size /
                        1024
                      ).toFixed(1)}{" "}
                      KB
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-sm font-bold text-slate-800">
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

                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Need a template?
                  </p>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Download the complete subject
                    template.
                  </p>
                </div>

                <button
                  onClick={downloadTemplate}
                  className="shrink-0 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50"
                >
                  Download Template
                </button>
              </div>

              {/* RESULT */}

              {uploadResult && (
                <div
                  className={`rounded-xl border p-4 ${
                    uploadResult.success
                      ? "border-green-100 bg-green-50"
                      : "border-amber-100 bg-amber-50"
                  }`}
                >

                  {uploadResult.success ? (
                    <>
                      <p className="text-sm font-bold text-green-800">
                        Upload completed
                      </p>

                      {uploadResult.summary && (
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">

                          <div className="rounded-lg bg-white p-3">
                            <p className="text-lg font-bold text-slate-900">
                              {
                                uploadResult
                                  .summary
                                  .totalRows
                              }
                            </p>

                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Total
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3">
                            <p className="text-lg font-bold text-green-600">
                              {
                                uploadResult
                                  .summary
                                  .inserted
                              }
                            </p>

                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Added
                            </p>
                          </div>

                          <div className="rounded-lg bg-white p-3">
                            <p className="text-lg font-bold text-amber-600">
                              {
                                uploadResult
                                  .summary
                                  .failed
                              }
                            </p>

                            <p className="text-[10px] font-bold uppercase text-slate-400">
                              Failed
                            </p>
                          </div>
                        </div>
                      )}

                      {uploadResult.errors?.length >
                        0 && (
                        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg bg-white p-3">

                          <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-amber-600">
                            Errors
                          </p>

                          <div className="space-y-1.5">
                            {uploadResult.errors.map(
                              (error, index) => (
                                <p
                                  key={index}
                                  className="text-xs text-amber-600"
                                >
                                  {error.row && (
                                    <span className="font-bold">
                                      Row{" "}
                                      {
                                        error.row
                                      }
                                      :{" "}
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
                    <p className="text-sm font-bold text-amber-700">
                      {uploadResult.message}
                    </p>
                  )}
                </div>
              )}

              {/* FOOTER */}

              <div className="flex justify-end gap-2 border-t border-amber-100 pt-4">

                <button
                  onClick={closeBulkModal}
                  disabled={uploading}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Close
                </button>

                {!uploadResult?.success && (
                  <button
                    onClick={handleBulkUpload}
                    disabled={
                      !selectedFile || uploading
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
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

// =====================================================
// DETAIL BOX
// =====================================================

function DetailBox({
  label,
  value,
  red = false,
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        red
          ? "border-amber-100 bg-amber-50"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-sm font-bold ${
          red
            ? "text-amber-600"
            : "text-slate-800"
        }`}
      >
        {value !== undefined &&
        value !== null &&
        value !== ""
          ? value
          : "-"}
      </p>
    </div>
  );
}

// =====================================================
// MARK BOX
// =====================================================

function MarkBox({
  label,
  max,
  min,
  green = false,
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        green
          ? "border-green-100 bg-green-50"
          : "border-slate-100 bg-slate-50"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-wide ${
          green
            ? "text-green-600"
            : "text-slate-400"
        }`}
      >
        {label}
      </p>

      <div className="mt-2 flex items-end gap-1">

        <span
          className={`text-xl font-bold ${
            green
              ? "text-green-700"
              : "text-slate-800"
          }`}
        >
          {numberValue(max)}
        </span>

        <span className="mb-0.5 text-sm text-slate-300">
          /
        </span>

        <span className="mb-0.5 text-sm font-semibold text-slate-500">
          {numberValue(min)}
        </span>
      </div>

      <p className="mt-1 text-[10px] text-slate-400">
        Maximum / Minimum
      </p>
    </div>
  );
}