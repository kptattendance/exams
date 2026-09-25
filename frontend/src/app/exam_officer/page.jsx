"use client";

import Link from "next/link";

export default function ExamOfficerDashboard() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-600">
                <span>Exam Officer</span>

                <span className="text-slate-300">
                  /
                </span>

                <span>Overview</span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Examination Dashboard
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage student eligibility, examination candidates
                and hall ticket preparation.
              </p>
            </div>

            {/* Academic Year */}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Academic Year
              </p>

              <p className="mt-0.5 text-sm font-bold text-slate-900">
                2026–27
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">

        {/* =====================================================
            STAT CARDS
        ====================================================== */}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* Total Candidates */}

          <StatCard
            title="Total Candidates"
            value="—"
            subtitle="Current examination"
            icon="students"
          />

          {/* Eligible */}

          <StatCard
            title="Eligible Candidates"
            value="—"
            subtitle="Ready for examination"
            icon="eligible"
          />

          {/* Attendance */}

          <StatCard
            title="Attendance Shortage"
            value="—"
            subtitle="Requires action"
            icon="attendance"
          />

          {/* Fees */}

          <StatCard
            title="Fee Defaulters"
            value="—"
            subtitle="Fee pending"
            icon="fees"
          />
        </div>

        {/* =====================================================
            EXAMINATION SELECTION
        ====================================================== */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Examination Selection
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Select the examination to view and manage candidate
              eligibility.
            </p>
          </div>

          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-4">

            <SelectField
              label="Academic Year"
              options={[
                "2026-27",
                "2025-26",
                "2024-25",
              ]}
              defaultValue="2026-27"
            />

            <SelectField
              label="Examination"
              options={[
                "Select Examination",
                "SEE",
                "Practical Examination",
                "Supplementary Examination",
              ]}
              defaultValue="Select Examination"
            />

            <SelectField
              label="Semester"
              options={[
                "All Semesters",
                "Semester 1",
                "Semester 2",
                "Semester 3",
                "Semester 4",
                "Semester 5",
                "Semester 6",
              ]}
              defaultValue="All Semesters"
            />

            <SelectField
              label="Department"
              options={[
                "All Departments",
                "AT",
                "CH",
                "CE",
                "CS",
                "EC",
                "EE",
                "ME",
                "PS",
              ]}
              defaultValue="All Departments"
            />
          </div>

          <div className="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <svg
                width="17"
                height="17"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9" />
                <path d="M21 3v6h-6" />
              </svg>

              Load Examination
            </button>
          </div>
        </div>

        {/* =====================================================
            ELIGIBILITY SUMMARY
        ====================================================== */}

        <div className="mt-6 grid gap-6 xl:grid-cols-2">

          {/* Eligibility */}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Eligibility Summary
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Current examination candidate status.
              </p>
            </div>

            <div className="divide-y divide-slate-100">

              <SummaryRow
                label="Eligible Candidates"
                value="—"
                type="success"
              />

              <SummaryRow
                label="Attendance Shortage"
                value="—"
                type="danger"
              />

              <SummaryRow
                label="Fee Pending"
                value="—"
                type="warning"
              />

              <SummaryRow
                label="Other Restrictions"
                value="—"
                type="neutral"
              />

              <SummaryRow
                label="Back Paper Candidates"
                value="—"
                type="info"
              />

            </div>
          </div>

          {/* Quick Actions */}

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Quick Actions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Frequently used examination functions.
              </p>
            </div>

            <div className="grid gap-3 p-5 sm:grid-cols-2">

              <QuickAction
                href="/exam-officer/attendance-shortage"
                title="Attendance Shortage"
                description="Mark students with attendance shortage."
                icon="attendance"
              />

              <QuickAction
                href="/exam-officer/fee-defaulters"
                title="Fee Defaulters"
                description="Manage students with pending fees."
                icon="fees"
              />

              <QuickAction
                href="/exam-officer/candidates"
                title="Candidate List"
                description="View eligible examination candidates."
                icon="candidates"
              />

              <QuickAction
                href="/exam-officer/hall-tickets"
                title="Hall Tickets"
                description="Prepare examination hall tickets."
                icon="ticket"
              />

            </div>
          </div>
        </div>

        {/* =====================================================
            EXAMINATION WORKFLOW
        ====================================================== */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-bold text-slate-900">
              Examination Preparation Workflow
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Candidate eligibility flows through these stages.
            </p>
          </div>

          <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">

            <WorkflowStep
              number="01"
              title="Student Data"
              description="Student and subject registration data."
            />

            <WorkflowStep
              number="02"
              title="Attendance"
              description="Identify attendance shortage."
            />

            <WorkflowStep
              number="03"
              title="Fee Status"
              description="Verify examination fee payment."
            />

            <WorkflowStep
              number="04"
              title="Candidate List"
              description="Generate eligible candidates."
            />

            <WorkflowStep
              number="05"
              title="Hall Ticket"
              description="Generate hall tickets for eligible candidates."
            />

          </div>
        </div>

        {/* =====================================================
            IMPORTANT NOTICE
        ====================================================== */}

        <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">

          <div className="flex gap-4">

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />

                <path d="M12 11v5" />
                <path d="M12 8h.01" />
              </svg>
            </div>

            <div>
              <h3 className="text-sm font-bold text-blue-900">
                Candidate Eligibility
              </h3>

              <p className="mt-1 text-xs leading-5 text-blue-800">
                Hall tickets should be generated only for candidates
                who satisfy the applicable examination eligibility
                conditions. Attendance shortage and fee restrictions
                will be reflected in the candidate eligibility status.
              </p>
            </div>

          </div>
        </div>

        {/* =====================================================
            FOOTER
        ====================================================== */}

        <div className="py-8 text-center">
          <p className="text-xs text-slate-400">
            KPT Examination ERP • Examination Officer
          </p>
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  title,
  value,
  subtitle,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">

        <div>
          <p className="text-xs font-semibold text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-[11px] text-slate-400">
            {subtitle}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <DashboardIcon type={icon} />
        </div>

      </div>
    </div>
  );
}

/* =========================================================
   SELECT FIELD
========================================================= */

function SelectField({
  label,
  options,
  defaultValue,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <select
        defaultValue={defaultValue}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/* =========================================================
   SUMMARY ROW
========================================================= */

function SummaryRow({
  label,
  value,
  type,
}) {
  const styles = {
    success:
      "bg-emerald-50 text-emerald-700",
    danger:
      "bg-red-50 text-red-700",
    warning:
      "bg-amber-50 text-amber-700",
    neutral:
      "bg-slate-100 text-slate-600",
    info:
      "bg-blue-50 text-blue-700",
  };

  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm font-medium text-slate-600">
        {label}
      </span>

      <span
        className={`min-w-[42px] rounded-lg px-3 py-1 text-center text-sm font-bold ${styles[type]}`}
      >
        {value}
      </span>
    </div>
  );
}

/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  href,
  title,
  description,
  icon,
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
    >
      <div className="flex items-start gap-3">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition group-hover:bg-blue-100 group-hover:text-blue-600">
          <DashboardIcon type={icon} />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800">
            {title}
          </p>

          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {description}
          </p>
        </div>

      </div>
    </Link>
  );
}

/* =========================================================
   WORKFLOW STEP
========================================================= */

function WorkflowStep({
  number,
  title,
  description,
}) {
  return (
    <div className="relative rounded-xl border border-slate-200 p-4">

      <div className="flex items-center gap-3">

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-white">
          {number}
        </div>

        <p className="text-sm font-bold text-slate-800">
          {title}
        </p>

      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </div>
  );
}

/* =========================================================
   DASHBOARD ICONS
========================================================= */

function DashboardIcon({
  type,
}) {
  const common = {
    width: 19,
    height: 19,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (type) {
    case "students":
    case "candidates":
      return (
        <svg {...common}>
          <circle
            cx="9"
            cy="8"
            r="3"
          />

          <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />

          <path d="m16 11 2 2 3-3" />
        </svg>
      );

    case "eligible":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="12"
            r="9"
          />

          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );

    case "attendance":
      return (
        <svg {...common}>
          <rect
            x="4"
            y="3"
            width="16"
            height="18"
            rx="2"
          />

          <path d="M8 7h8" />
          <path d="M8 11h3" />
          <path d="M8 15h3" />
          <path d="m14 11 1.5 1.5L18 10" />
        </svg>
      );

    case "fees":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="2"
          />

          <path d="M3 10h18" />
          <path d="M7 15h4" />

          <circle
            cx="17"
            cy="15"
            r="2"
          />
        </svg>
      );

    case "ticket":
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v3h16v-3a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4V4H4z" />
          <path d="M12 7v10" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="12"
            r="8"
          />
        </svg>
      );
  }
}