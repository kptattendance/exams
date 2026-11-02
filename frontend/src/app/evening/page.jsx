"use client";

import Link from "next/link";

// Evening Principal: start page – what to do, in order
const STEPS = [
  ["/evening/students", "Students", "Evening students of the department chosen above (register numbers 186…)."],
  ["/evening/electives", "Electives", "Semester 3: tick PA or PB for each student."],
  ["/evening/final-ia", "Final IA", "Enter the IA marks (Excel or on screen), then Submit – the Exam Officer freezes it."],
  ["/evening/attendance", "Final attendance", "Enter attendance %, then Submit."],
  ["/evening/exam-fees", "Exam fee list", "Each student's subjects and exam fee – PDF to share."],
];

export default function EveningHome() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Evening college</h1>
      <p className="mt-1 text-sm text-slate-500">
        Same subjects and the same theory exams as the day college. Choose the department at the top, then work through these pages.
      </p>
      <ol className="mt-5 space-y-3">
        {STEPS.map(([href, title, text], i) => (
          <li key={href}>
            <Link href={href} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50/40">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
              <span>
                <span className="block font-semibold text-slate-900">{title}</span>
                <span className="block text-sm text-slate-500">{text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
