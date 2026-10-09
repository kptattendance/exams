"use client";

// Shared layout for every signed-in role (Admin, COE, HOD, Exam Officer, Faculty).
//
//  Desktop  : left sidebar (with the red answer-sheet margin line) + top bar
//  Phone    : top bar with menu button, slide-in drawer, bottom tab bar
//
// Usage in a layout:   <AppShell menu={MENUS.coe}>{children}</AppShell>

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useClerk, useUser } from "@clerk/nextjs";

import Icon from "./Icon";

function findActive(sections, pathname) {
  let best = null;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.soon) continue;
      const exact = pathname === item.href;
      const nested = pathname.startsWith(`${item.href}/`);
      if ((exact || nested) && (!best || item.href.length > best.item.href.length)) {
        best = { item, section };
      }
    }
  }
  return best;
}

export default function AppShell({ menu, children }) {
  const pathname = usePathname() || "/";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const active = useMemo(() => findActive(menu.sections, pathname), [menu, pathname]);
  const pinned = useMemo(
    () => menu.sections.flatMap((s) => s.items).filter((i) => i.pinned && !i.soon).slice(0, 4),
    [menu]
  );

  // Close the drawer when the page changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock page scroll + Esc to close while the drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  const title = active?.item.label || menu.role;
  // Bottom tabs only make sense when a role has several main pages
  const showTabs = pinned.length >= 2;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ---------------- Desktop sidebar ---------------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] lg:block">
        <SidebarContent menu={menu} activeHref={active?.item.href} />
      </aside>

      {/* ---------------- Phone drawer ---------------- */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"}`}
        aria-hidden={!drawerOpen}
      >
        <div
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-slate-950/45 backdrop-blur-[2px] transition-opacity duration-200 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`absolute inset-y-0 left-0 w-[86%] max-w-[300px] shadow-2xl transition-transform duration-300 ease-out ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <SidebarContent
            menu={menu}
            activeHref={active?.item.href}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      </div>

      {/* ---------------- Main column ---------------- */}
      <div className="lg:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-slate-50/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-7">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="-ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-200/60 lg:hidden"
              aria-label="Open menu"
            >
              <Icon name="menu" className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              {active?.section && active.section.title !== "Overview" && (
                <p className="hidden truncate text-xs font-medium text-slate-500 sm:block">
                  {active.section.title}
                </p>
              )}
              <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-950 sm:text-base">
                {title}
              </h1>
            </div>

            <TodayChip />

            <div className="flex h-9 w-9 items-center justify-center">
              <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
            </div>
          </div>
        </header>

        <main className={`min-h-[calc(100vh-4rem)] lg:pb-0 ${showTabs ? "pb-24" : "pb-6"}`}>{children}</main>
      </div>

      {/* ---------------- Phone bottom tabs ---------------- */}
      {showTabs && (
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-md lg:hidden"
        aria-label="Quick navigation"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {pinned.map((item) => {
            const on = active?.item.href === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] font-medium ${
                  on ? "text-blue-700" : "text-slate-500"
                }`}
              >
                {on && <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-blue-600" />}
                <Icon name={item.icon} className="h-[22px] w-[22px]" strokeWidth={on ? 2 : 1.75} />
                <span className="max-w-full truncate">{shortLabel(item.label)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-w-0 flex-1 flex-col items-center gap-1 px-1 pb-2 pt-2.5 text-[11px] font-medium text-slate-500"
          >
            <Icon name="more" className="h-[22px] w-[22px]" />
            <span>More</span>
          </button>
        </div>
      </nav>
      )}
    </div>
  );
}

const shortLabel = (label) =>
  ({
    "Register numbers": "Reg. nos",
    "Paper setting": "Papers",
    "Final attendance": "Attendance",
    "Staff / Faculty": "Faculty",
  })[label] || label;

function TodayChip() {
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    );
  }, []);
  if (!today) return null;
  return (
    <span className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 md:inline-flex">
      <Icon name="calendar" className="h-3.5 w-3.5 text-slate-400" />
      {today}
    </span>
  );
}

function SidebarContent({ menu, activeHref, onClose }) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const name = user?.fullName || user?.firstName || "Signed in";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const initials = (name || "?")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Answer-sheet margin line along the sidebar edge */}
      <span className="margin-rule pointer-events-none absolute inset-y-0 right-0 w-[5.5px] opacity-80" />

      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-100 px-5 pr-6">
        <Link href={menu.home} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold tracking-wide text-white ring-4 ring-slate-100">
            KPT
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-bold tracking-tight text-slate-950">
              Examinations
            </span>
            <span className="block truncate text-xs text-slate-500">{menu.role}</span>
          </span>
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close menu"
          >
            <Icon name="close" className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 pr-5">
        {menu.sections.map((section) => (
          <div key={section.title} className="mb-5 last:mb-0">
            <p className="mb-1.5 px-3 text-xs font-semibold text-slate-400">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const on = activeHref === item.href;
                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <span
                        className="flex h-10 cursor-default items-center gap-3 rounded-lg px-3 text-sm text-slate-400"
                        title="This page is not available yet"
                      >
                        <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0 text-slate-300" />
                        <span className="flex-1 truncate">{item.label}</span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                          Soon
                        </span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={on ? "page" : undefined}
                      className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                        on
                          ? "bg-blue-50 font-semibold text-blue-800"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      {on && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-blue-600" />}
                      <Icon
                        name={item.icon}
                        className={`h-[18px] w-[18px] shrink-0 ${
                          on ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                        strokeWidth={on ? 2 : 1.75}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Signed-in user */}
      <div className="shrink-0 border-t border-slate-100 p-3 pr-5">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
            {initials}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
            {email && <span className="block truncate text-xs text-slate-500">{email}</span>}
          </span>
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: "/" })}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Sign out"
            aria-label="Sign out"
          >
            <Icon name="logout" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
