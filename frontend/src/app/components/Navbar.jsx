"use client";

import {
  Show,
  SignInButton,
  UserButton,
  useAuth,
} from "@clerk/nextjs";

import Link from "next/link";
import { useEffect, useState } from "react";
import axios from "axios";

export default function Navbar() {
  const { getToken } = useAuth();
  const [dashboard, setDashboard] = useState("/");

  useEffect(() => {
    const getDashboard = async () => {
      try {
        const token = await getToken();

        if (!token) return;

        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const role = response.data?.data?.role;

        switch (role) {
          case "admin":
            setDashboard("/admin");
            break;

          case "principal":
            setDashboard("/principal");
            break;

          case "hod":
            setDashboard("/hod");
            break;

          case "staff":
            setDashboard("/faculty");
            break;

          case "student":
            setDashboard("/student");
            break;

          default:
            setDashboard("/");
        }
      } catch (error) {
        console.error("Failed to determine dashboard:", error);
        setDashboard("/");
      }
    };

    getDashboard();
  }, [getToken]);

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-sm font-bold text-white shadow-sm">
            K
          </div>

          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight text-slate-900">
              KPT IA
            </div>

            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Academic Portal
            </div>
          </div>
        </Link>

        {/* Navigation */}
        <div className="flex items-center gap-2">

          {/* Home */}
          <Link
            href="/"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
          >
            Home
          </Link>

          {/* Signed In */}
          <Show when="signed-in">

            <Link
              href={dashboard}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
            >
              Dashboard
            </Link>

            <div className="ml-2 border-l border-slate-200 pl-4">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            </div>

          </Show>

          {/* Signed Out */}
          <Show when="signed-out">

            <SignInButton mode="modal">
              <button
                className="ml-2 rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md"
              >
                Login
              </button>
            </SignInButton>

          </Show>

        </div>
      </div>
    </nav>
  );
}