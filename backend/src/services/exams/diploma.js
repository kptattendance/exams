// src/services/exams/diploma.js
//
// Award of the Diploma (KPT 11), class (KPT 12) and ranks (KPT 14.8) –
// pure rules, unit-tested in test/diploma.test.js.
//
// Input per student: his CourseResults (every attempt, including rejected
// ones) with the subject's category / name, and a few facts.

export const PRESCRIBED_CREDITS = { regular: 141, lateral: 92 }; // KPT 4.9
export const LATERAL_TYPES = ["lateral-puc", "lateral-iti", "lateral-iti-cross"];
const r2 = (n) => Math.round(n * 100) / 100;
const trunc2 = (n) => Math.floor(n * 100 + 1e-9) / 100; // KPT 14.8.2 a: no rounding

// KPT 12.2 (12.3: distinction only with the conditions met)
export function classOf(cgpa, distinctionAllowed) {
  if (cgpa === null || cgpa === undefined) return null;
  if (cgpa >= 7.75) return distinctionAllowed ? "FIRST_CLASS_DISTINCTION" : "FIRST_CLASS";
  if (cgpa >= 6.75) return "FIRST_CLASS";
  if (cgpa >= 5.75) return "SECOND_CLASS";
  return "PASS_CLASS";
}
export const CLASS_LABEL = {
  FIRST_CLASS_DISTINCTION: "First Class with Distinction",
  FIRST_CLASS: "First Class",
  SECOND_CLASS: "Second Class",
  PASS_CLASS: "Pass Class",
};

// The year his course began: "2025-2028" -> 2025, else the admission year
export const startYearOf = (st) => Number(String(st?.batch || "").slice(0, 4)) || Number(st?.admissionYear) || null;

//   results : [{ subject, code, name, semester, category, status, gradePoint, credit, declaredAt, rejected }]
//   student : { admissionType, batch, admissionYear }
//   facts   : { malpractice: bool, supplementary: bool }
export function diplomaCheck(results = [], student = {}, facts = {}) {
  const lateral = LATERAL_TYPES.includes(student.admissionType);
  const prescribed = lateral ? PRESCRIBED_CREDITS.lateral : PRESCRIBED_CREDITS.regular;
  const minYears = lateral ? 2 : 3;
  const maxYears = lateral ? 4 : 6;

  const counted = results.filter((r) => !r.rejected);
  const latest = new Map();
  for (const r of counted) {
    const k = String(r.subject);
    const prev = latest.get(k);
    if (!prev || new Date(r.declaredAt) > new Date(prev.declaredAt)) latest.set(k, r);
  }
  const final = [...latest.values()];
  const credit = final.filter((r) => !["BRIDGE", "AUDIT"].includes(r.category) && Number(r.credit) > 0);
  const bridge = final.filter((r) => r.category === "BRIDGE");
  const audit = final.filter((r) => r.category === "AUDIT");

  const reasons = [];
  const earned = credit.filter((r) => r.status === "PASS").reduce((a, r) => a + Number(r.credit), 0);
  const notPassed = credit.filter((r) => r.status !== "PASS").map((r) => r.code);
  if (notPassed.length) reasons.push(`Not passed: ${notPassed.join(", ")}`);
  if (earned < prescribed) reasons.push(`Credits earned ${earned} of ${prescribed}`);
  const transitional = final.filter((r) => r.status === "NE" || r.status === "ANS").map((r) => `${r.code} (${r.status})`);
  if (transitional.length) reasons.push(`Transitional grade: ${transitional.join(", ")}`);
  const bridgeLeft = bridge.filter((r) => r.status !== "PASS").map((r) => r.code);
  if (bridgeLeft.length) reasons.push(`Bridge course not passed: ${bridgeLeft.join(", ")}`);
  const auditLeft = audit.filter((r) => r.status !== "PASS").map((r) => r.code);
  if (auditLeft.length) reasons.push(`Audit course not Satisfactory: ${auditLeft.join(", ")}`);
  const internship = credit.filter((r) => /internship/i.test(r.name || ""));
  if (!internship.length) reasons.push("Industrial internship result not on record");

  // CGPA over all credit courses (latest attempt) – KPT 9.4
  const reg = credit.reduce((a, r) => a + Number(r.credit), 0);
  const pts = credit.reduce((a, r) => a + Number(r.credit) * (r.status === "PASS" ? Number(r.gradePoint) || 0 : 0), 0);
  const cgpaExact = reg ? pts / reg : null;
  const cgpa = cgpaExact === null ? null : r2(cgpaExact);
  if (cgpa !== null && cgpa < 4) reasons.push(`Final CGPA ${cgpa.toFixed(2)} below 4.00`);

  const start = startYearOf(student);
  const completed = counted.length ? new Date(Math.max(...counted.map((r) => new Date(r.declaredAt).getTime()))) : null;
  // an academic year ends with the even-semester results (before September)
  const byYearEnd = (years) => (start ? new Date(Date.UTC(start + years, 8, 1)) : null);
  const withinMax = !completed || !start || completed < byYearEnd(maxYears);
  const withinMin = Boolean(completed && start && completed < byYearEnd(minYears));
  if (!withinMax) reasons.push(`Beyond the maximum duration of ${maxYears} years`);

  // first attempt: one result per course, a pass, nothing rejected, no supplementary (KPT 12.3, 14.8.1)
  const attempts = new Map();
  for (const r of results) attempts.set(String(r.subject), (attempts.get(String(r.subject)) || 0) + 1);
  const firstAttempt =
    results.length > 0 && [...attempts.values()].every((n) => n === 1) && results.every((r) => r.status === "PASS" && !r.rejected) && !facts.supplementary;
  const everTransitional = results.some((r) => r.status === "NE" || r.status === "ANS");

  const eligible = reasons.length === 0 && cgpa !== null;
  const distinctionAllowed = withinMin && firstAttempt && !facts.malpractice;
  const rankEligible = eligible && distinctionAllowed && !everTransitional && cgpaExact !== null && trunc2(cgpaExact) >= 8;

  // SGPA of each semester (latest attempts) – for the rank tie-break
  const sgpa = {};
  for (const s of [...new Set(credit.map((r) => Number(r.semester)).filter(Boolean))]) {
    const list = credit.filter((r) => Number(r.semester) === s);
    const c = list.reduce((a, r) => a + Number(r.credit), 0);
    sgpa[s] = c ? r2(list.reduce((a, r) => a + Number(r.credit) * (r.status === "PASS" ? Number(r.gradePoint) || 0 : 0), 0) / c) : null;
  }
  const finalYearPoints = credit
    .filter((r) => Number(r.semester) >= 5)
    .map((r) => Number(r.gradePoint) || 0)
    .sort((a, b) => b - a);

  return {
    eligible,
    reasons,
    prescribed,
    earned,
    cgpa,
    cgpaForRank: cgpaExact === null ? null : trunc2(cgpaExact),
    percentage: cgpa === null ? null : r2(Math.max(0, (cgpa - 0.75) * 10)), // KPT 9.5
    class: eligible ? classOf(cgpa, distinctionAllowed) : null,
    withinMin,
    firstAttempt,
    rankEligible,
    completedOn: completed,
    sgpa,
    finalYearPoints,
  };
}

// KPT 14.9.2 tie-break between two equal CGPAs: a) more semesters with a better
// SGPA, b) higher final-year grades; 0 = still equal (same rank)
export function tieBreak(a, b) {
  const sems = new Set([...Object.keys(a.sgpa || {}), ...Object.keys(b.sgpa || {})]);
  let wa = 0;
  let wb = 0;
  for (const s of sems) {
    const x = a.sgpa?.[s] ?? 0;
    const y = b.sgpa?.[s] ?? 0;
    if (x > y) wa++;
    else if (y > x) wb++;
  }
  if (wa !== wb) return wb - wa;
  const n = Math.max(a.finalYearPoints?.length || 0, b.finalYearPoints?.length || 0);
  for (let i = 0; i < n; i++) {
    const x = a.finalYearPoints?.[i] ?? 0;
    const y = b.finalYearPoints?.[i] ?? 0;
    if (x !== y) return y - x;
  }
  return 0;
}

// Ranks within one programme: [{ ...check }] -> same list with rank (1, 2, 2, 4 …) for the rank-eligible
export function rankList(list) {
  const pool = list.filter((x) => x.rankEligible).sort((a, b) => b.cgpaForRank - a.cgpaForRank || tieBreak(a, b));
  let rank = 0;
  pool.forEach((x, i) => {
    const prev = pool[i - 1];
    if (!prev || prev.cgpaForRank !== x.cgpaForRank || tieBreak(prev, x) !== 0) rank = i + 1;
    x.rank = rank;
  });
  return list;
}
