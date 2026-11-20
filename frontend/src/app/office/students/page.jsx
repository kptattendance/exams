"use client";

import StudentTable from "../../coe/students/components/StudentTable";

// Exam section office: see and edit students. One Edit button opens every
// detail (the photo too) in one form – nothing else to press.
export default function OfficeStudentsPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Students</h1>
          <p className="mt-2 text-sm text-slate-500">Press Edit to change any detail of a student, the photo too.</p>
        </div>
        <StudentTable officeMode />
      </div>
    </main>
  );
}
