"use client";

import { useState } from "react";
import StudentTable from "./components/StudentTable";
import AddStudent from "./components/AddStudent";
import BulkStudentUpload from "./components/BulkStudentUpload";

export default function StudentsPage() {
  const [view, setView] = useState("table");

  if (view === "add") {
    return (
      <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => setView("table")}
            className="mb-6 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Students
          </button>

          <h1 className="text-2xl font-semibold text-slate-950">
            Add Student
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Add a student manually.
          </p>

          <div className="mt-6">
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
      <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() => setView("table")}
            className="mb-6 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to Students
          </button>

          <h1 className="text-2xl font-semibold text-slate-950">
            Bulk Upload Students
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Upload multiple students using an Excel file or a CSV file.
          </p>

          <div className="mt-6">
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
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">

        <div className="mb-7">
          <p className="text-sm font-semibold text-slate-500">
            Academic Management
          </p>

          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Students
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Manage student records and academic information.
          </p>
        </div>

        <StudentTable
          onAddStudent={() => setView("add")}
          onBulkUpload={() => setView("bulk")}
        />

      </div>
    </main>
  );
}