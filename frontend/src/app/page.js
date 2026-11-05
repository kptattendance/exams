"use client";

import Image from "next/image";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";

import Navbar from "./components/Navbar";
import Icon from "./components/shell/Icon";

// The examination cycle, in order – all of it runs in the portal.
const CYCLE = [
  { label: "Question papers", note: "Encrypted upload, scrutiny, exam set chosen by the COE" },
  { label: "IA & attendance", note: "Final IA and attendance sheets from every department" },
  { label: "Registration & fees", note: "Subjects, back papers and exam fee for each student" },
  { label: "Hall tickets & timetable", note: "Eligibility, timetable, rooms and seating" },
  { label: "Valuation & marks", note: "Practicals, valuation, mark entry and moderation" },
  { label: "Results", note: "Results published, mark cards and promotion" },
];

const PEOPLE = [
  { title: "Students", note: "Your details and the courses on your hall ticket", icon: "students" },
  { title: "Heads of department", note: "Students, electives, IA, attendance and practicals", icon: "faculty" },
  { title: "COE office", note: "Registration, fees, timetable, hall tickets and results", icon: "ticket" },
  { title: "Examiners & faculty", note: "Question papers, valuation and mark entry", icon: "valuation" },
];

function SignInAction({ light = false }) {
  const cls = light
    ? "bg-white text-[#1D1842] hover:bg-slate-100 shadow-lg shadow-black/20"
    : "bg-[#1D1842] text-white hover:bg-[#2a2360] shadow-lg shadow-[#1D1842]/20";
  return (
    <>
      <Show when="signed-in">
        <Link href="/auth/check" className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition sm:w-auto ${cls}`}>
          Go to my dashboard
          <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className={`inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl px-6 py-3.5 text-[15px] font-semibold transition sm:w-auto ${cls}`}>
            Sign in with college email
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </SignInButton>
      </Show>
    </>
  );
}

export default function Home() {
  return (
    <>
      <Navbar />

      <main className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-50">
        {/* -------- Hero: the college building -------- */}
        <section className="relative isolate overflow-hidden">
          <Image src="/clgimg1.jpg" alt="Karnataka (Govt.) Polytechnic, Mangaluru – main building" fill priority sizes="100vw" className="-z-20 object-cover object-[60%_40%]" />
          {/* dark at the left (and bottom on phones) so the words stay readable */}
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1D1842] via-[#1D1842]/80 to-[#1D1842]/30 sm:bg-gradient-to-r sm:from-[#1D1842]/95 sm:via-[#1D1842]/75 sm:to-[#8E0D3C]/20" />

          <div className="mx-auto flex min-h-[560px] max-w-6xl flex-col justify-end px-4 pb-10 pt-24 sm:min-h-[600px] sm:justify-center sm:px-6 sm:py-20">
            <div className="max-w-2xl text-white">
              <div className="flex items-center gap-2.5">
                {[
                  ["/lh-karnataka.png", "Government of Karnataka"],
                  ["/lh-kpt-crest.png", "KPT crest"],
                  ["/lh-jubilee.png", "Platinum Jubilee"],
                ].map(([src, alt]) => (
                  <span key={src} className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/95 p-1.5 shadow-md sm:h-16 sm:w-16">
                    <Image src={src} alt={alt} width={60} height={60} className="h-full w-full object-contain" />
                  </span>
                ))}
              </div>

              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200 sm:text-sm">Karnataka (Govt.) Polytechnic, Mangaluru</p>
              <h1 className="mt-3 text-[2.1rem] font-bold leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-6xl">Examinations, from question paper to results.</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-200 sm:text-lg sm:leading-8">
                One secure place for students, heads of department, the COE office, faculty and examiners to run every semester&apos;s examinations.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <SignInAction light />
                <p className="flex items-center justify-center gap-2 text-sm text-slate-300 sm:justify-start">
                  <Icon name="shield" className="h-4 w-4 text-amber-200" />
                  Only accounts created by the college can sign in.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* -------- Who uses it -------- */}
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        

      

          {/* -------- Sign in again at the end (phones) -------- */}
          <div className="mt-12 flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-r from-[#1D1842] to-[#8E0D3C] px-6 py-8 text-center text-white sm:flex-row sm:justify-between sm:px-10 sm:text-left">
            <div>
              <p className="text-lg font-bold">Ready to sign in?</p>
              <p className="mt-1 text-sm text-slate-200">Use the email your college account was created with.</p>
            </div>
            <div className="w-full sm:w-auto">
              <SignInAction light />
            </div>
          </div>
        </section>

        <footer className="mt-auto border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-6 text-center text-sm text-slate-500 sm:flex-row sm:justify-between sm:px-6 sm:text-left">
            <div className="flex items-center gap-3">
              <Image src="/lh-kpt-crest.png" alt="" width={32} height={36} className="h-9 w-auto" />
              <div>
                <p className="font-semibold text-slate-700">Office of the Controller of Examinations</p>
                <p className="text-xs">Karnataka (Govt.) Polytechnic, Mangaluru</p>
              </div>
            </div>
            <Link href="/privacy" className="font-medium text-slate-600 hover:text-slate-950">
              Privacy policy
            </Link>
          </div>
        </footer>
      </main>
    </>
  );
}
