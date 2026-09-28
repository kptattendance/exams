"use client";

import { useState } from "react";
import StudentTable from "./components/StudentTable";
import AddStudent from "./components/AddStudent";
import BulkStudentUpload from "./components/BulkStudentUpload";

export default function StudentsPage() {
  const [view, setView] = useState("table");

  if (view === "add") {
    return (
      <main className="min-h-screen bg-white p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">

          <button
            onClick={() => setView("table")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-600 transition hover:text-amber-700"
          >
            ← Back to Students
          </button>

          <div className="mb-7">
            <p className="text-sm font-semibold text-amber-600">
              Academic Management
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Add Student
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Add a student manually.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
            <AddStudent
              onSuccess={() => setView("table")}
              onCancel={() => setView("table")}
            />
          </div>

        </div>
      </main>
    );
  }

  if (view === "bulk") {
    return (
      <main className="min-h-screen bg-white p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">

          <button
            onClick={() => setView("table")}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-amber-600 transition hover:text-amber-700"
          >
            ← Back to Students
          </button>

          <div className="mb-7">
            <p className="text-sm font-semibold text-amber-600">
              Academic Management
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Bulk Upload Students
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Upload multiple students using an Excel file or a CSV file.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
            <BulkStudentUpload
              onSuccess={() => setView("table")}
              onCancel={() => setView("table")}
            />
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-sm font-semibold text-amber-600">
              Academic Management
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Students
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage student records and academic information.
            </p>
          </div>

        </div>

        {/* STUDENT TABLE */}
        <div className="rounded-2xl border border-amber-200 bg-white shadow-sm">
          <StudentTable
            onAddStudent={() => setView("add")}
            onBulkUpload={() => setView("bulk")}
          />
        </div>

      </div>
    </main>
  );
}