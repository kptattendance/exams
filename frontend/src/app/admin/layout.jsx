"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import axios from "axios";

import AppShell from "../components/shell/AppShell";
import { MENUS } from "../components/shell/menus";
import FullPageStatus from "../components/shell/FullPageStatus";

// Admin pages: checked once per visit. Only a confirmed non-admin is sent
// away; a slow or failed check offers a retry instead of leaving the page.
export default function AdminLayout({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const router = useRouter();

  // "checking" | "ok" | "error"
  const [state, setState] = useState("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Wait for Clerk; before that there is no token yet
    if (!isLoaded) return;
    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (response.data?.data?.role !== "admin") {
          router.replace("/auth/check");
          return;
        }
        setState("ok");
      } catch (error) {
        if (cancelled) return;
        console.error("Admin verification failed:", error);
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // getToken is left out on purpose: the check runs once, not on every token refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, attempt, router]);

  if (state === "error") {
    return (
      <FullPageStatus spinner={false} message="Could not check your administrator access.">
        <button
          onClick={() => {
            setState("checking");
            setAttempt((n) => n + 1);
          }}
          className="mt-4 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </FullPageStatus>
    );
  }
  if (state !== "ok") {
    return <FullPageStatus message="Checking your administrator access…" />;
  }

  return <AppShell menu={MENUS.admin}>{children}</AppShell>;
}
