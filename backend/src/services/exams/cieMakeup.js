// src/services/exams/cieMakeup.js
//
// Supplementary semester (KPT 5.5) – pure rules, unit-tested in test/cieMakeup.test.js.

import { minimumOf } from "./results.js";
import { CieMakeup } from "../../models/CieMakeup.js";

// KPT 5.5.2: no seminar, project work, internship or practical course
export function makeupAllowed(subject) {
  if (!subject) return false;
  const name = String(subject.name || "");
  if (/\b(project|internship|seminar)\b/i.test(name)) return false;
  const theory = Number(subject.theoryExamMax) || 0;
  const practical = Number(subject.practicalExamMax) || 0;
  if (!theory && practical > 0) return false; // a practical course
  return Number(subject.iaMax) > 0; // there is a CIE to make up
}

// The CIE minimum of a subject (KPT 9.2: 40 % unless the subject says otherwise)
export const cieMinimum = (subject) => minimumOf(Number(subject?.iaMax) || 0, subject?.iaMin);

export const makeupPassed = (marks, subject) =>
  marks !== null && marks !== undefined && marks !== "" && Number(marks) + 1e-9 >= cieMinimum(subject);

// Passed make-ups of these students: Map("studentId|subjectId" -> { marks, cieMax })
// – used when back papers are registered for an examination
export async function passedMakeups(studentIds) {
  if (!studentIds.length) return new Map();
  const list = await CieMakeup.find({ student: { $in: studentIds }, passed: true }).select("student subject marks cieMax enteredAt").sort({ enteredAt: 1 }).lean();
  return new Map(list.map((m) => [`${m.student}|${m.subject}`, m]));
}
