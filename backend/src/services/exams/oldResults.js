// src/services/exams/oldResults.js
//
// Pure rules for importing results from the old results software (its
// "Results" Excel, columns RSLTS_RegNo_…, RSLTS_SubID_…, RSLTS_IAMarks_…).
// Unit-tested in test/oldResults.test.js.
//
// One row = one student, one subject, one exam (25S = Nov/Dec 2025,
// 26A = Apr/May 2026). Mark cells hold a number, "--" (no such part),
// AB (absent), NE (not eligible), MP (malpractice) or X (not registered).

import { gradeFor } from "./results.js";

// column -> how its header looks in the old software's export
export const OLD_COLUMNS = {
  regNo: /RegNo/i,
  subId: /SubID/i,
  examId: /ExamID/i,
  course: /XCourse/i,
  semester: /SemYear/i,
  sdCode: /SDCode/i,
  ia: /IAMarks/i,
  theory: /TrExMarks/i,
  practical: /PrExMarks/i,
  status: /ResultStatus/i,
  gradeId: /SubGradeID/i,
  inst: /InstID/i,
};
export const REQUIRED_OLD_COLUMNS = ["regNo", "subId", "examId", "ia", "theory", "practical", "status"];

// header row -> { field: header }
export function mapOldColumns(headers) {
  const map = {};
  for (const [field, re] of Object.entries(OLD_COLUMNS)) {
    const h = headers.find((x) => re.test(String(x)) && !(field === "theory" && /TrExGr/i.test(String(x))));
    if (h !== undefined) map[field] = h;
  }
  return map;
}

// "25" -> { n: 25 }, "--" / "" -> { none: true }, "AB" -> { code: "AB" }
export function cellOf(v) {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s || /^-+$/.test(s)) return { none: true };
  if (/^\d+(\.\d+)?$/.test(s)) return { n: Number(s) };
  return { code: s };
}

// "25S" -> 31 Dec 2025, "26A" -> 30 Jun 2026: only the order matters
// (the latest attempt of a subject decides back papers)
export function examDate(examId) {
  const m = String(examId || "").trim().toUpperCase().match(/^(\d{2})([AS])$/);
  if (!m) return null;
  const year = 2000 + Number(m[1]);
  return m[2] === "A" ? new Date(Date.UTC(year, 5, 30)) : new Date(Date.UTC(year, 11, 31));
}

// "AT25-1M1" -> { department: "AT", semester: 1 }
export function sdCodeOf(sd) {
  const m = String(sd || "").trim().toUpperCase().match(/^([A-Z]{2})\d{2}-(\d)/);
  return m ? { department: m[1], semester: Number(m[2]) } : null;
}

const LETTER = { 10: "A+", 9: "A", 8: "B+", 7: "B", 6: "C+", 5: "C", 4: "D", 0: "F" };

// One row of the old file + our subject -> what is stored, or a skip / error.
//   returns { skip } | { error } | { result, warnings }
export function oldRowResult(row, subject) {
  const status = String(row.status ?? "").trim().toUpperCase();
  if (status === "X") return { skip: "Not registered for this exam (X)." };
  if (status !== "P" && status !== "F") return { error: `Result "${row.status}" is not P, F or X.` };

  const ia = cellOf(row.ia);
  const theory = cellOf(row.theory);
  const practical = cellOf(row.practical);
  const cells = [ia, theory, practical];
  const codes = cells.filter((c) => c.code).map((c) => c.code);
  const warnings = [];

  const total = cells.reduce((a, c) => a + (c.n ?? 0), 0);
  const max = Number(subject.totalMax) || 0;
  const pts = String(row.gradeId ?? "").trim().toUpperCase().match(/^[EI](\d{2})$/);

  let out;
  if (status === "P") {
    if (codes.length) warnings.push(`Shown as passed but has ${codes.join(", ")}.`);
    const computed = gradeFor(total, max);
    const points = pts ? Number(pts[1]) : computed.points;
    const grade = LETTER[points] ?? computed.grade;
    if (pts && points !== computed.points)
      warnings.push(`Old grade ${grade} (${points}) but ${total}/${max} gives ${computed.grade} (${computed.points}) – the old grade is kept.`);
    out = { status: "PASS", grade, gradePoint: points };
  } else if (codes.includes("AB")) out = { status: "ABSENT", grade: "F", gradePoint: 0 };
  else if (codes.includes("NE")) out = { status: "NE", grade: "NE", gradePoint: 0 };
  else if (codes.includes("MP")) out = { status: "WITHHELD", grade: "", gradePoint: 0 };
  else {
    const odd = codes.filter((c) => c !== "X");
    if (odd.length) warnings.push(`Unknown mark ${odd.join(", ")} – taken as failed.`);
    out = { status: "FAIL", grade: "F", gradePoint: 0 };
  }

  const text = (c) => (c.none ? "--" : c.code ?? String(c.n));
  return {
    warnings,
    result: {
      ...out,
      cie: ia.n ?? null,
      see: theory.n ?? null,
      practical: practical.n ?? null,
      total,
      max: max || null,
      credit: subject.credit ?? null,
      semester: subject.semester ?? null,
      marksText: cells.map(text).join("/"),
    },
  };
}
