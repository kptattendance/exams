// src/services/exams/practical.js
//
// Pure rules for practical exams (unit-tested in test/practical.test.js).

import crypto from "node:crypto";

import { effectiveOf, subjectFeePaid } from "./rules.js";

export const ATTENDANCE = ["PRESENT", "ABSENT", "MALPRACTICE"];
export const MAX_CODE_TRIES = 5;

export const batchLabel = (code, number) => `${code}-B${number}`;

// The HOD of a subject's BOARD conducts its practical exam, for the students
// of every branch. Most boards are a department; these are the exceptions.
//   PO = Polymer board → ps department
//   EG (English) and KA (Kannada) → Science & English department
const BOARD_DEPARTMENT = { PO: "ps", EG: "sc", KA: "sc" };
export const CONDUCTING_DEPARTMENTS = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps", "sc"];

export const boardDepartment = (board) => {
  const b = String(board || "").trim().toUpperCase();
  return BOARD_DEPARTMENT[b] || b.toLowerCase();
};

// Boards whose practical exams a department's HOD conducts: "sc" → ["SC", "EG", "KA"]
export function boardsOf(department) {
  const d = String(department || "").trim().toLowerCase();
  if (!d) return [];
  const extra = Object.keys(BOARD_DEPARTMENT).filter((b) => BOARD_DEPARTMENT[b] === d);
  const own = Object.values(BOARD_DEPARTMENT).includes(d) && !["sc"].includes(d) ? [] : [d.toUpperCase()];
  return [...new Set([...own, ...extra])];
}

// Who takes the practical exam of `code`: registered for it, the subject has a
// practical exam, eligible (after any COE override) and the fee is paid.
export function practicalCandidates(regs, code) {
  const out = [];
  for (const r of regs) {
    const s = (r.subjects || []).find((x) => x.code === code);
    if (!s?.hasPractical) continue;
    if (effectiveOf(s) !== "ELIGIBLE" || !subjectFeePaid(r, s)) continue;
    out.push({
      registration: r._id,
      student: r.student,
      registerNumber: r.registerNumber,
      name: r.name,
      department: String(r.department || "").toLowerCase(),
      kind: s.kind,
      subject: s.subject,
      semester: s.semester,
    });
  }
  return out.sort((a, b) => String(a.registerNumber).localeCompare(String(b.registerNumber)));
}

// Split into `count` batches of nearly equal size, keeping the order.
// There is no size limit: 23 students in 1 batch is fine.
export function splitEvenly(items, count = 1) {
  const n = Math.min(Math.max(1, Math.floor(Number(count)) || 1), Math.max(1, items.length));
  const base = Math.floor(items.length / n);
  const extra = items.length % n; // the first `extra` batches get one more
  const out = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const len = base + (k < extra ? 1 : 0);
    out.push(items.slice(i, i + len));
    i += len;
  }
  return out;
}

// The HOD's arrangement: [{ number, students: [registrationId] }]
//   permitted : ids that may take the exam
//   locked    : Map(number -> ids) of batches whose marks are already submitted
export function checkArrangement(batches, permitted, locked = new Map()) {
  const errors = [];
  const seen = new Map();
  const numbers = new Set();
  for (const ids of locked.values()) for (const id of ids) seen.set(String(id), "a submitted batch");
  for (const b of batches) {
    const number = Number(b.number);
    if (!Number.isInteger(number) || number < 1) {
      errors.push("A batch has no number.");
      continue;
    }
    if (locked.has(number)) continue; // submitted batches are never changed
    if (numbers.has(number)) errors.push(`Batch ${number} is listed twice.`);
    numbers.add(number);
    for (const raw of b.students || []) {
      const id = String(raw);
      if (!permitted.has(id)) errors.push(`A student in batch ${number} is not permitted to take this exam.`);
      else if (seen.has(id)) errors.push(`A student is in batch ${number} and also in ${seen.get(id)}.`);
      else seen.set(id, `batch ${number}`);
    }
  }
  const unassigned = [...permitted].filter((id) => !seen.has(String(id)));
  return { ok: errors.length === 0, errors: [...new Set(errors)], unassigned };
}

// Practical marks are whole numbers between 0 and the subject's practical maximum
export function parsePracticalMark(value, max) {
  if (value === "" || value === null || value === undefined) return { ok: false, error: "empty" };
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return { ok: false, error: "not a number" };
  if (!Number.isInteger(n)) return { ok: false, error: "whole marks only" };
  if (n < 0 || n > max) return { ok: false, error: `must be 0–${max}` };
  return { ok: true, value: n };
}

// Check the typed sheet against the batch.
//   rows     : { [registerNumber]: { attendance, marks } }
//   complete : true when submitting (every student needs an entry),
//              false for a draft (empty rows are allowed)
export function checkSheet(students, rows = {}, max, { complete = true } = {}) {
  const values = [];
  const errors = [];
  for (const s of students) {
    const row = rows[s.registerNumber] || {};
    const attendance = ATTENDANCE.includes(row.attendance) ? row.attendance : null;
    const blank = row.marks === "" || row.marks === null || row.marks === undefined;
    if (!attendance) {
      if (complete) errors.push({ registerNumber: s.registerNumber, error: "not entered" });
      values.push({ registerNumber: s.registerNumber, attendance: null, marks: null });
      continue;
    }
    if (attendance !== "PRESENT") {
      values.push({ registerNumber: s.registerNumber, attendance, marks: null });
      continue;
    }
    if (blank && !complete) {
      values.push({ registerNumber: s.registerNumber, attendance, marks: null });
      continue;
    }
    const m = parsePracticalMark(row.marks, max);
    if (!m.ok) errors.push({ registerNumber: s.registerNumber, error: m.error });
    values.push({ registerNumber: s.registerNumber, attendance, marks: m.ok ? m.value : null });
  }
  return { ok: errors.length === 0, values, errors };
}

// ------------------------------------------------ external examiner's code

// 6 digits, easy to read out over the phone. Guessing is stopped by the
// lock after MAX_CODE_TRIES wrong tries.
export const makeCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const clean = (code) => String(code ?? "").replace(/\s+/g, "");
const hashOf = (code, salt) => crypto.scryptSync(clean(code), salt, 32).toString("hex");

export function newAccess(code) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: hashOf(code, salt), fails: 0 };
}

// → { ok } or { ok: false, reason: "NONE" | "LOCKED" | "WRONG", left }
export function checkCode(access, code) {
  if (!access?.hash || !access?.salt) return { ok: false, reason: "NONE" };
  if ((access.fails || 0) >= MAX_CODE_TRIES) return { ok: false, reason: "LOCKED" };
  const a = Buffer.from(hashOf(code, access.salt), "hex");
  const b = Buffer.from(access.hash, "hex");
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return { ok: true };
  return { ok: false, reason: "WRONG", left: MAX_CODE_TRIES - (access.fails || 0) - 1 };
}

export const sheetSummary = (students) => ({
  present: students.filter((s) => s.attendance === "PRESENT").length,
  absent: students.filter((s) => s.attendance === "ABSENT").length,
  malpractice: students.filter((s) => s.attendance === "MALPRACTICE").length,
});

// A student who is no longer permitted (eligibility or fee changed after the
// batches were made) leaves his batch automatically.
//   regs : the registrations of the students in the batch
export function prune(students, regs, code) {
  const permitted = new Set(practicalCandidates(regs, code).map((c) => String(c.registration)));
  const keep = students.filter((s) => permitted.has(String(s.registration)));
  const removed = students.filter((s) => !permitted.has(String(s.registration)));
  return { keep, removed };
}

// ------------------------------------------------ timetable clashes

// Practical sessions. S1–S4 are the HOD time table's slots; FN / AN are the
// older morning / afternoon sessions (kept for batches already fixed that way).
export const PRACTICAL_SESSIONS = {
  S1: { label: "8:30 AM – 11:30 AM", start: "08:30", end: "11:30" },
  S2: { label: "11:30 AM – 2:30 PM", start: "11:30", end: "14:30" },
  S3: { label: "2:30 PM – 5:30 PM", start: "14:30", end: "17:30" },
  S4: { label: "5:00 PM – 8:00 PM", start: "17:00", end: "20:00" },
  FN: { label: "morning", start: "10:00", end: "13:00" },
  AN: { label: "afternoon", start: "14:00", end: "17:00" },
};
export const SESSION_CODES = Object.keys(PRACTICAL_SESSIONS);
const minutes = (hm) => {
  const [h, m] = String(hm || "").split(":").map(Number);
  return h * 60 + (m || 0);
};
// Sort key: sessions in the order of their start time, "not set" last
export const sessionRank = (s) => (PRACTICAL_SESSIONS[s] ? minutes(PRACTICAL_SESSIONS[s].start) : 9999);
// Two sessions of the same day overlap (S3 and S4 share 5:00–5:30)
const overlap = (s1, s2, times = PRACTICAL_SESSIONS) => {
  const a = times[s1];
  const b = times[s2];
  if (!a || !b) return s1 === s2;
  return minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end);
};

export const slotOf = (b) => (b.date && b.session ? `${b.date}|${b.session}` : "");
const same = (a, b) => Boolean(a) && Boolean(b) && String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const sessionName = (s) => PRACTICAL_SESSIONS[s]?.label || s;

// Why the HOD's timetable cannot be saved.
//   batches : every practical batch of the exam as it would be after saving
//             [{ label, date, session, lab, set, internal, external, students: [{ id, registerNumber }] }]
//             set = id of the examiner set; internal / external identify the persons
//   changed : labels of the batches being saved (only these are checked)
//   written : Map(studentId -> Map("date|session" -> paper code)) from the written timetable
//   paperTimes : { FN: { start, end }, AN: { start, end } } of the written exam
export function findClashes(batches, changed, written = new Map(), paperTimes = {}) {
  const out = [];
  const list = batches.filter((b) => slotOf(b));
  // a practical session against a written-exam session (FN / AN at the written exam's times)
  const meetsPaper = (s, ps) => {
    if (s === ps) return true;
    const p = paperTimes[ps] || PRACTICAL_SESSIONS[ps];
    return Boolean(p) && overlap(s, "P", { [s]: PRACTICAL_SESSIONS[s], P: p });
  };
  for (const a of list) {
    if (!changed.has(a.label)) continue;
    const at = `${a.date} ${sessionName(a.session)}`;
    for (const s of a.students || []) {
      for (const [key, paper] of written.get(String(s.id)) || []) {
        const [date, ps] = key.split("|");
        if (date === a.date && meetsPaper(a.session, ps)) out.push(`${a.label}: ${s.registerNumber} writes the theory paper ${paper} on ${at}.`);
      }
    }
    for (const b of list) {
      if (b === a || b.date !== a.date || !overlap(a.session, b.session)) continue;
      if (changed.has(b.label) && b.label < a.label) continue; // report each pair once
      const ids = new Set((b.students || []).map((s) => String(s.id)));
      const both = (a.students || []).filter((s) => ids.has(String(s.id)));
      if (both.length)
        out.push(`${a.label} and ${b.label} are both on ${at}, but ${both.slice(0, 3).map((s) => s.registerNumber).join(", ")}${both.length > 3 ? ` and ${both.length - 3} more` : ""} must attend both.`);
      if (same(a.set, b.set) || same(a.internal, b.internal) || same(a.external, b.external))
        out.push(`${a.label} and ${b.label} are both on ${at} with the same examiner.`);
      if (same(a.lab, b.lab)) out.push(`${a.label} and ${b.label} are both on ${at} in ${String(a.lab).trim()}.`);
    }
  }
  return [...new Set(out)];
}
