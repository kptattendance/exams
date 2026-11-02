"use client";

// Evening Principal: the evening college (register numbers 186…). He does for
// all evening students what a HOD does for his department, on the same pages
// as the HODs. The department he works on (EE / ME) is chosen at the top and
// sent with every request (X-Department); the server shows only evening
// students and the evening IA / attendance sheets (backend services/evening.js).

import { useState } from "react";
import axios from "axios";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";

const API = process.env.NEXT_PUBLIC_API_URL || "";
const STORE = "kpt-evening-department";
const DEPARTMENTS = [
  ["ee", "Electrical and Electronics Engineering"],
  ["me", "Mechanical Engineering"],
];

const current = () => {
  try {
    const d = localStorage.getItem(STORE);
    return DEPARTMENTS.some(([k]) => k === d) ? d : DEPARTMENTS[0][0];
  } catch {
    return DEPARTMENTS[0][0];
  }
};

// Installed while the page is drawn (before any page loads its data), once
let installed = false;
function installDepartmentHeader() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  axios.interceptors.request.use((config) => {
    if (API && String(config.url || "").startsWith(API)) {
      config.headers = config.headers || {};
      config.headers["X-Department"] = current();
    }
    return config;
  });
}

export default function EveningLayout({ children }) {
  installDepartmentHeader();
  const [dept, setDept] = useState(() => (typeof window === "undefined" ? DEPARTMENTS[0][0] : current()));

  const choose = (d) => {
    try {
      localStorage.setItem(STORE, d);
    } catch {
      // the header falls back to the first department
    }
    setDept(d);
  };

  return (
    <AppShell menu={MENUS.evening}>
      <div className="border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5 sm:px-6 lg:px-7">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-indigo-900">Evening college · Department</span>
          {DEPARTMENTS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => choose(k)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition ${dept === k ? "bg-indigo-600 text-white" : "bg-white text-indigo-800 ring-1 ring-indigo-200 hover:bg-indigo-100"}`}
              title={label}
            >
              {k.toUpperCase()} <span className="hidden font-normal sm:inline">– {label}</span>
            </button>
          ))}
          <span className="text-xs text-indigo-700">Only evening students (register numbers 186…) are shown.</span>
        </div>
      </div>
      {/* a new department: every page loads again for it */}
      <div key={dept}>{children}</div>
    </AppShell>
  );
}
