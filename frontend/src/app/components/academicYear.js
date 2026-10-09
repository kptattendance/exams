// Academic year and batch helpers shared by the HOD pages.
//
//   currentAcademicYear()          -> "2026-27"   (June onwards = new year)
//   batchFor("2026-27", 3)         -> "2025-2028" (3rd sem = 2nd year)

export function currentAcademicYear(date = new Date()) {
  const start = date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export function batchFor(academicYear, semester) {
  const y = Number(String(academicYear || "").slice(0, 4));
  const sem = Number(semester);
  if (!y || !(sem >= 1 && sem <= 6)) return "";
  const start = y - (Math.ceil(sem / 2) - 1);
  return `${start}-${start + 3}`;
}

// ------------------------------------------------------------------
// The running academic year, set by the Admin (Settings page).
// Everyone else only sees it.
//
//   const academicYear = useAcademicYear();   // "2026-27"
// ------------------------------------------------------------------
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import axios from "axios";

let cached = null;
let pending = null;

export function clearAcademicYearCache() {
  cached = null;
  pending = null;
}

export function useAcademicYear() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [year, setYear] = useState(cached || currentAcademicYear());

  useEffect(() => {
    if (cached) return setYear(cached);
    if (!isLoaded || !isSignedIn) return;
    pending ||= (async () => {
      const token = await getToken();
      const r = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/settings/academic-year`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      cached = r.data?.data?.academicYear || currentAcademicYear();
      return cached;
    })().catch(() => {
      pending = null;
      return currentAcademicYear();
    });
    let alive = true;
    pending.then((y) => alive && setYear(y));
    return () => {
      alive = false;
    };
  }, [getToken, isLoaded, isSignedIn]);

  return year;
}
