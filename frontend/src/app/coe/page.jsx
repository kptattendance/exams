"use client";

import Link from "next/link";

const quickActions = [
  {
    title: "Register Numbers",
    description:
      "Generate and download register numbers for students.",
    href: "/coe/register-numbers",
    icon: "01",
  },
  {
    title: "Exam Applications",
    description:
      "Manage students appearing for examinations.",
    href: "/coe/applications",
    icon: "02",
  },
  {
    title: "Time Table",
    description:
      "Create and manage examination schedules.",
    href: "/coe/timetable",
    icon: "03",
  },
  {
    title: "Hall Tickets",
    description:
      "Generate and manage student hall tickets.",
    href: "/coe/hall-tickets",
    icon: "04",
  },
];

const modules = [
  {
    title: "Seating Arrangement",
    description:
      "Prepare examination hall seating plans.",
    href: "/coe/seating",
  },
  {
    title: "IA Marks",
    description:
      "Review and manage internal assessment marks.",
    href: "/coe/ia-marks",
  },
  {
    title: "Valuation",
    description:
      "Manage valuation and examination marks.",
    href: "/coe/valuation",
  },
  {
    title: "Results",
    description:
      "Process and publish examination results.",
    href: "/coe/results",
  },
];

export default function COEDashboard() {
  return (
    <main className="min-h-screen bg-slate-50 p-5 sm:p-6 lg:p-8">

      <div className="mx-auto max-w-[1500px]">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-sm font-semibold text-blue-600">
              Controller of Examinations
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Examination Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Central examination management for student registration,
              examinations, hall tickets, marks, results and reports.
            </p>

          </div>

          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">

            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Current Academic Year
            </p>

            <p className="mt-1 text-sm font-bold text-slate-900">
              2026–27
            </p>

          </div>

        </div>

        {/* =================================================
            STATUS CARDS
        ================================================= */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="Registered Students"
            value="—"
            description="Students with register numbers"
            icon="students"
          />

          <StatCard
            label="Exam Applications"
            value="—"
            description="Applications for current examination"
            icon="applications"
          />

          <StatCard
            label="Upcoming Exams"
            value="—"
            description="Scheduled examination papers"
            icon="calendar"
          />

          <StatCard
            label="Results Pending"
            value="—"
            description="Examinations awaiting result processing"
            icon="results"
          />

        </div>

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <section className="mt-8">

          <div className="mb-4">

            <h2 className="text-lg font-bold text-slate-950">
              Quick Actions
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Frequently used examination functions.
            </p>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {quickActions.map(
              (action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                >

                  <div className="flex items-start justify-between">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">
                      {action.icon}
                    </div>

                    <span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-slate-600">
                      →
                    </span>

                  </div>

                  <h3 className="mt-5 text-sm font-bold text-slate-900">
                    {action.title}
                  </h3>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {action.description}
                  </p>

                </Link>
              )
            )}

          </div>

        </section>

        {/* =================================================
            MAIN WORK AREA
        ================================================= */}

        <div className="mt-8 grid gap-6 xl:grid-cols-3">

          {/* UPCOMING EXAMINATION */}

          <section className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">

              <div>

                <h2 className="text-base font-bold text-slate-900">
                  Examination Activity
                </h2>

                <p className="mt-0.5 text-xs text-slate-400">
                  Current examination workflow
                </p>

              </div>

              <Link
                href="/coe/examinations"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View all
              </Link>

            </div>

            <div className="p-5">

              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">

                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-xl shadow-sm">
                  📋
                </div>

                <h3 className="mt-4 text-sm font-bold text-slate-900">
                  No active examination workflow
                </h3>

                <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                  Examination activity will appear here once an
                  examination cycle is created.
                </p>

                <Link
                  href="/coe/examinations"
                  className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  Create Examination
                </Link>

              </div>

            </div>

          </section>

          {/* COE STATUS */}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-5 py-4">

              <h2 className="text-base font-bold text-slate-900">
                COE Status
              </h2>

              <p className="mt-0.5 text-xs text-slate-400">
                Examination office overview
              </p>

            </div>

            <div className="space-y-4 p-5">

              <StatusRow
                label="Register Number Generation"
                status="Not Started"
              />

              <StatusRow
                label="Exam Applications"
                status="Not Started"
              />

              <StatusRow
                label="Time Table"
                status="Not Started"
              />

              <StatusRow
                label="Hall Tickets"
                status="Not Started"
              />

              <StatusRow
                label="Results"
                status="Not Started"
              />

            </div>

          </section>

        </div>

        {/* =================================================
            EXAMINATION MODULES
        ================================================= */}

        <section className="mt-8">

          <div className="mb-4">

            <h2 className="text-lg font-bold text-slate-950">
              Examination Modules
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Access the complete examination workflow.
            </p>

          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            {modules.map(
              (module) => (
                <Link
                  key={module.href}
                  href={module.href}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
                >

                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    →
                  </div>

                  <h3 className="mt-4 text-sm font-bold text-slate-900">
                    {module.title}
                  </h3>

                  <p className="mt-1.5 text-xs leading-5 text-slate-500">
                    {module.description}
                  </p>

                </Link>
              )
            )}

          </div>

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="mt-10 border-t border-slate-200 pt-5">

          <p className="text-center text-[11px] text-slate-400">
            KPT Examination ERP · Controller of Examinations
          </p>

        </div>

      </div>

    </main>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  description,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">

      <div className="flex items-start justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <SmallIcon type={icon} />
        </div>

        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          COE
        </span>

      </div>

      <p className="mt-5 text-xs font-semibold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-400">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   STATUS ROW
========================================================= */

function StatusRow({
  label,
  status,
}) {
  return (
    <div className="flex items-center justify-between gap-3">

      <div className="min-w-0">

        <p className="truncate text-xs font-semibold text-slate-700">
          {label}
        </p>

      </div>

      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
        {status}
      </span>

    </div>
  );
}

/* =========================================================
   SMALL ICONS
========================================================= */

function SmallIcon({ type }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "students") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
        <path d="M16 6a3 3 0 0 1 0 5.8" />
        <path d="M18 15c1.8.8 3 2.2 3 5" />
      </svg>
    );
  }

  if (type === "applications") {
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M14 3v4h4" />
        <path d="M9 12h6" />
        <path d="M9 16h4" />
      </svg>
    );
  }

  if (type === "calendar") {
    return (
      <svg {...common}>
        <rect
          x="3"
          y="5"
          width="18"
          height="16"
          rx="2"
        />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M3 10h18" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M12 16V9" />
      <path d="M16 16V6" />
    </svg>
  );
}