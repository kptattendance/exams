"use client";

// HOD dashboard: who he is (photo, designation, department) and the real
// number of students and subjects of his department.

import Link from "next/link";
import { useEffect, useState } from "react";

import { useApi, programmeName } from "../components/exams/shared";

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

export default function HODDashboard() {
  const api = useApi();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null); // { students, subjects }
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = (await api("get", "/users/me")).data?.data;
        setProfile(me || {});
        const department = me?.department || "";
        // the server already limits a HOD to his own department's students
        const [st, sub] = await Promise.allSettled([api("get", "/students"), api("get", "/subjects/getsubjects")]);
        const list = (r) => (r.status === "fulfilled" ? r.value?.data?.data || r.value?.data?.students || r.value?.data?.subjects || [] : null);
        const students = list(st);
        const subjects = list(sub);
        setStats({
          students: students ? students.filter((s) => !department || same(s.department, department)).length : null,
          subjects: subjects ? subjects.filter((s) => !department || same(s.department, department)).length : null,
        });
      } catch {
        setError("Could not load your details. Please refresh the page.");
        setStats({ students: null, subjects: null });
      }
    })();
  }, [api]);

  const initials = String(profile?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">HOD Dashboard</p>

      {/* who */}
      <div className="mt-3 flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:flex-row sm:text-left">
        {profile === null ? (
          <div className="h-24 w-full animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <>
            {profile.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.imageUrl} alt={profile.name || "Photo"} className="h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-slate-200" />
            ) : (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-2xl font-bold text-white">{initials || "HOD"}</span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{profile.name || "Head of Department"}</h1>
              <p className="mt-0.5 text-sm font-semibold text-slate-700">{profile.designation || "Head of Department"}</p>
              <p className="text-sm text-slate-500">{profile.department ? `${programmeName(profile.department)} department` : "Department not set"}</p>
            </div>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* counts */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <Stat label="Students" hint="in your department" value={stats?.students} href="/hod/students" />
        <Stat label="Subjects" hint="of your department" value={stats?.subjects} />
      </div>
    </div>
  );
}

function Stat({ label, hint, value, href }) {
  const body = (
    <>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      {value === undefined ? (
        <p className="mt-2 text-sm font-semibold text-slate-400">Loading… please wait</p>
      ) : (
        <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">{value === null ? "–" : value}</p>
      )}
      <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
    </>
  );
  const cls = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-slate-400`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
