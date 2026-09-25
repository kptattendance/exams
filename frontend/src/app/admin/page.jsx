"use client";

import Link from "next/link";
import axios from "axios";
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const dashboardItems = [
  {
    key: "faculty",
    title: "Faculty",
    description: "Manage faculty members and their academic details.",
    href: "/admin/faculty",
    icon: "👨‍🏫",
  },
  {
    key: "subjects",
    title: "Subjects",
    description: "Manage subjects, departments, semesters and credits.",
    href: "/admin/subjects",
    icon: "📚",
  },
  {
    key: "students",
    title: "Students",
    description: "View and manage registered students and records.",
    href: "/admin/students",
    icon: "🎓",
  },
  {
    key: "attendance",
    title: "Attendance",
    description: "Monitor monthly attendance across subjects.",
    href: "/admin/attendance",
    icon: "📅",
  },
  {
    key: "iaMarks",
    title: "IA Marks",
    description: "Manage internal assessment marks and records.",
    href: "/admin/ia-marks",
    icon: "📊",
  },
];

export default function AdminDashboard() {
  const { getToken } = useAuth();

  const [stats, setStats] = useState({
    faculty: 0,
    subjects: 0,
    students: 0,
    attendance: 0,
    iaMarks: 0,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");

  useEffect(() => {
    const loadDashboardStats = async () => {
      try {
        setLoadingStats(true);
        setStatsError("");

        const token = await getToken();

        const response = await axios.get(
          `${API_URL}/api/users/stats`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );


        setStats({
          faculty: response.data?.data?.faculty ?? 0,
          subjects: response.data?.data?.subjects ?? 0,
          students: response.data?.data?.students ?? 0,
          attendance: response.data?.data?.attendance ?? 0,
          iaMarks: response.data?.data?.iaMarks ?? 0,
        });
      } catch (error) {
        console.error(
          "Dashboard statistics error:",
          error
        );

        console.error(
          "Backend response:",
          error?.response?.data
        );

        setStatsError(
          error?.response?.data?.message ||
            "Unable to load dashboard statistics."
        );
      } finally {
        setLoadingStats(false);
      }
    };

    if (API_URL) {
      loadDashboardStats();
    } else {
      setLoadingStats(false);
      setStatsError(
        "NEXT_PUBLIC_API_URL is not configured."
      );
    }
  }, [getToken]);

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">

      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
              Administration
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Manage faculty, subjects, students, attendance
              and internal assessment from one place.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">

            <p className="text-xs font-medium text-slate-400">
              System
            </p>

            <div className="mt-1 flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-emerald-500" />

              <span className="text-sm font-semibold text-slate-700">
                Operational
              </span>

            </div>

          </div>
        </div>
      </div>

      {/* ERROR */}
      {statsError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {statsError}
        </div>
      )}

      {/* SECTION TITLE */}
      <div className="mb-4">

        <h2 className="text-sm font-semibold text-slate-900">
          Academic Overview
        </h2>

        <p className="mt-1 text-xs text-slate-400">
          Quick access to major academic modules
        </p>

      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">

        {dashboardItems.map((item) => (

          <Link
            key={item.key}
            href={item.href}
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
          >

            <div className="flex items-start justify-between">

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                {item.icon}
              </div>

              <div className="text-2xl font-bold text-slate-900">

                {loadingStats ? (
                  <div className="h-7 w-12 animate-pulse rounded bg-slate-200" />
                ) : (
                  stats[item.key]
                )}

              </div>

            </div>

            <div className="mt-6">

              <h3 className="text-base font-semibold text-slate-900">
                {item.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                {item.description}
              </p>

            </div>

            <div className="mt-6 flex items-center text-sm font-semibold text-slate-600 transition group-hover:text-slate-950">

              <span>
                Open module
              </span>

              <span className="ml-2 transition-transform group-hover:translate-x-1">
                →
              </span>

            </div>

          </Link>

        ))}

      </div>


    </div>
  );
}