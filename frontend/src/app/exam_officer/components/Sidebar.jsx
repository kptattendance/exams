"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuSections = [
  // =====================================================
  // OVERVIEW
  // =====================================================

  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/exam-officer",
        icon: "dashboard",
      },
    ],
  },

  // =====================================================
  // STUDENT ELIGIBILITY
  // =====================================================

  {
    title: "Student Eligibility",
    items: [
      {
        label: "Attendance Shortage",
        href: "/exam-officer/attendance-shortage",
        icon: "attendance",
      },
      {
        label: "Fee Defaulters",
        href: "/exam-officer/fee-defaulters",
        icon: "fees",
      },
      {
        label: "Candidate List",
        href: "/exam-officer/candidates",
        icon: "candidates",
      },
    ],
  },

  // =====================================================
  // EXAMINATION
  // =====================================================

  {
    title: "Examination",
    items: [
      {
        label: "Examinations",
        href: "/exam-officer/examinations",
        icon: "exam",
      },
      {
        label: "Subject-wise Candidates",
        href: "/exam-officer/subjects",
        icon: "subjects",
      },
      {
        label: "Back Paper Candidates",
        href: "/exam-officer/back-papers",
        icon: "backpaper",
      },
      {
        label: "Hall Tickets",
        href: "/exam-officer/hall-tickets",
        icon: "ticket",
      },
    ],
  },

  // =====================================================
  // REPORTS
  // =====================================================

  {
    title: "Reports",
    items: [
      {
        label: "Eligibility Report",
        href: "/exam-officer/reports/eligibility",
        icon: "eligibility",
      },
      {
        label: "Attendance Report",
        href: "/exam-officer/reports/attendance",
        icon: "attendance",
      },
      {
        label: "Fee Defaulter Report",
        href: "/exam-officer/reports/fees",
        icon: "fees",
      },
      {
        label: "Candidate Reports",
        href: "/exam-officer/reports/candidates",
        icon: "report",
      },
    ],
  },

  // =====================================================
  // ACCOUNT
  // =====================================================

  {
    title: "Account",
    items: [
      {
        label: "Profile",
        href: "/exam-officer/profile",
        icon: "profile",
      },
    ],
  },
];

export default function Sidebar({
  mobileOpen,
  onClose,
}) {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/exam-officer") {
      return pathname === "/exam-officer";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-slate-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
        mobileOpen
          ? "translate-x-0"
          : "-translate-x-full"
      }`}
    >
      {/* =====================================================
          BRAND
      ====================================================== */}

      <div className="flex h-[76px] shrink-0 items-center border-b border-slate-100 px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19V5" />
              <path d="M4 5h13l3 3-3 3H4" />
              <path d="M8 15h8" />
              <path d="M8 18h5" />
            </svg>
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">
              KPT Examination ERP
            </p>

            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />

              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-600">
                Exam Officer
              </p>
            </div>
          </div>
        </div>

        {/* Mobile Close */}

        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Close navigation"
        >
          ✕
        </button>
      </div>

      {/* =====================================================
          EXAM OFFICER IDENTITY
      ====================================================== */}

      <div className="mx-4 mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            EO
          </div>

          <div>
            <p className="text-xs font-bold text-slate-900">
              Examination Officer
            </p>

            <p className="mt-0.5 text-[10px] text-slate-500">
              Candidate & Eligibility Management
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          NAVIGATION
      ====================================================== */}

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {menuSections.map((section) => (
          <div
            key={section.title}
            className="mb-6"
          >
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {section.title}
            </p>

            <div className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    }`}
                  >
                    <MenuIcon
                      type={item.icon}
                      active={active}
                    />

                    <span className="flex-1">
                      {item.label}
                    </span>

                    {active && (
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* =====================================================
          BOTTOM PROFILE
      ====================================================== */}

      <div className="shrink-0 border-t border-slate-100 p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            EO
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-900">
              Examination Officer
            </p>

            <p className="truncate text-[10px] text-slate-400">
              Examination Office
            </p>
          </div>

          <button
            type="button"
            className="text-slate-400 hover:text-slate-700"
            title="Account options"
          >
            ⋮
          </button>
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   MENU ICONS
========================================================= */

function MenuIcon({
  type,
  active,
}) {
  const stroke = active
    ? "currentColor"
    : "currentColor";

  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (type) {
    // -----------------------------------------------------
    // DASHBOARD
    // -----------------------------------------------------

    case "dashboard":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1"
          />
          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1"
          />
          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1"
          />
          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1"
          />
        </svg>
      );

    // -----------------------------------------------------
    // ATTENDANCE
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // FEES
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // CANDIDATES
    // -----------------------------------------------------

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

    // -----------------------------------------------------
    // EXAMINATION
    // -----------------------------------------------------

    case "exam":
      return (
        <svg {...common}>
          <rect
            x="3"
            y="4"
            width="18"
            height="16"
            rx="2"
          />

          <path d="M7 8h10" />
          <path d="M7 12h4" />
          <path d="M7 16h7" />
        </svg>
      );

    // -----------------------------------------------------
    // SUBJECTS
    // -----------------------------------------------------

    case "subjects":
      return (
        <svg {...common}>
          <path d="M4 4h16v16H4z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );

    // -----------------------------------------------------
    // BACK PAPER
    // -----------------------------------------------------

    case "backpaper":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />

          <path d="M9 12h6" />
          <path d="M9 16h4" />

          <path d="M4 8V5" />
          <path d="M4 5h3" />
        </svg>
      );

    // -----------------------------------------------------
    // HALL TICKET
    // -----------------------------------------------------

    case "ticket":
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v3h16v-3a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4V4H4z" />
          <path d="M12 7v10" />
        </svg>
      );

    // -----------------------------------------------------
    // ELIGIBILITY
    // -----------------------------------------------------

    case "eligibility":
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

    // -----------------------------------------------------
    // REPORT
    // -----------------------------------------------------

    case "report":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );

    // -----------------------------------------------------
    // PROFILE
    // -----------------------------------------------------

    case "profile":
      return (
        <svg {...common}>
          <circle
            cx="12"
            cy="8"
            r="3"
          />

          <path d="M5 21c0-4 3-6 7-6s7 2 7 6" />
        </svg>
      );

    // -----------------------------------------------------
    // DEFAULT
    // -----------------------------------------------------

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