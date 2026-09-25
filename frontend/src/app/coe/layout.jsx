"use client";

import { useState } from "react";
import Sidebar from "./components/Sidebar";

export default function COELayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <Sidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* =====================================================
          MAIN AREA
      ===================================================== */}

      <div className="lg:pl-[270px]">

        {/* =================================================
            MOBILE HEADER
        ================================================= */}

        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50"
            aria-label="Open navigation"
          >
            <svg
              width="20"
              height="20"
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
            <p className="text-sm font-bold text-slate-900">
              Examination ERP
            </p>

            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
              COE Office
            </p>
          </div>

        </header>

        {/* =================================================
            PAGE CONTENT
        ================================================= */}

        <main className="min-h-[calc(100vh-64px)]">
          {children}
        </main>

      </div>

    </div>
  );
}