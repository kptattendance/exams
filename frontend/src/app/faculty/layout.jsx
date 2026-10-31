"use client";

import { useEffect, useMemo, useState } from "react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import axios from "axios";

import AppShell from "../components/shell/AppShell";
import FullPageStatus from "../components/shell/FullPageStatus";
import { MENUS } from "../components/shell/menus";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const PAPER_HREF = "/faculty";
const MAX_TIMER = 2 ** 31 - 1; // longest setTimeout (about 24 days)

export default function FacultyLayout({ children }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const pathname = usePathname();
  const [slow, setSlow] = useState(false);
  // "Paper setting" shows only while the faculty has a paper still open
  // (the server lists only papers whose deadline is not over)
  const [openPapers, setOpenPapers] = useState(null);
  const [check, setCheck] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let timer;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/paper-setting/my`, { headers: { Authorization: `Bearer ${await getToken()}` } });
        const list = res.data?.data || [];
        setOpenPapers(list.length);
        // look again when the next deadline passes, so the menu closes by itself
        const next = Math.min(...list.map((p) => new Date(p.deadline).getTime()).filter((t) => t > Date.now()));
        if (Number.isFinite(next)) timer = setTimeout(() => setCheck((c) => c + 1), Math.min(next - Date.now() + 2000, MAX_TIMER));
      } catch {
        setOpenPapers(0);
      }
    })();
    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, getToken, check]);

  const menu = useMemo(() => {
    if (openPapers) return MENUS.faculty;
    return {
      ...MENUS.faculty,
      sections: MENUS.faculty.sections.map((s) => ({ ...s, items: s.items.filter((i) => i.href !== PAPER_HREF) })),
    };
  }, [openPapers]);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(t);
  }, []);

  if (!isLoaded) {
    return (
      <FullPageStatus message="Opening your faculty workspace…">
        {slow && (
          <p className="mt-3 text-sm text-slate-500">
            This is taking longer than usual.{" "}
            <button onClick={() => location.reload()} className="font-semibold text-blue-700 underline">
              Reload the page
            </button>
            . If it still doesn&apos;t load, try another browser or turn off ad-blockers.
          </p>
        )}
      </FullPageStatus>
    );
  }

  // People arrive here from the email link: sign in, then come back to the same page
  if (!isSignedIn) {
    return (
      <FullPageStatus spinner={false}>
        <h1 className="mt-5 text-lg font-bold tracking-tight text-slate-950">Sign in to continue</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Use the email address the COE office registered for you. You&apos;ll come straight back to this page.
        </p>
        <SignInButton mode="modal" forceRedirectUrl={pathname}>
          <button className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
            Sign in
          </button>
        </SignInButton>
      </FullPageStatus>
    );
  }

  return (
    <AppShell menu={menu}>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</div>
    </AppShell>
  );
}
