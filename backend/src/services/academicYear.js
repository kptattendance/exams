// src/services/academicYear.js
//
// The running academic year is set once by the Admin and used everywhere
// (HOD IA / attendance sheets, new exams). Nobody else chooses it, so sheets
// can never be saved under the wrong year.

import Setting from "../models/Setting.js";

export const AY = /^\d{4}-\d{2}$/;

// June onwards counts as the new academic year
export function computedAcademicYear(date = new Date()) {
  const start = date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

let cache = { value: null, at: 0 };

export async function getAcademicYear() {
  if (cache.value && Date.now() - cache.at < 60_000) return cache.value;
  const doc = await Setting.findById("academicYear").lean();
  const value = doc?.value && AY.test(doc.value) ? doc.value : computedAcademicYear();
  cache = { value, at: Date.now() };
  return value;
}

export async function setAcademicYear(value, by) {
  if (!AY.test(value || "")) throw new Error("Academic year must look like 2026-27.");
  const [a, b] = value.split("-").map(Number);
  if ((a + 1) % 100 !== b) throw new Error("The two years must follow each other, e.g. 2026-27.");
  await Setting.findByIdAndUpdate("academicYear", { $set: { value, updatedBy: by || "" } }, { upsert: true });
  cache = { value, at: Date.now() };
  return value;
}

// Middleware for the HOD / Exam Officer sheet routes: whatever year the page
// sends, the running year is used (Admin may still work on another year).
export async function forceAcademicYear(req, res, next) {
  try {
    if (req.user?.role === "admin") return next();
    const year = await getAcademicYear();
    if (req.body && typeof req.body === "object") req.body.academicYear = year;
    // Express 5: req.query is a getter, so replace it
    Object.defineProperty(req, "query", { value: { ...req.query, academicYear: year }, writable: true, configurable: true });
    next();
  } catch (e) {
    next(e);
  }
}
