"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const departments = [
  {
    value: "",
    label: "Select Department",
  },
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
    value: "",
    label: "Select Role",
  },
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

export default function NewUserPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "",
    department: "",
    image: null,
  });

  const [imagePreview, setImagePreview] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // --------------------------------------------------
  // HANDLE TEXT / SELECT CHANGE
  // --------------------------------------------------

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setSuccess("");
  };

  // --------------------------------------------------
  // HANDLE IMAGE
  // --------------------------------------------------

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

    setError("");
    setSuccess("");
  };

  // --------------------------------------------------
  // SUBMIT
  // --------------------------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    // Basic validation
    if (!form.name.trim()) {
      setError("Please enter the user's name.");
      return;
    }

    if (!form.email.trim()) {
      setError("Please enter the email address.");
      return;
    }

    if (!form.role) {
      setError("Please select a role.");
      return;
    }

    if (!form.department) {
      setError("Please select a department.");
      return;
    }

    try {
      setSaving(true);

      const token = await getToken();

      if (!token) {
        setError("Authentication token not available. Please login again.");
        return;
      }

      const formData = new FormData();

      formData.append("name", form.name.trim());
      formData.append("email", form.email.trim());
      formData.append("phone", form.phone.trim());
      formData.append("role", form.role);
      formData.append("department", form.department);

      // Image
      if (form.image) {
        formData.append("image", form.image);
      }

      const response = await axios.post(
        `${API_URL}/api/users/adduser`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data?.success) {
        setSuccess("User created successfully.");

        // Clear form
        setForm({
          name: "",
          email: "",
          phone: "",
          role: "",
          department: "",
          image: null,
        });

        setImagePreview(null);

        /*
         * Navigate without refreshing the page.
         * Next.js client-side navigation.
         */
        setTimeout(() => {
          router.push("/admin/users");
        }, 800);
      } else {
        setError(
          response.data?.message ||
            "Failed to create user."
        );
      }
    } catch (error) {
      console.error("Create user error:", error);

      setError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          "Failed to create user."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">

        {/* HEADER */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-sm font-semibold text-blue-600">
              User Management
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Add New User
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Create a new administrative or examination system account.
            </p>
          </div>

          {/* BACK */}
          <Link
            href="/admin/users"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <span className="text-lg">
              ←
            </span>

            Back to Users
          </Link>

        </div>

        {/* FORM CARD */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          {/* CARD HEADER */}
          <div className="border-b border-slate-100 bg-blue-50/50 px-5 py-4 sm:px-6">

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">

                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-5 w-5"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />

                  <circle
                    cx="9"
                    cy="7"
                    r="4"
                  />

                  <path d="M19 8v6" />

                  <path d="M22 11h-6" />
                </svg>

              </div>

              <div>

                <h2 className="text-base font-bold text-slate-900">
                  User Information
                </h2>

                <p className="text-xs text-slate-500">
                  Enter the account details below.
                </p>

              </div>

            </div>

          </div>

          {/* FORM */}
          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-6"
          >

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* NAME */}
              <div className="md:col-span-2">

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Full Name
                </label>

                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />

              </div>

              {/* EMAIL */}
              <div>

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Email Address
                </label>

                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@kptmangaluru.in"
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />

              </div>

              {/* PHONE */}
              <div>

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Phone Number
                </label>

                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                />

              </div>

              {/* ROLE */}
              <div>

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Role
                </label>

                <select
                  name="role"
                  value={form.role}
                  onChange={handleChange}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                >
                  {roles.map((role) => (
                    <option
                      key={role.value}
                      value={role.value}
                    >
                      {role.label}
                    </option>
                  ))}
                </select>

              </div>

              {/* DEPARTMENT */}
              <div>

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Department
                </label>

                <select
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                  required
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
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

              {/* PROFILE PHOTO */}
              <div className="md:col-span-2">

                <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Profile Photo
                </label>

                <div className="flex items-center gap-4">

                  {/* PREVIEW */}
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">

                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Profile preview"
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
                          className="h-7 w-7"
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

                  {/* FILE */}
                  <label className="flex h-11 min-w-0 flex-1 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-500 transition hover:border-blue-300 hover:bg-blue-50">

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

                <p className="mt-1.5 text-xs text-slate-400">
                  JPG, JPEG, PNG or WebP image.
                </p>

              </div>

            </div>

            {/* ERROR */}
            {error && (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-medium text-red-600">
                  {error}
                </p>
              </div>
            )}

            {/* SUCCESS */}
            {success && (
              <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                <p className="text-sm font-medium text-green-600">
                  {success}
                </p>
              </div>
            )}

            {/* ACTIONS */}
            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">

              {/* CANCEL */}
              <Link
                href="/admin/users"
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </Link>

              {/* CREATE */}
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >

                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating...
                  </>
                ) : (
                  <>
                    <span className="text-lg leading-none">
                      +
                    </span>
                    Create User
                  </>
                )}

              </button>

            </div>

          </form>

        </div>

      </div>
    </div>
  );
}