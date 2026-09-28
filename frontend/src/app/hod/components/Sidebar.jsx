"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const menuSections = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/hod",
        icon: "dashboard",
      },
    ],
  },

  {
    title: "Department",
    items: [
      {
        label: "Faculty",
        href: "/hod/faculty",
        icon: "faculty",
      },
      {
        label: "Subjects",
        href: "/hod/subjects",
        icon: "subjects",
      },
      {
        label: "Students",
        href: "/hod/students",
        icon: "students",
      },
    ],
  },

  {
    title: "Academic Records",
    items: [
      {
        label: "Final IA",
        href: "/hod/final-ia",
        icon: "marks",
      },
      {
        label: "Final Attendance",
        href: "/hod/attendance",
        icon: "marks",
      },
    ],
  },

  {
    title: "Reports",
    items: [
      {
        label: "Faculty Report",
        href: "/hod/reports/faculty",
        icon: "facultyReport",
      },
      {
        label: "Subject Report",
        href: "/hod/reports/subjects",
        icon: "subjectReport",
      },
      {
        label: "Student Report",
        href: "/hod/reports/students",
        icon: "studentReport",
      },
      {
        label: "IA Marks Excel",
        href: "/hod/reports/ia-marks",
        icon: "marks",
      },
      {
        label: "Attendance Excel",
        href: "/hod/reports/attendance",
        icon: "attendance",
      },
    ],
  },
];

function Icon({ type }) {
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
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case "faculty":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.2 2.5-5 6-5s6 1.8 6 5" />
          <path d="M16 5.5c1.8.2 3 1.3 3 3" />
          <path d="M18 15c1.9.7 3 2.2 3 5" />
        </svg>
      );

    case "subjects":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
          <path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20" />
        </svg>
      );

    case "students":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M3 20c0-3.5 2.5-5.5 6-5.5s6 2 6 5.5" />
          <path d="M14 15.5c3 .2 5 1.8 5 4.5" />
        </svg>
      );

    case "marks":
      return (
        <svg {...common}>
          <path d="M5 3h14v18H5z" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h5" />
          <path d="M8 19h4" />
        </svg>
      );

    case "attendance":
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <path d="M3 9h18" />
          <path d="m8 15 2 2 5-5" />
        </svg>
      );

    case "facultyReport":
    case "subjectReport":
    case "studentReport":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h17" />
          <path d="m7 15 4-4 3 2 5-6" />
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

export default function Sidebar({
  mobileOpen,
  onClose,
}) {
  const pathname = usePathname();

  const isActive = (href) => {
    if (href === "/hod") {
      return pathname === "/hod";
    }

    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  return (
    <>
      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[270px] flex-col border-r border-amber-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full"
        }`}
      >
        {/* =================================================
            BRAND
        ================================================= */}

        <div className="flex h-[76px] shrink-0 items-center border-b border-amber-100 px-5">
          <div className="flex items-center gap-3">

            {/* Logo */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
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
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-600">
                  HOD Portal
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <nav className="flex-1 overflow-y-auto px-3 py-5">

          {menuSections.map((section) => (
            <div
              key={section.title}
              className="mb-6"
            >
              <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-600">
                {section.title}
              </p>

              <div className="space-y-1">

                {section.items.map((item) => {
                  const active =
                    isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-amber-500 text-white shadow-sm"
                          : "text-slate-600 hover:bg-amber-50 hover:text-amber-700"
                      }`}
                    >
                      <span
                        className={
                          active
                            ? "text-white"
                            : "text-slate-400 group-hover:text-amber-600"
                        }
                      >
                        <Icon type={item.icon} />
                      </span>

                      <span className="truncate">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}

              </div>
            </div>
          ))}

        </nav>

        {/* =================================================
            BOTTOM
        ================================================= */}

        <div className="border-t border-amber-100 p-4">

          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">

            <p className="text-xs font-semibold text-slate-800">
              Department HOD
            </p>

            <p className="mt-1 text-[11px] text-slate-500">
              Academic & Examination Management
            </p>

          </div>

        </div>

      </aside>
    </>
  );
}