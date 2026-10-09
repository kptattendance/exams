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
