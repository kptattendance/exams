"use client";

import Link from "next/link";
import Navbar from "./components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="min-h-[calc(100vh-4rem)] bg-slate-50">

        {/* =========================
            HERO SECTION
        ========================== */}

        <section className="relative overflow-hidden">

          {/* Background decoration */}
          <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-slate-200/60 blur-3xl" />

          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-slate-200/50 blur-3xl" />

          <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl items-center px-6 py-16">

            <div className="max-w-5xl">

              {/* Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">

                <span className="h-2 w-2 rounded-full bg-slate-900" />

                <span className="text-xs font-semibold uppercase tracking-widest text-slate-600">
                  KPT Mangaluru
                </span>

              </div>

              {/* Main Heading */}
              <h1 className="max-w-5xl text-5xl font-bold leading-tight tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">

                Examination

                <span className="block text-slate-500">
                  Management System
                </span>

              </h1>

              {/* Description */}
              <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600">

                A centralized platform for managing students, departments,
                subjects, examinations, internal assessment marks,
                examination records and results.

              </p>

              {/* Button */}
              <div className="mt-9 flex flex-wrap items-center gap-4">

                <Link
                  href="/admin"
                  className="rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Go to Dashboard
                </Link>

                <div className="flex items-center gap-2 text-sm text-slate-500">

                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm">
                    ✓
                  </span>

                  Secure examination management

                </div>

              </div>

              {/* Feature Cards */}
              <div className="mt-16 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <FeatureCard
                  title="Students"
                  description="Manage student registration and academic information"
                  icon="♙"
                />

                <FeatureCard
                  title="Subjects"
                  description="Manage subjects, semesters and academic schemes"
                  icon="▤"
                />

                <FeatureCard
                  title="Examinations"
                  description="Manage examination types and examination records"
                  icon="▣"
                />

                <FeatureCard
                  title="Results"
                  description="Manage marks, results and result status"
                  icon="✓"
                />

              </div>

            </div>

          </div>

        </section>

      </main>
    </>
  );
}


/* ---------------------------------
   Feature Card
---------------------------------- */

function FeatureCard({ title, description, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">

      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-900">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </div>
  );
}