import test from "node:test";
import assert from "node:assert/strict";

import { gradeFor, minimumOf, scaleCie, courseResult, moderationFor, gradePointAverage, studentResult } from "../src/services/exams/results.js";

const theory = { iaMax: 50, theoryExamMax: 50, practicalExamMax: 0, totalMax: 100, credit: 4 };
const practical = { iaMax: 50, theoryExamMax: 0, practicalExamMax: 50, totalMax: 100, credit: 2 };
const integrated = { iaMax: 50, theoryExamMax: 50, practicalExamMax: 50, totalMax: 150, credit: 5 };
const present = (marks) => ({ attendance: "PRESENT", marks });

test("grade table for 100 marks (9.1.1)", () => {
  const g = (t) => gradeFor(t, 100).grade;
  assert.deepEqual([100, 91, 90, 81, 80, 71, 70, 61, 60, 51, 50, 45, 44, 40, 39].map(g), [
    "A+", "A+", "A", "A", "B+", "B+", "B", "B", "C+", "C+", "C", "C", "D", "D", "F",
  ]);
  assert.deepEqual(gradeFor(95, 100), { grade: "A+", points: 10 });
  assert.deepEqual(gradeFor(42, 100), { grade: "D", points: 4 });
  assert.equal(gradeFor(120, 150).grade, "B+"); // 80 %
  assert.equal(gradeFor(44.5, 100).grade, "C"); // a fraction is rounded up
});

test("grade table for 50-mark courses (9.1.2)", () => {
  const g = (t) => gradeFor(t, 50).grade;
  assert.deepEqual([50, 46, 45, 41, 40, 36, 35, 31, 30, 26, 25, 21, 20, 19].map(g), [
    "A+", "A+", "A", "A", "B+", "B+", "B", "B", "C+", "C+", "C", "C", "D", "F",
  ]);
});

test("minimums and IA scaling", () => {
  assert.equal(minimumOf(50, 0), 20);
  assert.equal(minimumOf(50, 25), 25);
  assert.equal(minimumOf(100), 40);
  assert.equal(scaleCie(20, 25, 50), 40);
  assert.equal(scaleCie(30, 50, 50), 30);
  assert.equal(scaleCie(null, 50, 50), null);
});

test("pass needs 40 % in CIE, in the exam and in total (9.2)", () => {
  const ok = courseResult(theory, { cie: 30, theory: present(25) });
  assert.equal(ok.status, "PASS");
  assert.equal(ok.total, 55);
  assert.equal(ok.grade, "C+");
  assert.equal(courseResult(theory, { cie: 45, theory: present(19) }).status, "FAIL");
  assert.equal(courseResult(theory, { cie: 19, theory: present(45) }).status, "FAIL");
  assert.equal(courseResult(practical, { cie: 40, practical: present(45) }).grade, "A");
  // integrated: each component on its own
  assert.equal(courseResult(integrated, { cie: 40, theory: present(40), practical: present(19) }).status, "FAIL");
  const both = courseResult(integrated, { cie: 40, theory: present(40), practical: present(40) });
  assert.equal(both.status, "PASS");
  assert.equal(both.total, 120);
});

test("absent, malpractice, NE / ANS, fee and missing marks", () => {
  assert.equal(courseResult(theory, { cie: 30, theory: { attendance: "ABSENT" } }).status, "ABSENT");
  assert.equal(courseResult(theory, { cie: 30, theory: { attendance: "MALPRACTICE" } }).status, "WITHHELD");
  assert.equal(courseResult(theory, { eligibility: "NE" }).grade, "NE");
  assert.equal(courseResult(theory, { eligibility: "ANS" }).status, "ANS");
  assert.equal(courseResult(theory, { eligibility: "PENDING" }).status, "INCOMPLETE");
  assert.equal(courseResult(theory, { permitted: false, cie: 30 }).status, "ABSENT");
  assert.equal(courseResult(theory, { cie: 30, theory: {} }).status, "INCOMPLETE");
  assert.equal(courseResult(theory, { cie: null, theory: present(30) }).status, "INCOMPLETE");
  assert.equal(courseResult(integrated, { cie: 30, theory: present(30), practical: {} }).status, "INCOMPLETE");
});

test("moderation: at most 5 marks, only when the student then passes everything (9.10)", () => {
  const item = (key, subject, input) => ({ key, subject, input });
  const a = item("a", theory, { cie: 30, theory: present(17) });
  const b = item("b", theory, { cie: 30, theory: present(18) });
  const fine = item("c", theory, { cie: 30, theory: present(30) });

  assert.deepEqual([...moderationFor([a, b, fine], 5)], [["a", { theory: 3, practical: 0 }], ["b", { theory: 2, practical: 0 }]]);
  assert.equal(moderationFor([a, b, fine], 4).size, 0); // needs 5
  assert.equal(moderationFor([a, b, fine], 0).size, 0); // not approved
  assert.equal(moderationFor([a, item("d", theory, { cie: 30, theory: present(10) })], 5).size, 0); // too far
  assert.equal(moderationFor([a, item("e", theory, { cie: 30, theory: { attendance: "ABSENT" } })], 5).size, 0);
  assert.equal(moderationFor([item("f", theory, { cie: 15, theory: present(40) })], 5).size, 0); // CIE cannot be moderated
  // the total can be short even when the exam minimum is met
  const low = { ...theory, iaMin: 10 };
  assert.deepEqual([...moderationFor([item("g", low, { cie: 15, theory: present(22) })], 5)], [["g", { theory: 3, practical: 0 }]]);
  assert.equal(courseResult(theory, { ...a.input, moderation: { theory: 3 } }).status, "PASS");
});

test("SGPA / CGPA (9.4)", () => {
  const c = (credit, points, status = "PASS", kind = "REGULAR") => ({ credit, points, status, kind });
  assert.deepEqual(gradePointAverage([c(4, 10), c(4, 8), c(2, 0, "FAIL")]), { value: 7.2, registered: 10, earned: 8 });
  assert.equal(gradePointAverage([c(4, 9), c(3, 7), c(4, 0, "FAIL", "BRIDGE"), c(0, 10)]).value, 8.14);
  assert.equal(gradePointAverage([c(4, 9), c(4, 0, "WITHHELD")]).value, null);
  assert.equal(gradePointAverage([c(4, 9), c(4, null)]).value, null);
  assert.equal(gradePointAverage([]).value, null);
});

test("a student's result: back paper IA carried forward, moderation, CGPA with earlier semesters", () => {
  const subjects = { s1: theory, s2: practical, old: theory };
  const sub = (id, extra) => ({ subject: id, code: id.toUpperCase(), kind: "REGULAR", status: "ELIGIBLE", iaMarks: 30, iaMax: 50, ...extra });
  const reg = {
    regularFee: { paid: true },
    subjects: [
      sub("s1", { see: present(18) }),
      sub("s2", { practical: present(45) }),
      sub("old", { kind: "BACKLOG", iaMarks: null, iaMax: null, fee: { paid: true }, see: present(30) }),
    ],
  };
  const past = new Map([
    ["old", { cie: 28, status: "FAIL", points: 0, credit: 4, kind: "REGULAR" }],
    ["done", { cie: 40, status: "PASS", points: 8, credit: 4, kind: "REGULAR" }],
  ]);
  const of = (id) => subjects[id];

  const plain = studentResult(reg, of, past);
  assert.equal(plain.outcome, "FAIL");
  assert.deepEqual(plain.courses.map((c) => c.status), ["FAIL", "PASS", "PASS"]);
  assert.equal(plain.courses[2].cie, 28);
  assert.equal(plain.sgpa, 2.67); // (4×0 + 2×8) / 6
  assert.deepEqual(plain.credits, { registered: 6, earned: 2 });

  const moderated = studentResult(reg, of, past, { moderation: 5 });
  assert.equal(moderated.outcome, "PASS");
  assert.equal(moderated.courses[0].moderation, 2);
  assert.equal(moderated.courses[0].theory, 20);
  assert.equal(moderated.courses[0].grade, "C");
  assert.equal(moderated.sgpa, 6); // (4×5 + 2×8) / 6
  assert.equal(moderated.cgpa, 6.57); // (4×5 + 2×8 + 4×6 + 4×8) / 14

  const unpaid = studentResult({ ...reg, regularFee: { paid: false } }, of, past);
  assert.deepEqual(unpaid.courses.map((c) => c.status), ["ABSENT", "ABSENT", "PASS"]);
});
