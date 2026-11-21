"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Evening Principal: no start page – straight to the students
export default function EveningHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/evening/students");
  }, [router]);
  return <p className="p-8 text-sm text-slate-500">Opening the students…</p>;
}
