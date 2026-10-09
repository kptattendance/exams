"use client";

import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";

import Navbar from "./components/Navbar";
import Icon from "./components/shell/Icon";

// The examination cycle, in order. `live` = available in the portal today.
const CYCLE = [
  { label: "Question paper setting", note: "Encrypted upload by examiners", live: true },
  { label: "Register numbers", note: "Generated per semester", live: true },
  { label: "Internal assessment & attendance", note: "Final IA and attendance records", live: true },
  { label: "Hall tickets & time table", note: "Eligibility and seating", live: false },
  { label: "Valuation & mark entry", note: "Marks, grace marks, moderation", live: false },
  { label: "Results & mark cards", note: "Promotion and course completion", live: false },
];

const REG_NO = ["1", "0", "6", "C", "S", "2", "4", "0", "1", "7"];

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="relative flex min-h-[calc(100vh-4rem)] flex-col overflow-hidden bg-slate-50">
        <div className="ruled-paper pointer-events-none absolute inset-0 opacity-70" />

        <section className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-16">
          {/* -------- Left: message -------- */}
          <div>
            <p className="text-sm font-semibold text-blue-700">Karnataka Government Polytechnic, Mangaluru</p>

            <h1 className="mt-4 text-[2.6rem] font-bold leading-[1.05] tracking-[-0.03em] text-slate-950 sm:text-6xl">
              Examinations, from question paper to mark card.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              One place for the COE office, heads of department, faculty and examiners to run every
              semester&apos;s examinations securely.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Show when="signed-in">
                <Link
                  href="/auth/check"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800"
                >
                  Go to my dashboard
                  <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
              </Show>
              <Show when="signed-out">
                <SignInButton mode="modal">
                  <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-950 px-6 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-slate-950/15 transition hover:bg-slate-800">
                    Sign in with college email
                  </button>
                </SignInButton>
              </Show>
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <Icon name="shield" className="h-4 w-4 text-blue-600" />
                Only accounts created by the college can sign in.
              </p>
            </div>
          </div>

          {/* -------- Right: answer-sheet card -------- */}
          <div className="relative">
            <div className="absolute -inset-3 hidden -rotate-2 rounded-[22px] bg-white/60 shadow-md sm:block" />
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <span className="margin-rule pointer-events-none absolute inset-y-0 left-8 w-[5.5px] opacity-80 sm:left-12" />

              <div className="border-b border-blue-100 py-5 pl-12 pr-4 sm:pl-20 sm:pr-7">
                <p className="text-xs font-medium text-slate-500">Register number</p>
                <div className="mt-2 flex gap-[3px] sm:gap-1">
                  {REG_NO.map((c, i) => (
                    <span
                      key={i}
                      className="flex h-9 w-[26px] items-center justify-center rounded-[5px] border border-slate-300 font-semibold tabular-nums text-blue-800 sm:h-10 sm:w-8 sm:text-lg"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>

              <ol className="divide-y divide-blue-100/80 pl-12 pr-4 sm:pl-20 sm:pr-7">
                {CYCLE.map((step, i) => (
                  <li key={step.label} className="flex min-h-[58px] items-center gap-3 py-2">
                    <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[15px] font-semibold ${step.live ? "text-slate-900" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{step.note}</span>
                    </span>
                    {step.live ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.25} />
                        Live
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                        Coming
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <footer className="relative mt-auto border-t border-slate-200/80 bg-white/70">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>Office of the Controller of Examinations, KPT Mangaluru</p>
            <Link href="/privacy" className="font-medium text-slate-600 hover:text-slate-950">
              Privacy policy
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
