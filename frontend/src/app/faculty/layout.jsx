"use client";

import Link from "next/link";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export default function FacultyLayout({ children }) {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <Link href="/faculty" className="leading-tight">
            <p className="text-sm font-bold text-slate-900">Examination ERP</p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Faculty</p>
          </Link>
          {isSignedIn && <UserButton />}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!isLoaded ? (
          <div className="flex min-h-60 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
          </div>
        ) : !isSignedIn ? (
          // People arrive here from the email link: sign in, then come back to the same page
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-lg font-bold text-slate-900">Please sign in</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in with the email address the COE office registered for you.
            </p>
            <SignInButton mode="modal" forceRedirectUrl={pathname}>
              <button className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Sign in
              </button>
            </SignInButton>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
