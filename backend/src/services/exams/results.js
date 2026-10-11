// src/services/exams/results.js
//
// Pure rules for results (unit-tested in test/results.test.js), from the
// KPT Academic Rules and Regulations 2025:
//   9.1  letter grades and grade points     9.2  passing standards (40 %)
//   9.4  SGPA and CGPA                      9.10 moderation (at most 5 marks)

import { effectiveOf, subjectFeePaid } from "./rules.js";

const EPS = 1e-9;
const up = (n) => Math.ceil(n - EPS);
const round2 = (n) => Math.round((n + EPS) * 100) / 100;
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export const PASS_PERCENT = 40;
export const MAX_MODERATION = 5;

// [marks from, letter grade, grade points]
const GRADES_100 = [[91, "A+", 10], [81, "A", 9], [71, "B+", 8], [61, "B", 7], [51, "C+", 6], [45, "C", 5], [40, "D", 4]];
// Courses with a maximum of 50 marks have their own table (9.1 c)
const GRADES_50 = [[46, "A+", 10], [41, "A", 9], [36, "B+", 8], [31, "B", 7], [26, "C+", 6], [21, "C", 5], [20, "D", 4]];

// A fraction of a mark is rounded up (in the student's favour) before the table is read
export function gradeFor(total, max) {
  if (!(max > 0) || total === null || total === undefined) return { grade: "F", points: 0 };
  const fifty = Number(max) === 50;
  const score = fifty ? up(total) : up((total / max) * 100);
  const row = (fifty ? GRADES_50 : GRADES_100).find(([from]) => score >= from);
  return row ? { grade: row[1], points: row[2] } : { grade: "F", points: 0 };
}

// The subject's own minimum when it is set, otherwise 40 % of the maximum
export const minimumOf = (max, stored) => (Number(stored) > 0 ? Number(stored) : up((max * PASS_PERCENT) / 100));

// IA entered out of a different maximum is brought to the subject's maximum
export function scaleCie(marks, sheetMax, subjectMax) {
  const m = num(marks);
  if (m === null) return null;
  return sheetMax && subjectMax && Number(sheetMax) !== Number(subjectMax) ? round2((m / sheetMax) * subjectMax) : m;
}

// The semester-end exams of a subject: a theory paper, a practical exam, or both
const parts = (subject) =>
  [
    { key: "theory", label: "Theory", max: Number(subject.theoryExamMax) || 0, min: subject.theoryExamMin },
    { key: "practical", label: "Practical", max: Number(subject.practicalExamMax) || 0, min: subject.practicalExamMin },
  ]
    .filter((p) => p.max > 0)
    .map((p) => ({ ...p, min: minimumOf(p.max, p.min) }));

const totalMaxOf = (subject) =>
  Number(subject.totalMax) || (Number(subject.iaMax) || 0) + parts(subject).reduce((a, p) => a + p.max, 0);

// Result of one student in one subject.
//   input : { eligibility, permitted, cie, theory: { attendance, marks }, practical: { attendance, marks },
//             moderation: { theory, practical } }
//   status: PASS | FAIL | ABSENT | NE | ANS | WITHHELD, or INCOMPLETE when a mark is still missing
export function courseResult(subject, input = {}) {
  const { eligibility = "ELIGIBLE", permitted = true, moderation = {} } = input;
  const cieMax = Number(subject.iaMax) || 0;
  const list = parts(subject);
  const max = totalMaxOf(subject);
  const out = { cie: null, theory: null, practical: null, total: null, max, status: "", grade: "", points: 0, note: "" };
  const end = (status, grade, note = "") => ({ ...out, status, grade, note });

  if (eligibility === "ANS") return end("ANS", "ANS", "Attendance not satisfactory.");
  if (eligibility === "NE") return end("NE", "NE", "CIE below the minimum.");
  if (eligibility !== "ELIGIBLE") return end("INCOMPLETE", "", "Eligibility is not decided.");
  if (!permitted) return end("ABSENT", "F", "Fee not paid – not permitted to write.");

  for (const p of list) if (!input[p.key]?.attendance) return end("INCOMPLETE", "", `${p.label} exam marks are not in.`);
  const cie = cieMax > 0 ? num(input.cie) : 0;
  if (cie === null) return end("INCOMPLETE", "", "CIE marks are not on record.");
  if (cieMax > 0) out.cie = cie;
  if (list.some((p) => input[p.key].attendance === "MALPRACTICE")) return end("WITHHELD", "", "Malpractice case – result withheld.");
  if (list.some((p) => input[p.key].attendance === "ABSENT")) return end("ABSENT", "F", "Absent.");

  const short = [];
  if (cieMax > 0 && cie + EPS < minimumOf(cieMax, subject.iaMin)) short.push("CIE");
  let total = cie;
  for (const p of list) {
    const m = num(input[p.key].marks);
    if (m === null) return end("INCOMPLETE", "", `${p.label} exam marks are not in.`);
    const got = Math.min(p.max, m + (Number(moderation[p.key]) || 0));
    out[p.key] = got;
    total += got;
    if (got + EPS < p.min) short.push(p.label);
  }
  out.total = round2(total);
  if (total + EPS < minimumOf(max, subject.totalMin)) short.push("Total");
  if (short.length) return end("FAIL", "F", `Below the minimum in ${short.join(", ")}.`);
  return { ...out, status: "PASS", ...gradeFor(total, max) };
}

// Marks a failed subject needs in its semester-end exams to pass, or null
// when no moderation can pass it (the CIE itself is short).
function shortfall(subject, input) {
  const cieMax = Number(subject.iaMax) || 0;
  const cie = cieMax > 0 ? num(input.cie) : 0;
  const list = parts(subject);
  if (!list.length || cie + EPS < (cieMax > 0 ? minimumOf(cieMax, subject.iaMin) : 0)) return null;
  const add = { theory: 0, practical: 0 };
  let total = cie;
  for (const p of list) {
    const m = num(input[p.key].marks);
    add[p.key] = Math.max(0, up(p.min - m));
    total += m + add[p.key];
  }
  const gap = up(minimumOf(totalMaxOf(subject), subject.totalMin) - total);
  if (gap > 0) {
    const p = list.find((x) => num(input[x.key].marks) + add[x.key] + gap <= x.max);
    if (!p) return null;
    add[p.key] += gap;
  }
  return add;
}

// Moderation (9.10): at most `limit` marks per student across all his subjects,
// and only when they make him pass everything he registered for.
//   items : [{ key, subject, input }]
// Returns Map(key -> { theory, practical }); empty when moderation does not apply.
export function moderationFor(items, limit = 0) {
  const none = new Map();
  if (!(limit > 0)) return none;
  const out = new Map();
  let used = 0;
  for (const it of items) {
    const r = courseResult(it.subject, it.input);
    if (r.status === "PASS") continue;
    if (r.status !== "FAIL") return none;
    const add = shortfall(it.subject, it.input);
    if (!add) return none;
    used += add.theory + add.practical;
    out.set(it.key, add);
  }
  return used > 0 && used <= limit ? out : none;
}

// SGPA / CGPA = Σ (credit × grade points) / Σ credit, to two decimals.
// Bridge courses and non-credit courses are left out; a subject not passed counts 0.
//   courses : [{ credit, points, kind, status }]   points === null → not known yet
export function gradePointAverage(courses) {
  const counted = courses.filter((c) => Number(c.credit) > 0 && c.kind !== "BRIDGE");
  const registered = counted.reduce((a, c) => a + Number(c.credit), 0);
  const earned = counted.filter((c) => c.status === "PASS").reduce((a, c) => a + Number(c.credit), 0);
  const unknown = counted.some((c) => c.points === null || c.points === undefined || c.status === "WITHHELD" || c.status === "INCOMPLETE");
  if (!registered || unknown) return { value: null, registered, earned };
  const sum = counted.reduce((a, c) => a + Number(c.credit) * Number(c.points), 0);
  return { value: round2(sum / registered), registered, earned };
}

export function inputFor(reg, s, subject, earlier) {
  const own = scaleCie(s.iaMarks, s.iaMax, subject.iaMax);
  return {
    eligibility: effectiveOf(s),
    permitted: subjectFeePaid(reg, s),
    // A back paper carries the CIE of the earlier attempt forward
    cie: own ?? (s.kind === "BACKLOG" ? (earlier?.cie ?? null) : null),
    theory: { attendance: s.see?.attendance ?? null, marks: s.see?.marks ?? null },
    practical: { attendance: s.practical?.attendance ?? null, marks: s.practical?.marks ?? null },
  };
}

// Everything about one student in one exam.
//   subjectOf : (subjectId) -> subject document
//   past      : Map(subjectId -> { cie, status, points, credit, kind }) – his latest result
//               in each subject from earlier exams
export function studentResult(reg, subjectOf, past = new Map(), { moderation = 0 } = {}) {
  const items = (reg.subjects || []).map((s) => {
    const subject = subjectOf(s.subject);
    return { key: String(s.subject), s, subject, input: subject ? inputFor(reg, s, subject, past.get(String(s.subject))) : null };
  });
  const marks = moderationFor(items.filter((i) => i.subject), Math.min(MAX_MODERATION, Number(moderation) || 0));

  const courses = items.map(({ key, s, subject, input }) => {
    const add = marks.get(key);
    const r = subject
      ? courseResult(subject, { ...input, moderation: add })
      : { cie: null, theory: null, practical: null, total: null, max: 0, status: "INCOMPLETE", grade: "", points: 0, note: "Subject not found." };
    return {
      subject: s.subject,
      code: s.code,
      name: s.name,
      semester: s.semester,
      kind: s.kind,
      credit: Number(subject?.credit ?? s.credit) || 0,
      cieMax: Number(subject?.iaMax) || 0,
      theoryMax: Number(subject?.theoryExamMax) || 0,
      practicalMax: Number(subject?.practicalExamMax) || 0,
      ...r,
      moderation: add ? add.theory + add.practical : 0,
    };
  });

  const current = courses.filter((c) => c.kind !== "BACKLOG");
  const sgpa = current.length ? gradePointAverage(current) : { value: null, registered: 0, earned: 0 };
  const now = new Set(courses.map((c) => String(c.subject)));
  const before = [...past].filter(([id]) => !now.has(id)).map(([, p]) => p);
  const cgpa = gradePointAverage([...courses, ...before]);

  const has = (status) => courses.some((c) => c.status === status);
  const outcome = has("INCOMPLETE") ? "INCOMPLETE" : has("WITHHELD") ? "WITHHELD" : courses.every((c) => c.status === "PASS") ? "PASS" : "FAIL";

  return {
    courses,
    sgpa: sgpa.value,
    cgpa: cgpa.value,
    credits: { registered: sgpa.registered, earned: sgpa.earned },
    outcome,
  };
}
