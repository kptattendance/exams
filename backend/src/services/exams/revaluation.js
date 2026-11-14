// src/services/exams/revaluation.js
//
// KPT 9.8.2 Revaluation – pure rules (unit-tested in test/revaluation.test.js).
//   b) revalued by an examiner different from the original one
//   c) final marks = the higher of the original and the revaluation marks
//   d) difference more than 15 % of the maximum -> a third evaluation by a senior examiner
//   e) then final marks = the average of the two highest of the three
// Marks are the paper's raw marks (out of rawMax, e.g. 100), like valuation.
// Averages are rounded UP (in the student's favour), as in valuation.

export const REVALUATION_PERCENT = 15;

//   original : the marks he was given (raw)
//   reval    : revaluation marks (raw) or null
//   third    : third evaluation marks (raw) or null
// -> { status: WAITING | NEEDS_THIRD | DONE, final, rule, gap, limit }
export function revaluationOutcome({ original, reval, third }, { rawMax = 100, percent = REVALUATION_PERCENT } = {}) {
  const has = (v) => v !== null && v !== undefined && v !== "";
  if (!has(original)) return { status: "WAITING", reason: "The original marks are not on record." };
  if (!has(reval)) return { status: "WAITING", reason: "Revaluation marks not entered." };
  const o = Number(original);
  const r = Number(reval);
  const limit = (Number(rawMax) * percent) / 100;
  const gap = Math.abs(r - o);
  if (gap <= limit) return { status: "DONE", final: Math.max(o, r), rule: "higher", gap, limit };
  if (!has(third)) return { status: "NEEDS_THIRD", gap, limit, reason: `Revaluation differs by ${gap} (more than ${limit}) – a third evaluation by a senior examiner is needed.` };
  const [a, b] = [o, r, Number(third)].sort((x, y) => y - x);
  return { status: "DONE", final: Math.ceil((a + b) / 2), rule: "best-two", gap, limit };
}

// Same name, ignoring case, spaces and dots ("Dr. K. Rao" = "dr k rao")
export const sameValuer = (a, b) => {
  const n = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return Boolean(n(a)) && n(a) === n(b);
};
