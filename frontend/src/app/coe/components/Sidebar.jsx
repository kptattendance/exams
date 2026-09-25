"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuSections = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/coe",
        icon: "dashboard",
      },
    ],
  },
 {
    title: "Master Data",
    items: [
      {
        label: "Students",
        href: "/coe/students",
        icon: "students",
      },
      {
        label: "Staff / Faculty",
        href: "/coe/faculty",
        icon: "staff",
      },
      {
        label: "Subjects",
        href: "/coe/subjects",
        icon: "subjects",
      },
    ],
  },

  {
    title: "Examination",
    items: [
      {
        label: "Register Numbers",
        href: "/coe/register-numbers",
        icon: "register",
      },
    //   {
    //     label: "Examinations",
    //     href: "/coe/examinations",
    //     icon: "exam",
    //   },
    //   {
    //     label: "Exam Applications",
    //     href: "/coe/applications",
    //     icon: "applications",
    //   },
      {
        label: "Time Table",
        href: "/coe/timetable",
        icon: "calendar",
      },
      {
        label: "Hall Tickets",
        href: "/coe/hall-tickets",
        icon: "ticket",
      },
    //   {
    //     label: "Seating Arrangement",
    //     href: "/coe/seating",
    //     icon: "seating",
    //   },
    ],
  },

  {
    title: "Marks & Results",
    items: [
      {
        label: "IA Marks",
        href: "/coe/ia-marks",
        icon: "marks",
      },
      {
        label: "Practical Exam Marks",
        href: "/coe/pactical-exam-marks",
        icon: "exam",
      },
      {
        label: "Valuation",
        href: "/coe/valuation",
        icon: "valuation",
      },
      {
        label: "Results",
        href: "/coe/results",
        icon: "results",
      },
    ],
  },

  {
    title: "Reports",
    items: [
      {
        label: "Examination Reports",
        href: "/coe/reports/examinations",
        icon: "report",
      },
      {
        label: "Student Reports",
        href: "/coe/reports/students",
        icon: "students",
      },
      {
        label: "Result Reports",
        href: "/coe/reports/results",
        icon: "chart",
      },
    ],
  },

  {
    title: "Administration",
    items: [
      {
        label: "COE Settings",
        href: "/coe/settings",
        icon: "settings",
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
    if (href === "/coe") {
      return pathname === "/coe";
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
      ===================================================== */}

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
                COE Office
              </p>

            </div>

          </div>

        </div>

        {/* MOBILE CLOSE */}

        <button
          type="button"
          onClick={onClose}
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
        >
          ✕
        </button>

      </div>

      {/* =====================================================
          COE IDENTITY
      ===================================================== */}

      <div className="mx-4 mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">

        <div className="flex items-center gap-3">

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            COE
          </div>

          <div>
            <p className="text-xs font-bold text-slate-900">
              Controller of Examinations
            </p>

            <p className="mt-0.5 text-[10px] text-slate-500">
              Examination Administration
            </p>
          </div>

        </div>

      </div>

      {/* =====================================================
          NAVIGATION
      ===================================================== */}

      <nav className="flex-1 overflow-y-auto px-3 py-5">

        {menuSections.map(
          (section) => (
            <div
              key={section.title}
              className="mb-6"
            >

              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                {section.title}
              </p>

              <div className="space-y-1">

                {section.items.map(
                  (item) => {
                    const active =
                      isActive(
                        item.href
                      );

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
                  }
                )}

              </div>

            </div>
          )
        )}

      </nav>

      {/* =====================================================
          BOTTOM PROFILE
      ===================================================== */}

      <div className="shrink-0 border-t border-slate-100 p-3">

        <div className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-slate-50">

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
            COE
          </div>

          <div className="min-w-0 flex-1">

            <p className="truncate text-xs font-bold text-slate-900">
              Controller of Examinations
            </p>

            <p className="truncate text-[10px] text-slate-400">
              COE Office
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

    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case "register":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );

    case "exam":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h4" />
          <path d="M7 16h7" />
        </svg>
      );

    case "applications":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </svg>
      );

    case "calendar":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 10h18" />
          <path d="M8 14h2" />
          <path d="M14 14h2" />
          <path d="M8 18h2" />
        </svg>
      );

    case "ticket":
      return (
        <svg {...common}>
          <path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4v3h16v-3a2 2 0 0 0 0-4v-2a2 2 0 0 0 0-4V4H4z" />
          <path d="M12 7v10" />
        </svg>
      );

    case "seating":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </svg>
      );

    case "marks":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-5" />
          <path d="M12 16V8" />
          <path d="M16 16V5" />
        </svg>
      );

    case "valuation":
      return (
        <svg {...common}>
          <path d="M5 4h14v16H5z" />
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h5" />
        </svg>
      );

    case "results":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16v-4" />
          <path d="M12 16V9" />
          <path d="M16 16V6" />
        </svg>
      );

    case "report":
      return (
        <svg {...common}>
          <path d="M6 3h9l3 3v15H6z" />
          <path d="M14 3v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
        </svg>
      );

    case "students":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M18 15c1.8.8 3 2.2 3 5" />
        </svg>
      );

    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="m7 15 4-4 3 2 5-6" />
        </svg>
      );

    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2.5v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2.5h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V4h2.5v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1v2.5h-.1a1.7 1.7 0 0 0-1.6 1.4z" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}