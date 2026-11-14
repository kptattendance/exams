import test from "node:test";
import assert from "node:assert/strict";

import { cieMinimum, makeupAllowed, makeupPassed } from "../src/services/exams/cieMakeup.js";

test("KPT 5.5.2: no seminar, project, internship or practical course", () => {
  assert.equal(makeupAllowed({ name: "Engineering Mathematics", iaMax: 50, theoryExamMax: 50 }), true);
  assert.equal(makeupAllowed({ name: "Integrated course", iaMax: 50, theoryExamMax: 50, practicalExamMax: 50 }), true);
  assert.equal(makeupAllowed({ name: "Workshop Practice", iaMax: 50, theoryExamMax: 0, practicalExamMax: 50 }), false);
  assert.equal(makeupAllowed({ name: "Major Project", iaMax: 50, theoryExamMax: 50 }), false);
  assert.equal(makeupAllowed({ name: "Industrial Internship", iaMax: 100 }), false);
  assert.equal(makeupAllowed({ name: "Technical Seminar", iaMax: 50 }), false);
});

test("make-up passes at the CIE minimum (40 % unless the subject says otherwise)", () => {
  assert.equal(cieMinimum({ iaMax: 50 }), 20);
  assert.equal(makeupPassed(20, { iaMax: 50 }), true);
  assert.equal(makeupPassed(19.5, { iaMax: 50 }), false);
  assert.equal(makeupPassed(22, { iaMax: 50, iaMin: 25 }), false);
  assert.equal(makeupPassed(null, { iaMax: 50 }), false);
});
