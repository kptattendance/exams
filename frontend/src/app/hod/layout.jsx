"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";

export default function HODLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">

      <Sidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="lg:pl-[270px]">

        {/* Mobile Header */}
        <div className="sticky top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white px-4 lg:hidden">

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="18" x2="20" y2="18" />
            </svg>
          </button>

          <div className="ml-3">
            <p className="text-sm font-bold text-slate-950">
              KPT Examination ERP
            </p>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
              HOD Portal
            </p>
          </div>

        </div>

        <main className="min-h-screen">
          {children}
        </main>

      </div>

    </div>
  );
}