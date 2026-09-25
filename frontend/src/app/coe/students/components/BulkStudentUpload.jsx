"use client";

import { useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import * as XLSX from "xlsx";

export default function StudentBulkUploadPage() {
  const { getToken } = useAuth();

  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // =====================================================
  // API URL
  // =====================================================

  const API_URL =
    process.env.NEXT_PUBLIC_API_URL;

  // =====================================================
  // SELECT FILE
  // =====================================================

  const handleFileChange = (event) => {
    const selectedFile =
      event.target.files?.[0];

    setError("");
    setResult(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const fileName =
      selectedFile.name.toLowerCase();

    const valid =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(extension)
      );

    if (!valid) {
      setError(
        "Please select an Excel (.xlsx, .xls) or CSV file."
      );

      event.target.value = "";
      setFile(null);

      return;
    }

    setFile(selectedFile);
  };

  // =====================================================
  // UPLOAD
  // =====================================================

  const handleUpload = async () => {
    if (!file) {
      setError(
        "Please select an Excel file first."
      );

      return;
    }

    try {
      setUploading(true);
      setError("");
      setResult(null);

      const token =
        await getToken();

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          `${API_URL}/api/students/bulk-upload`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body: formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
          "Bulk upload failed."
        );
      }

      setResult(
        data.data
      );

      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value =
          "";
      }

    } catch (error) {
      console.error(
        "Bulk upload error:",
        error
      );

      setError(
        error?.message ||
        "Bulk upload failed."
      );

    } finally {
      setUploading(false);
    }
  };

  // =====================================================
  // DOWNLOAD TEMPLATE
  // =====================================================

  const downloadTemplate = () => {
    const data = [
      {
        RegisterNumber: "25CS001",
        Name: "Student Name",
        FatherName: "Father Name",
        MotherName: "Mother Name",
        DOB: "15-06-2008",
        Gender: "male",
        Email: "student@example.com",
        Phone: "9876543210",
        ParentPhone: "9876543211",
        Caste: "",
        Category: "",
        AadhaarNumber: "",
        SATSNumber: "",
        Department: "cs",
        AdmissionYear: 2025,
        Batch: "2025-2028",
        BatchNumber: 1,
        Semester: 1,
        Status: "active",
        Photo:
          "https://drive.google.com/file/d/FILE_ID/view",
      },
    ];

    const worksheet =
      XLSX.utils.json_to_sheet(
        data
      );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Students"
    );

    XLSX.writeFile(
      workbook,
      "student_bulk_upload_template.xlsx"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">

        {/* ================================================= */}
        {/* INSTRUCTIONS */}
        {/* ================================================= */}

        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-5">

          <h2 className="mb-3 font-semibold text-blue-900">
            Excel Upload Instructions
          </h2>

          <ul className="space-y-1 text-sm text-blue-800">
            <li>
              • Use the provided Excel template.
            </li>

            <li>
              • Register number and email must
              be unique.
            </li>

            <li>
              • Gender must be male, female or other.
            </li>

            <li>
              • Department must use codes such as
              cs, ec, me, ce, etc.
            </li>

            <li>
              • Semester must be between 1 and 6.
            </li>

            <li>
              • Batch number must be 1 or 2.
            </li>

            <li>
              • Student photo can be provided as
              a Google Drive sharing link.
            </li>

            <li>
              • Google Drive photo must be publicly
              accessible to the backend.
            </li>
          </ul>
        </div>

        {/* ================================================= */}
        {/* TEMPLATE */}
        {/* ================================================= */}

        <div className="mb-6 rounded-lg border bg-white p-5 shadow-sm">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <h2 className="font-semibold text-gray-900">
                Step 1 — Download Template
              </h2>

              <p className="text-sm text-gray-500">
                Use the correct column names.
              </p>
            </div>

            <button
              type="button"
              onClick={
                downloadTemplate
              }
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Download Excel Template
            </button>

          </div>
        </div>

        {/* ================================================= */}
        {/* UPLOAD */}
        {/* ================================================= */}

        <div className="rounded-lg border bg-white p-5 shadow-sm">

          <h2 className="mb-4 font-semibold text-gray-900">
            Step 2 — Upload Student Excel
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={
              handleFileChange
            }
            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm"
          />

          {file && (
            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
              <span className="font-medium">
                Selected file:
              </span>{" "}
              {file.name}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={
              handleUpload
            }
            disabled={
              !file ||
              uploading
            }
            className="mt-5 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
          >
            {uploading
              ? "Uploading Students..."
              : "Upload Students"}
          </button>

        </div>

        {/* ================================================= */}
        {/* RESULT */}
        {/* ================================================= */}

        {result && (
          <div className="mt-6 rounded-lg border bg-white p-5 shadow-sm">

            <h2 className="mb-5 text-lg font-semibold text-gray-900">
              Upload Result
            </h2>

            {/* SUMMARY */}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">

              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">
                  Total
                </p>

                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {result.total}
                </p>
              </div>

              <div className="rounded-lg bg-green-50 p-4">
                <p className="text-xs text-green-700">
                  Created
                </p>

                <p className="mt-1 text-2xl font-bold text-green-700">
                  {result.created}
                </p>
              </div>

              <div className="rounded-lg bg-red-50 p-4">
                <p className="text-xs text-red-700">
                  Failed
                </p>

                <p className="mt-1 text-2xl font-bold text-red-700">
                  {result.failed}
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 p-4">
                <p className="text-xs text-blue-700">
                  Success Rate
                </p>

                <p className="mt-1 text-2xl font-bold text-blue-700">
                  {result.total
                    ? Math.round(
                        (result.created /
                          result.total) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>

            </div>

            {/* ERRORS */}

            {result.errors?.length > 0 && (
              <div className="mt-6">

                <h3 className="mb-3 font-semibold text-red-700">
                  Failed Rows
                </h3>

                <div className="overflow-x-auto rounded-lg border">

                  <table className="min-w-full text-sm">

                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          Excel Row
                        </th>

                        <th className="px-4 py-3 text-left">
                          Register Number
                        </th>

                        <th className="px-4 py-3 text-left">
                          Name
                        </th>

                        <th className="px-4 py-3 text-left">
                          Email
                        </th>

                        <th className="px-4 py-3 text-left">
                          Error
                        </th>
                      </tr>
                    </thead>

                    <tbody>

                      {result.errors.map(
                        (item, index) => (
                          <tr
                            key={index}
                            className="border-t"
                          >
                            <td className="px-4 py-3">
                              {item.row}
                            </td>

                            <td className="px-4 py-3">
                              {item.registerNumber ||
                                "-"}
                            </td>

                            <td className="px-4 py-3">
                              {item.name ||
                                "-"}
                            </td>

                            <td className="px-4 py-3">
                              {item.email ||
                                "-"}
                            </td>

                            <td className="px-4 py-3 text-red-600">
                              {item.message}
                            </td>
                          </tr>
                        )
                      )}

                    </tbody>

                  </table>

                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}