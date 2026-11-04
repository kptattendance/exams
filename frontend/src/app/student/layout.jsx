"use client";

// Student login: one page only – his own details. No menu, no other pages
// (the server refuses everything else for a student account).

import { useClerk } from "@clerk/nextjs";

export default function StudentLayout({ children }) {
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.jpg" alt="" className="h-9 w-9 rounded-full object-contain" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold text-slate-950">Karnataka (Govt.) Polytechnic, Mangaluru</p>
            <p className="text-xs text-slate-500">Student</p>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-5 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
