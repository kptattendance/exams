import test from "node:test";
import assert from "node:assert/strict";

import { applyCorrections, isLow, shownValue, verificationView } from "../src/services/exams/sheetVerification.js";

const iaDoc = () => ({
  verification: { corrections: [] },
  subjects: [{ subjectId: "S1", code: "25CS31T0", maxMarks: 50 }],
  students: [{ studentId: "A", registerNumber: "103CS25001", studentName: "Asha", marks: [{ subjectId: "S1", marks: 18 }] }],
});
const attDoc = (max = 40) => ({
  verification: { corrections: [] },
  subjects: [{ subjectId: "S1", code: "25CS31T0", maxClasses: max }],
  students: [{ studentId: "A", registerNumber: "103CS25001", studentName: "Asha", attendance: [{ subjectId: "S1", classesAttended: 29 }] }],
});
const info = new Map([["S1", { iaMin: 20, iaMax: 50 }]]);

test("IA correction: old -> new is kept, and crossing the minimum is reported", () => {
  const d = iaDoc();
  const r = applyCorrections(d, "ia", [{ studentId: "A", subjectId: "S1", value: 22 }], info, "coe@x");
  assert.equal(r.changed, 1);
  assert.deepEqual(r.crossed, [{ registerNumber: "103CS25001", code: "25CS31T0", nowLow: false }]);
  assert.equal(d.students[0].marks[0].marks, 22);
  assert.equal(d.verification.corrections[0].from, 18);
  assert.equal(d.verification.corrections[0].to, 22);
});

test("a second change keeps the frozen value; going back to it removes the correction", () => {
  const d = iaDoc();
  applyCorrections(d, "ia", [{ studentId: "A", subjectId: "S1", value: 22 }], info);
  applyCorrections(d, "ia", [{ studentId: "A", subjectId: "S1", value: 25 }], info);
  assert.equal(d.verification.corrections[0].from, 18);
  assert.equal(d.verification.corrections[0].to, 25);
  applyCorrections(d, "ia", [{ studentId: "A", subjectId: "S1", value: 18 }], info);
  assert.equal(d.verification.corrections.length, 0);
  assert.equal(d.students[0].marks[0].marks, 18);
});

test("attendance is corrected in %, also on a sheet with total classes", () => {
  const d = attDoc(40); // 29 of 40 = 72.5 %
  assert.equal(shownValue("attendance", 29, 40), 72.5);
  const r = applyCorrections(d, "attendance", [{ studentId: "A", subjectId: "S1", value: 75 }], new Map());
  assert.equal(r.crossed[0].nowLow, false);
  assert.equal(d.students[0].attendance[0].classesAttended, 30);
  assert.equal(d.verification.corrections[0].from, 72.5);
  assert.equal(d.verification.corrections[0].to, 75);
  assert.equal(isLow("attendance", 74.99, {}), true);
});

test("wrong values and a course the student does not take are refused", () => {
  assert.match(applyCorrections(iaDoc(), "ia", [{ studentId: "A", subjectId: "S1", value: 51 }], info).error, /0 to 50/);
  assert.match(applyCorrections(attDoc(), "attendance", [{ studentId: "A", subjectId: "S1", value: 101 }], info).error, /0 to 100/);
  const d = iaDoc();
  d.students[0].marks[0].notRequired = true;
  assert.match(applyCorrections(d, "ia", [{ studentId: "A", subjectId: "S1", value: 20 }], info).error, /does not take/);
  assert.equal(verificationView(null).state, "");
});
