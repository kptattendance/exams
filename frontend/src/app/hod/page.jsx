"use client";

import { useAuth } from "@clerk/nextjs";
import axios from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function HODDashboard() {
  const { getToken } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    faculty: 0,
    subjects: 0,
    students: 0,
    iaRecords: 0,
    attendanceRecords: 0,
  });

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      const token = await getToken();

      /*
       * IMPORTANT:
       * These endpoints are kept separate so the HOD
       * dashboard never receives another department's data.
       *
       * Backend should derive department from req.user.department.
       */

      const config = {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      };

      const [profileRes, facultyRes, subjectRes, studentRes] =
        await Promise.allSettled([
          axios.get(`${API_URL}/api/users/me`, config),

          axios.get(`${API_URL}/api/users?role=staff`, config),

          axios.get(`${API_URL}/api/subjects`, config),

          axios.get(`${API_URL}/api/students`, config),
        ]);

      let department = "";

      if (profileRes.status === "fulfilled") {
        const data = profileRes.value?.data?.data;

        if (data) {
          setProfile(data);
          department = data.department || "";
        }
      }

      if (facultyRes.status === "fulfilled") {
        const data =
          facultyRes.value?.data?.data ||
          facultyRes.value?.data?.users ||
          [];

        const filtered = department
          ? data.filter(
              (item) =>
                String(item.department || "")
                  .toLowerCase() ===
                String(department).toLowerCase()
            )
          : data;

        setStats((prev) => ({
          ...prev,
          faculty: filtered.length,
        }));
      }

      if (subjectRes.status === "fulfilled") {
        const data =
          subjectRes.value?.data?.data || [];

        const filtered = department
          ? data.filter(
              (item) =>
                String(item.department || "")
                  .toLowerCase() ===
                String(department).toLowerCase()
            )
          : data;

        setStats((prev) => ({
          ...prev,
          subjects: filtered.length,
        }));
      }

      if (studentRes.status === "fulfilled") {
        const data =
          studentRes.value?.data?.data ||
          studentRes.value?.data?.students ||
          [];

        const filtered = department
          ? data.filter(
              (item) =>
                String(item.department || "")
                  .toLowerCase() ===
                String(department).toLowerCase()
            )
          : data;

        setStats((prev) => ({
          ...prev,
          students: filtered.length,
        }));
      }

    } catch (error) {
      console.error(
        "HOD Dashboard Error:",
        error
      );
    } finally {
      setLoading(false);
    }
  };

  const departmentName =
    profile?.departmentName ||
    profile?.department ||
    "Department";

  return (
    <div className="p-4 sm:p-6 lg:p-8">

      {/* Header */}
      <div className="mb-7">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">
              HOD Dashboard
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Department Overview
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage faculty, subjects, students and academic records.
            </p>

          </div>

          <div className="rounded-xl border border-amber-200 bg-white px-4 py-3">

            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Department
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              {departmentName}
            </p>

          </div>

        </div>

      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">

        <StatCard
          title="Faculty"
          value={stats.faculty}
          description="Department faculty"
          href="/hod/faculty"
        />

        <StatCard
          title="Subjects"
          value={stats.subjects}
          description="Department subjects"
          href="/hod/subjects"
        />

        <StatCard
          title="Students"
          value={stats.students}
          description="Department students"
          href="/hod/students"
        />

        <StatCard
          title="IA Records"
          value={stats.iaRecords}
          description="Finalised IA"
          href="/hod/ia-marks"
        />

        <StatCard
          title="Attendance"
          value={stats.attendanceRecords}
          description="Finalised records"
          href="/hod/attendance"
        />

      </div>

      {/* Main cards */}
      <div className="mt-7 grid gap-6 xl:grid-cols-2">

        {/* IA */}
        <DashboardCard
          title="IA Marks"
          description="Upload the finalised IA marks for the department."
          href="/hod/ia-marks"
          button="Open IA Marks"
        >
          <div className="grid grid-cols-3 gap-3">

            <MiniInfo
              label="Upload"
              value="Excel"
            />

            <MiniInfo
              label="Validation"
              value="Required"
            />

            <MiniInfo
              label="Status"
              value="Frozen"
            />

          </div>
        </DashboardCard>

        {/* Attendance */}
        <DashboardCard
          title="Attendance"
          description="Upload the finalised attendance records for the department."
          href="/hod/attendance"
          button="Open Attendance"
        >
          <div className="grid grid-cols-3 gap-3">

            <MiniInfo
              label="Upload"
              value="Excel"
            />

            <MiniInfo
              label="Records"
              value="Final"
            />

            <MiniInfo
              label="Review"
              value="Available"
            />

          </div>
        </DashboardCard>

      </div>

      {/* Quick access */}
      <div className="mt-7 rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">

        <div className="mb-5">

          <h2 className="text-base font-bold text-slate-950">
            Department Data
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            View department information with filters and Excel reports.
          </p>

        </div>

        <div className="grid gap-3 sm:grid-cols-3">

          <QuickLink
            href="/hod/faculty"
            title="Faculty"
            description="View department faculty"
          />

          <QuickLink
            href="/hod/subjects"
            title="Subjects"
            description="View assigned subjects"
          />

          <QuickLink
            href="/hod/students"
            title="Students"
            description="View department students"
          />

        </div>

      </div>

    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  href,
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md"
    >
      <p className="text-xs font-semibold text-slate-500">
        {title}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        {description}
      </p>
    </Link>
  );
}

function DashboardCard({
  title,
  description,
  href,
  button,
  children,
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div>

          <h2 className="text-base font-bold text-slate-950">
            {title}
          </h2>

          <p className="mt-1 max-w-lg text-xs leading-5 text-slate-500">
            {description}
          </p>

        </div>

        <Link
          href={href}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-600"
        >
          {button}
        </Link>

      </div>

      <div className="mt-5">
        {children}
      </div>

    </div>
  );
}

function MiniInfo({
  label,
  value,
}) {
  return (
    <div className="rounded-xl bg-amber-50 p-3">

      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-slate-800">
        {value}
      </p>

    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-amber-200 p-4 transition hover:border-amber-300 hover:bg-amber-50"
    >

      <p className="text-sm font-bold text-slate-900">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {description}
      </p>

    </Link>
  );
}