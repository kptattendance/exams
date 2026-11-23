// src/services/exams/valuation.js
//
// Pure rules for ATS coding and valuation (unit-tested in test/valuation.test.js).

import crypto from "node:crypto";

// ATS (answer-script code) = 6-digit number of the room diary + 2-digit serial
// of the student in that diary, e.g. "48271507" (shown as 482715-07).
// One room diary = one ATS number = one packet for one valuer: at most 25 students
// of one paper in one room, in EVERY room (also the 60-seat Room 114, so that a
// packet's size never points to a room); more students of the paper in the room
// get a further diary. The 6 digits are random (nobody can tell the room
// or class from them) and never used twice in an exam.
export const ATS_RX = /^\d{8}$/;
export const fmtAts = (a) => (ATS_RX.test(String(a || "")) ? `${String(a).slice(0, 6)}-${String(a).slice(6)}` : String(a || ""));
export const MAX_PER_DIARY = 99;
export const ATS_LIMIT = 25;

export function newAtsBase(taken = new Set()) {
  for (let guard = 0; guard < 100000; guard++) {
    const b = String(crypto.randomInt(100000, 1000000));
    if (!taken.has(b)) return b;
  }
  throw new Error("Could not make a new ATS number.");
}

// Random order
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Serials of one diary. Students already there keep their serial; the others
// get free serials in random order (so -01 is not the first register number).
// old: { reg: "07" }, students: [reg] (register-number order) -> { reg: "07" }
export function assignSerials(old = {}, students = []) {
  if (students.length > MAX_PER_DIARY) throw new Error(`At most ${MAX_PER_DIARY} students of one paper in one room.`);
  const out = {};
  const used = new Set();
  for (const r of students) if (old[r]) (out[r] = old[r]), used.add(Number(old[r]));
  const add = students.filter((r) => !out[r]);
  // the smallest free serials, handed out in random order
  const free = [];
  for (let n = 1; n <= MAX_PER_DIARY && free.length < add.length; n++) if (!used.has(n)) free.push(n);
  const pool = shuffle(free);
  add.forEach((r, i) => (out[r] = String(pool[i]).padStart(2, "0")));
  return out;
}

// The room diaries of one session after the rooms are saved.
//   rooms:  [{ name, students: [reg], seats: { reg: desk } }]  (split in desk order)
//   papers: Map reg -> [code]  (papers each student writes in this session)
//   old:    [{ room, code, part, base, number, serials: { reg: "07" } }]
//   takenBases: Set of 6-digit numbers used anywhere in the exam
//   nextNumber(): the next packet number ("P-0012")
// -> [{ room, code, part, base, number, serials, isNew, changed }]  (diaries with students only)
export function planDiaries({ rooms, papers, old = [], takenBases = new Set(), nextNumber }) {
  const oldOf = new Map(old.map((d) => [`${d.room}|${d.code}|${d.part || 1}`, d]));
  const taken = new Set(takenBases);
  const out = [];
  for (const room of rooms) {
    const byCode = new Map();
    for (const reg of [...room.students].sort()) {
      for (const code of papers.get(reg) || []) {
        if (!byCode.has(code)) byCode.set(code, []);
        byCode.get(code).push(reg);
      }
    }
    for (const code of [...byCode.keys()].sort()) {
      // in desk order, so that one ATS is one block of desks
      const desk = (reg) => Number(room.seats?.[reg]) || Infinity;
      const inOrder = [...byCode.get(code)].sort((a, b) => desk(a) - desk(b) || a.localeCompare(b));
      const limit = ATS_LIMIT;
      for (let i = 0; i * limit < inOrder.length; i++) {
        const part = i + 1;
        const students = inOrder.slice(i * limit, (i + 1) * limit).sort();
        const prev = oldOf.get(`${room.name}|${code}|${part}`);
        const serials = assignSerials(prev?.serials || {}, students);
        let base = prev?.base;
        if (!base) taken.add((base = newAtsBase(taken)));
        const before = prev ? Object.entries(prev.serials || {}).sort().join(",") : "";
        const after = Object.entries(serials).sort().join(",");
        out.push({ room: room.name, code, part, base, number: prev?.number || nextNumber(), serials, isNew: !prev, changed: Boolean(prev) && before !== after });
      }
    }
  }
  return out;
}

// Typed marks: whole or half marks between 0 and max
export function parseMark(value, max) {
  if (value === "" || value === null || value === undefined) return { ok: false, error: "empty" };
  const n = Number(String(value).trim());
  if (!Number.isFinite(n)) return { ok: false, error: "not a number" };
  if (n < 0 || n > max) return { ok: false, error: `must be 0–${max}` };
  if (Math.round(n * 2) !== n * 2) return { ok: false, error: "use whole or half marks" };
  return { ok: true, value: n };
}

// The theory award list (ML): marks out of 50 at most, or AB (typed in any case)
export const ML_MAX = 50;
export function parseEntry(value, max = ML_MAX) {
  const typed = String(value ?? "").trim().toUpperCase();
  if (typed === "AB") return { ok: true, value: "AB" };
  return parseMark(typed, Math.min(Number(max) || ML_MAX, ML_MAX));
}

// Compare first and second entry of a packet → list of ATS numbers that differ
export function compareEntries(first = {}, second = {}) {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  return [...keys].filter((k) => first[k] !== second[k]).sort();
}

// Final marks out of rawMax from up to three valuations.
//   one valuation                → that one
//   two within the limit         → average of the two
//   two apart by more than limit → third valuation needed
//   three                        → average of the third and the nearer of the first two
// Averages are rounded UP (in the student's favour).
export function finalMarks({ v1, v2, v3 }, { rawMax = 100, percent = 15 } = {}) {
  if (v1 === undefined || v1 === null) return { status: "WAITING", reason: "First valuation not entered." };
  if (v2 === undefined || v2 === null) {
    if (v3 !== undefined && v3 !== null) return { status: "WAITING", reason: "Second valuation not entered." };
    return { status: "DONE", raw: v1, rule: "single" };
  }
  const limit = (rawMax * percent) / 100;
  const gap = Math.abs(v1 - v2);
  if (gap <= limit) return { status: "DONE", raw: Math.ceil((v1 + v2) / 2), rule: "average", gap };
  if (v3 === undefined || v3 === null) return { status: "NEEDS_THIRD", gap, reason: `1st and 2nd valuation differ by ${gap} (more than ${limit}).` };
  const near = Math.abs(v3 - v1) < Math.abs(v3 - v2) ? v1 : Math.abs(v3 - v2) < Math.abs(v3 - v1) ? v2 : Math.max(v1, v2);
  return { status: "DONE", raw: Math.ceil((v3 + near) / 2), rule: "third", gap };
}

// Raw marks (out of the paper maximum, 50) → subject's theory maximum, rounded up
export function reduce(raw, rawMax, seeMax) {
  if (raw === null || raw === undefined) return null;
  if (!seeMax || seeMax === rawMax) return Math.ceil(raw);
  return Math.ceil((raw * seeMax) / rawMax - 1e-9);
}

export const valuationsOf = (script) => {
  const v = {};
  for (const x of script.valuations || []) v[`v${x.round}`] = x.marks;
  return v;
};
