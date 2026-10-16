"use client";

// Compact filter bar for the Admin "Users" and "Login accounts" pages.
//   const f = useAccountFilters(users);
//   <AccountFilters users={users} {...f} />   …   f.filtered.map(…)

import { useMemo, useState } from "react";

import { ROLE_OPTIONS } from "./roles";
import { DESIGNATIONS } from "./designations";
import { sortOptions } from "./sortOptions";

const DEPARTMENTS = [
  ["at", "Automobile"],
  ["ch", "Chemical"],
  ["ce", "Civil"],
  ["cs", "Computer Science"],
  ["ec", "Electronics & Comm."],
  ["ee", "Electrical & Electronics"],
  ["me", "Mechanical"],
  ["ps", "Polymer"],
  ["sc", "Science & English"],
  ["ot", "Others"],
];

const ROLES = [...ROLE_OPTIONS.map((r) => [r.value, r.label]), ["staff", "Faculty"], ["student", "Student"]];
ROLES.sort(sortOptions);
DEPARTMENTS.sort(sortOptions);

const EMPTY = { search: "", role: "", department: "", semester: "", designation: "", college: "" };
const lower = (v) => String(v ?? "").trim().toLowerCase();

export function useAccountFilters(users = []) {
  const [filters, setFilters] = useState(EMPTY);
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clear = () => setFilters(EMPTY);

  const filtered = useMemo(() => {
    const q = lower(filters.search);
    return users.filter(
      (u) =>
        (!q || [u.name, u.email, u.registerNumber].some((v) => lower(v).includes(q))) &&
        (!filters.role || u.role === filters.role) &&
        (!filters.department || lower(u.department) === filters.department) &&
        (!filters.semester || String(u.semester ?? "") === filters.semester) &&
        (!filters.designation || u.designation === filters.designation) &&
        (!filters.college || String(u.collegeCode || "") === filters.college)
    );
  }, [users, filters]);

  const active = Object.values(filters).some(Boolean);
  return { filters, set, clear, filtered, active };
}

const field = "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 outline-none focus:border-slate-400";

export default function AccountFilters({ users = [], filters, set, clear, filtered, active }) {
  // Only offer what exists in the data
  const semesters = [...new Set(users.map((u) => u.semester).filter(Boolean))].sort((a, b) => a - b);
  const colleges = [...new Map(users.filter((u) => u.collegeCode).map((u) => [String(u.collegeCode), u.collegeName])).entries()].sort();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search name, email, reg. no."
          className={`${field} w-56 pr-7`}
        />
        {filters.search && (
          <button
            type="button"
            onClick={() => set("search", "")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      <select value={filters.role} onChange={(e) => set("role", e.target.value)} className={field}>
        <option value="">All roles</option>
        {ROLES.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>

      <select value={filters.department} onChange={(e) => set("department", e.target.value)} className={field}>
        <option value="">All departments</option>
        {DEPARTMENTS.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>

      {semesters.length > 0 && (
        <select value={filters.semester} onChange={(e) => set("semester", e.target.value)} className={field}>
          <option value="">All semesters</option>
          {semesters.map((s) => (
            <option key={s} value={String(s)}>
              Sem {s}
            </option>
          ))}
        </select>
      )}

      <select value={filters.designation} onChange={(e) => set("designation", e.target.value)} className={field}>
        <option value="">All designations</option>
        {DESIGNATIONS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      {colleges.length > 0 && (
        <select value={filters.college} onChange={(e) => set("college", e.target.value)} className={`${field} max-w-[11rem]`}>
          <option value="">All colleges</option>
          {colleges.map(([code, name]) => (
            <option key={code} value={code}>
              {code} {name ? `– ${name}` : ""}
            </option>
          ))}
        </select>
      )}

      {active && (
        <button type="button" onClick={clear} className="h-9 rounded-lg px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
          Clear
        </button>
      )}

      <span className="text-xs text-slate-500">
        {filtered.length === users.length ? `${users.length} accounts` : `${filtered.length} of ${users.length}`}
      </span>
    </div>
  );
}
