// src/services/exams/sheetVerification.js
//
// The COE's corrections to a frozen Final IA / attendance sheet after the
// verifier has checked it (unit-tested in test/sheetVerification.test.js).
// A correction is always "as frozen -> now": changing a value back to what was
// frozen removes the correction.

export const MIN_ATTENDANCE = 75;
const round2 = (n) => Math.round(Number(n) * 100) / 100;
const same = (a, b) => String(a) === String(b);

// what people see and type: IA marks, or attendance in %
export const shownValue = (type, raw, max) => {
  if (raw === null || raw === undefined) return null;
  return type === "ia" ? Number(raw) : max > 0 ? round2((Number(raw) / max) * 100) : null;
};
const storedValue = (type, value, max) => (type === "ia" ? value : max === 100 ? value : (value / 100) * max);

// below the minimum? (the same rule as exam eligibility)
export function isLow(type, value, sub) {
  if (value === null || value === undefined) return false;
  if (type === "attendance") return value + 1e-9 < MIN_ATTENDANCE;
  const min = Number(sub.iaMin) || 0;
  const subjectMax = Number(sub.iaMax) || 0;
  const sheetMax = Number(sub.maxMarks) || subjectMax;
  const scaled = subjectMax && sheetMax && sheetMax !== subjectMax ? (value / sheetMax) * subjectMax : value;
  return scaled + 1e-9 < min;
}

// doc: the sheet; changes: [{ studentId, subjectId, value }]; info: Map(subjectId -> { iaMin, iaMax })
// -> { error } or { changed, crossed: [{ registerNumber, code, nowLow }] }  (doc is updated, not saved)
export function applyCorrections(doc, type, changes, info = new Map(), by = "", now = new Date()) {
  const list = doc.verification.corrections;
  const crossed = [];
  let changed = 0;
  for (const c of changes || []) {
    const st = (doc.students || []).find((x) => same(x.studentId, c.studentId));
    const sub = (doc.subjects || []).find((x) => same(x.subjectId, c.subjectId));
    if (!st || !sub) return { error: "A student or course is not on this sheet." };
    const max = type === "ia" ? Number(sub.maxMarks) : Number(sub.maxClasses);
    const value = Number(c.value);
    const limit = type === "ia" ? max : 100;
    if (c.value === "" || c.value === null || c.value === undefined || !Number.isFinite(value) || value < 0 || value > limit)
      return { error: `${st.registerNumber} · ${sub.code}: enter a value from 0 to ${limit}.` };
    if (type === "attendance" && !(max > 0)) return { error: `${sub.code}: total classes are not entered on this sheet.` };
    const next = round2(value);

    const cells = type === "ia" ? st.marks : st.attendance;
    const field = type === "ia" ? "marks" : "classesAttended";
    let cell = cells.find((x) => same(x.subjectId, sub.subjectId));
    if (cell?.notRequired) return { error: `${st.registerNumber} does not take ${sub.code}.` };
    const current = shownValue(type, cell?.[field], max);
    if (current === next) continue;

    if (!cell) {
      cells.push({ subjectId: sub.subjectId, [field]: null });
      cell = cells[cells.length - 1];
    }
    cell[field] = storedValue(type, next, max);
    changed++;

    const meta = { ...(info.get(String(sub.subjectId)) || {}), maxMarks: sub.maxMarks };
    if (isLow(type, current, meta) !== isLow(type, next, meta)) crossed.push({ registerNumber: st.registerNumber, code: sub.code, nowLow: isLow(type, next, meta) });

    const at = list.findIndex((x) => same(x.studentId, st.studentId) && same(x.subjectId, sub.subjectId));
    if (at >= 0) {
      if (list[at].from === next) list.splice(at, 1); // back to the frozen value
      else Object.assign(list[at], { to: next, at: now, by });
    } else {
      list.push({ studentId: st.studentId, registerNumber: st.registerNumber, studentName: st.studentName, subjectId: sub.subjectId, code: sub.code, from: current, to: next, at: now, by });
    }
  }
  return { changed, crossed };
}

// for the screens and the printed copies
export const verificationView = (doc) => ({
  state: doc?.verification?.state || "",
  verifiedAt: doc?.verification?.verifiedAt || null,
  corrections: (doc?.verification?.corrections || []).map((c) => ({
    studentId: String(c.studentId),
    registerNumber: c.registerNumber,
    studentName: c.studentName,
    subjectId: String(c.subjectId),
    code: c.code,
    from: c.from,
    to: c.to,
  })),
});
