"use client";

import { Show, SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";

const DASHBOARD_BY_ROLE = {
  admin: "/admin",
  principal: "/principal",
  coe: "/coe",
  exam_officer: "/exam-officer",
  office: "/office",
  exam_clerk: "/clerk",
  hod: "/hod",
  staff: "/faculty",
  student: "/student",
};

export default function Navbar() {
  const { getToken } = useAuth();
  const [dashboard, setDashboard] = useState("/auth/check");

  useEffect(() => {
    const getDashboard = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const role = response.data?.data?.role;
        setDashboard(DASHBOARD_BY_ROLE[role] || "/auth/check");
      } catch (error) {
        console.error("Failed to determine dashboard:", error);
        setDashboard("/auth/check");
      }
    };

    getDashboard();
  }, [getToken]);

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-[11px] font-bold tracking-wide text-white ring-4 ring-white">
            KPT
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-slate-950">Examinations</span>
            <span className="hidden text-xs text-slate-500 sm:block">Government Polytechnic, Mangaluru</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Show when="signed-in">
            <Link
              href={dashboard}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              My dashboard
            </Link>
            <div className="ml-1 flex h-9 w-9 items-center justify-center">
              <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
            </div>
          </Show>

          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
                Sign in
              </button>
            </SignInButton>
          </Show>
        </div>
      </div>
    </nav>
  );
}
