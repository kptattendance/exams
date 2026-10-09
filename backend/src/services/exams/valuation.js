// src/services/exams/valuation.js
//
// Pure rules for coding and valuation (unit-tested in test/valuation.test.js).

import crypto from "node:crypto";

// Dummy numbers: 2 letters + 4 digits, e.g. "KQ4821". Letters that look like
// digits (I, O) are left out so the clerk can't misread them.
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

export function makeDummies(count, taken = new Set()) {
  const out = [];
  const used = new Set(taken);
  let guard = 0;
  while (out.length < count) {
    if (++guard > count * 50 + 1000) throw new Error("Could not create enough dummy numbers.");
    const b = crypto.randomBytes(4);
    const d =
      LETTERS[b[0] % LETTERS.length] + LETTERS[b[1] % LETTERS.length] + String(b.readUInt16BE(2) % 10000).padStart(4, "0");
    if (used.has(d)) continue;
    used.add(d);
    out.push(d);
  }
  return out;
}

// Random order so a packet never follows register-number order
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Split into packets of about `size`; the last packet is never tiny
export function packetize(items, size = 30) {
  const n = Math.max(1, Math.round(items.length / size));
  const base = Math.floor(items.length / n);
  const extra = items.length % n; // the first `extra` packets get one more
  const out = [];
  let i = 0;
  for (let k = 0; k < n; k++) {
    const len = base + (k < extra ? 1 : 0);
    out.push(items.slice(i, i + len));
    i += len;
  }
  return out.filter((p) => p.length);
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

// Compare first and second entry of a packet → list of dummies that differ
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

// Raw marks (out of 100) → subject's theory maximum (e.g. 50), rounded up
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
