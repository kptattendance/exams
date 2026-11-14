import test from "node:test";
import assert from "node:assert/strict";

import { progressionFor, studentResult } from "../src/services/exams/results.js";

// KPT 9.3 vertical progression
test("semester 1 to 2 is automatic", () => {
  assert.equal(progressionFor(1, {}, 1.5).decision, "PROMOTE");
});

test("from semester 2: half the year's credits and CGPA 4.0", () => {
  // year I = 24 + 25 = 49 credits -> 24.5 needed
  assert.equal(progressionFor(2, { 1: 20, 2: 5 }, 4.5).decision, "PROMOTE");
  assert.equal(progressionFor(2, { 1: 20, 2: 4 }, 4.5).decision, "DETAIN");
  // semester 3 alone (26) -> 13 needed; CGPA must be 4.0 or more
  assert.equal(progressionFor(3, { 3: 13 }, 4).decision, "PROMOTE");
  assert.equal(progressionFor(3, { 3: 13 }, 3.99).decision, "DETAIN");
  assert.equal(progressionFor(3, { 3: 12 }, 8).decision, "DETAIN");
  // year II = 26 + 26 -> 26 needed; credits of the previous year do not count
  assert.equal(progressionFor(4, { 2: 25, 3: 20, 4: 6 }, 5).decision, "PROMOTE");
  assert.equal(progressionFor(4, { 2: 25, 3: 20, 4: 5 }, 5).decision, "DETAIN");
});

test("no decision without a CGPA, none after the final semester", () => {
  assert.equal(progressionFor(3, { 3: 26 }, null).decision, "UNDECIDED");
  assert.equal(progressionFor(6, { 6: 18 }, 9).decision, "NONE");
});

// KPT 10.2 malpractice decisions cancel the right subjects
test("PSC / PEC / PEC+ cancel the right subjects", () => {
  const subj = { iaMax: 50, iaMin: 20, theoryExamMax: 50, theoryExamMin: 20, totalMax: 100, totalMin: 40, credit: 4 };
  const S = (code, sem, att, marks, kind = "REGULAR") => ({
    subject: code, code, name: code, semester: sem, kind, iaMarks: 40, iaMax: 50, eligibility: "ELIGIBLE",
    see: { attendance: att, marks }, fee: { paid: true },
  });
  const base = { regularFee: { paid: true }, subjects: [S("A3", 3, "MALPRACTICE", null), S("B3", 3, "PRESENT", 30), S("C1", 1, "PRESENT", 30, "BACKLOG")] };
  const statuses = (malpractice) => studentResult({ ...base, malpractice }, () => subj).courses.map((c) => c.status).join(",");
  assert.equal(statuses(null), "WITHHELD,PASS,PASS");
  assert.equal(statuses({ decision: "PSC" }), "FAIL,PASS,PASS");
  assert.equal(statuses({ decision: "PEC", semesters: [3] }), "FAIL,FAIL,PASS");
  assert.equal(statuses({ decision: "PEC_PLUS" }), "FAIL,FAIL,FAIL");
});
