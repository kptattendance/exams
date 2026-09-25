"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

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

const currentYear = new Date().getFullYear();

const admissionYears = Array.from(
  { length: 8 },
  (_, index) => currentYear - index
);

const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  maxLength,
}) => {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
};

const SelectField = ({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  placeholder = "Select",
}) => {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}
      </label>

      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      >
        <option value="">{placeholder}</option>

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
};

const SectionHeader = ({ number, title, description }) => {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600">
        {number}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
        </h3>

        {description && (
          <p className="mt-0.5 text-xs text-slate-500">
            {description}
          </p>
        )}
      </div>
    </div>
  );
};

export default function AddStudent({
  onSuccess,
  onCancel,
}) {
  const { getToken } = useAuth();

  const [form, setForm] = useState({
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
  });

  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =====================================================
  // HANDLE INPUT
  // =====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // =====================================================
  // HANDLE PHOTO
  // =====================================================

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5 MB.");
      return;
    }

    setError("");

    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImage(null);
    setPreview("");
  };

  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    // ---------------------------------------------------
    // REQUIRED FIELD VALIDATION
    // ---------------------------------------------------

    const requiredFields = [
      ["registerNumber", "Register number"],
      ["name", "Student name"],
      ["fatherName", "Father name"],
      ["motherName", "Mother name"],
      ["dob", "Date of birth"],
      ["gender", "Gender"],
      ["email", "Email"],
      ["phone", "Phone number"],
      ["department", "Department"],
      ["admissionYear", "Admission year"],
      ["batch", "Batch"],
      ["batchNumber", "Batch number"],
      ["semester", "Semester"],
    ];

    for (const [field, label] of requiredFields) {
      if (!String(form[field] || "").trim()) {
        setError(`${label} is required.`);
        return;
      }
    }

    // ---------------------------------------------------
    // GENDER VALIDATION
    // ---------------------------------------------------

    if (
      !["male", "female", "other"].includes(
        form.gender
      )
    ) {
      setError("Please select a valid gender.");
      return;
    }

    // ---------------------------------------------------
    // SEMESTER VALIDATION
    // ---------------------------------------------------

    const semester = Number(form.semester);

    if (semester < 1 || semester > 6) {
      setError("Semester must be between 1 and 6.");
      return;
    }

    // ---------------------------------------------------
    // BATCH NUMBER VALIDATION
    // ---------------------------------------------------

    const batchNumber = Number(form.batchNumber);

    if (![1, 2].includes(batchNumber)) {
      setError("Batch number must be 1 or 2.");
      return;
    }

    // ---------------------------------------------------
    // PHONE VALIDATION
    // ---------------------------------------------------

    const phone = form.phone.trim();

    if (!/^\d{10}$/.test(phone)) {
      setError(
        "Student phone number must contain exactly 10 digits."
      );
      return;
    }

    // ---------------------------------------------------
    // PARENT PHONE
    // ---------------------------------------------------

    if (
      form.parentPhone.trim() &&
      !/^\d{10}$/.test(form.parentPhone.trim())
    ) {
      setError(
        "Parent phone number must contain exactly 10 digits."
      );
      return;
    }

    // ---------------------------------------------------
    // AADHAAR
    // ---------------------------------------------------

    if (
      form.aadhaarNumber.trim() &&
      !/^\d{12}$/.test(form.aadhaarNumber.trim())
    ) {
      setError(
        "Aadhaar number must contain exactly 12 digits."
      );
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        throw new Error(
          "Authentication token could not be obtained."
        );
      }

      const formData = new FormData();

      // =================================================
      // BASIC DETAILS
      // =================================================

      formData.append(
        "registerNumber",
        form.registerNumber.trim().toUpperCase()
      );

      formData.append(
        "name",
        form.name.trim()
      );

      formData.append(
        "fatherName",
        form.fatherName.trim()
      );

      formData.append(
        "motherName",
        form.motherName.trim()
      );

      formData.append(
        "dob",
        form.dob
      );

      formData.append(
        "gender",
        form.gender
      );

      // =================================================
      // CONTACT DETAILS
      // =================================================

      formData.append(
        "email",
        form.email.trim().toLowerCase()
      );

      formData.append(
        "phone",
        form.phone.trim()
      );

      formData.append(
        "parentPhone",
        form.parentPhone.trim()
      );

      // =================================================
      // SOCIAL / RESERVATION
      // =================================================

      formData.append(
        "caste",
        form.caste.trim()
      );

      formData.append(
        "category",
        form.category.trim()
      );

      // =================================================
      // IDENTIFICATION
      // =================================================

      formData.append(
        "aadhaarNumber",
        form.aadhaarNumber.trim()
      );

      formData.append(
        "satsNumber",
        form.satsNumber.trim()
      );

      // =================================================
      // ACADEMIC DETAILS
      // =================================================

      formData.append(
        "department",
        form.department
      );

      formData.append(
        "admissionYear",
        form.admissionYear
      );

      formData.append(
        "batch",
        form.batch.trim()
      );

      formData.append(
        "batchNumber",
        form.batchNumber
      );

      formData.append(
        "semester",
        form.semester
      );

      // =================================================
      // STATUS
      // =================================================

      formData.append(
        "status",
        form.status
      );

      // =================================================
      // PHOTO
      // =================================================

      if (image) {
        formData.append("image", image);
      }

      // =================================================
      // API
      // =================================================

      const response = await axios.post(
        `${API_URL}/api/students/addstudent`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        setSuccess(
          "Student created successfully."
        );

        // Reset form
        setForm({
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
        });

        setImage(null);
        setPreview("");

        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 700);
        }
      } else {
        setError(
          response.data?.message ||
            "Failed to create student."
        );
      }
    } catch (err) {
      console.error(
        "Create student error:",
        err
      );

      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to create student."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // UI
  // =====================================================

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* =================================================
          HEADER
      ================================================= */}

      <div className="border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Add New Student
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter complete student information.
            </p>
          </div>

          <div className="hidden rounded-xl bg-white px-3 py-2 text-xs text-slate-500 shadow-sm ring-1 ring-slate-200 sm:block">
            <span className="text-red-500">*</span>{" "}
            Required fields
          </div>
        </div>
      </div>

      {/* =================================================
          FORM CONTENT
      ================================================= */}

      <div className="space-y-8 p-6">

        {/* =================================================
            1. PHOTO
        ================================================= */}

        <section>
          <SectionHeader
            number="1"
            title="Student Photo"
            description="Upload the student's photograph."
          />

          <div className="flex flex-wrap items-center gap-5">
            <div>
              {preview ? (
                <img
                  src={preview}
                  alt="Student preview"
                  className="h-28 w-28 rounded-2xl object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                  <svg
                    className="h-10 w-10 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M15 19a4 4 0 0 0-6 0m3-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 8v-2a4 4 0 0 0-3-3.87M18 3.13a3 3 0 0 1 0 5.74"
                    />
                  </svg>
                </div>
              )}
            </div>

            <div>
              <label className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Choose Photo

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>

              {preview && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="ml-3 text-sm font-medium text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              )}

              <p className="mt-2 text-xs text-slate-400">
                JPG, PNG or WebP · Maximum 5 MB
              </p>
            </div>
          </div>
        </section>

        {/* =================================================
            2. BASIC DETAILS
        ================================================= */}

        <section>
          <SectionHeader
            number="2"
            title="Basic Student Details"
            description="Personal and identification information."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

            <InputField
              label="Register Number"
              name="registerNumber"
              value={form.registerNumber}
              onChange={handleChange}
              placeholder="Enter register number"
              required
            />

            <InputField
              label="Student Name"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="Enter full name"
              required
            />

            <InputField
              label="Father Name"
              name="fatherName"
              value={form.fatherName}
              onChange={handleChange}
              placeholder="Enter father's name"
              required
            />

            <InputField
              label="Mother Name"
              name="motherName"
              value={form.motherName}
              onChange={handleChange}
              placeholder="Enter mother's name"
              required
            />

            <InputField
              label="Date of Birth"
              name="dob"
              value={form.dob}
              onChange={handleChange}
              type="date"
              required
            />

            <SelectField
              label="Gender"
              name="gender"
              value={form.gender}
              onChange={handleChange}
              options={genders}
              required
              placeholder="Select gender"
            />

          </div>
        </section>

        {/* =================================================
            3. CONTACT DETAILS
        ================================================= */}

        <section>
          <SectionHeader
            number="3"
            title="Contact Details"
            description="Student and parent/guardian contact information."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

            <InputField
              label="Email"
              name="email"
              value={form.email}
              onChange={handleChange}
              type="email"
              placeholder="student@example.com"
              required
            />

            <InputField
              label="Student Phone"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              type="tel"
              placeholder="10 digit mobile number"
              maxLength={10}
              required
            />

            <InputField
              label="Parent Phone"
              name="parentPhone"
              value={form.parentPhone}
              onChange={handleChange}
              type="tel"
              placeholder="10 digit mobile number"
              maxLength={10}
            />

          </div>
        </section>

        {/* =================================================
            4. SOCIAL / RESERVATION
        ================================================= */}

        <section>
          <SectionHeader
            number="4"
            title="Social & Reservation Details"
            description="Caste and category information."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <InputField
              label="Caste"
              name="caste"
              value={form.caste}
              onChange={handleChange}
              placeholder="Enter caste"
            />

            <InputField
              label="Category"
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="Example: GM, SC, ST, OBC"
            />

          </div>
        </section>

        {/* =================================================
            5. IDENTIFICATION
        ================================================= */}

        <section>
          <SectionHeader
            number="5"
            title="Government & Student Identification"
            description="Student identification numbers."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

            <InputField
              label="Aadhaar Number"
              name="aadhaarNumber"
              value={form.aadhaarNumber}
              onChange={handleChange}
              type="text"
              placeholder="12 digit Aadhaar number"
              maxLength={12}
            />

            <InputField
              label="SATS Number"
              name="satsNumber"
              value={form.satsNumber}
              onChange={handleChange}
              placeholder="Enter SATS number"
            />

          </div>
        </section>

        {/* =================================================
            6. ACADEMIC DETAILS
        ================================================= */}

        <section>
          <SectionHeader
            number="6"
            title="Academic Details"
            description="Admission and current academic information."
          />

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">

            <SelectField
              label="Department"
              name="department"
              value={form.department}
              onChange={handleChange}
              options={departments}
              required
              placeholder="Select department"
            />

            <SelectField
              label="Admission Year"
              name="admissionYear"
              value={form.admissionYear}
              onChange={handleChange}
              options={admissionYears.map((year) => ({
                value: String(year),
                label: String(year),
              }))}
              required
              placeholder="Select admission year"
            />

            <InputField
              label="Batch"
              name="batch"
              value={form.batch}
              onChange={handleChange}
              placeholder="Example: 2025-2027"
              required
            />

            <SelectField
              label="Batch Number"
              name="batchNumber"
              value={form.batchNumber}
              onChange={handleChange}
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
              required
              placeholder="Select batch"
            />

            <SelectField
              label="Current Semester"
              name="semester"
              value={form.semester}
              onChange={handleChange}
              options={[1, 2, 3, 4, 5, 6].map(
                (semester) => ({
                  value: String(semester),
                  label: `Semester ${semester}`,
                })
              )}
              required
              placeholder="Select semester"
            />

          </div>
        </section>

        {/* =================================================
            7. STATUS
        ================================================= */}

        <section>
          <SectionHeader
            number="7"
            title="Student Status"
            description="Current status of the student."
          />

          <div className="max-w-md">
            <SelectField
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              options={statuses}
              required
            />
          </div>
        </section>

        {/* =================================================
            ERROR / SUCCESS
        ================================================= */}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <span className="font-semibold">
                Error:
              </span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

      </div>

      {/* =================================================
          FOOTER
      ================================================= */}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Creating Student..."
            : "Create Student"}
        </button>

      </div>
    </form>
  );
}