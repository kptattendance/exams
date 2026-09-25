"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";

const menuItems = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    name: "Faculty",
    href: "/admin/faculty",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
  name: "Users",
  href: "/admin/users",
  icon: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M12 2 3 6l9 4 9-4-9-4Z" />
      <path d="M5 10v5c0 2 3.1 4 7 4s7-2 7-4v-5" />
      <path d="M21 6v6" />
    </svg>
  ),
},
  {
    name: "Subjects",
    href: "/admin/subjects",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </svg>
    ),
  },
  {
    name: "Students",
    href: "/admin/students",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  
 
  {
    name: "Clerk Users",
    href: "/admin/clerk-users",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V7" />
        <path d="M16 16v-8" />
        <path d="M20 16V4" />
      </svg>
    ),
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  const displayName =
    user?.fullName ||
    user?.firstName ||
    user?.primaryEmailAddress?.emailAddress ||
    "Administrator";

  const email = user?.primaryEmailAddress?.emailAddress || "";

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-72 flex-col border-r border-slate-200 bg-white">

      {/* Brand */}
      <div className="flex h-20 items-center border-b border-slate-100 px-6">
        <Link href="/admin" className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm">
            K
          </div>

          <div>
            <div className="text-lg font-bold tracking-tight text-slate-900">
              KPT EXAMINATIONS
            </div>

            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Administration
            </div>
          </div>

        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6">

        <div className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          Main Menu
        </div>

        <nav className="space-y-1">

          {menuItems.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-slate-950 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >

                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-400 group-hover:text-slate-700"
                  }`}
                >
                  {item.icon}
                </span>

                <span className="flex-1">
                  {item.name}
                </span>

                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                )}

              </Link>
            );
          })}

        </nav>
      </div>

      {/* User Section */}
      <div className="border-t border-slate-100 p-4">

        <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">

          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-sm font-semibold text-white">

            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={displayName}
                className="h-full w-full object-cover"
              />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}

          </div>

          <div className="min-w-0 flex-1">

            <p className="truncate text-sm font-semibold text-slate-900">
              {displayName}
            </p>

            <p className="truncate text-xs text-slate-500">
              {email}
            </p>

          </div>

        </div>

        <button
          onClick={() => signOut({ redirectUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >

          <span className="flex h-9 w-9 items-center justify-center rounded-lg">

            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path d="M10 17l5-5-5-5" />
              <path d="M15 12H3" />
              <path d="M21 19V5a2 2 0 0 0-2-2h-6" />
            </svg>

          </span>

          Sign Out

        </button>

      </div>

    </aside>
  );
}