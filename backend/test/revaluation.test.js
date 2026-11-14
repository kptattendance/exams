import test from "node:test";
import assert from "node:assert/strict";

import { revaluationOutcome, sameValuer } from "../src/services/exams/revaluation.js";

test("within 15 %: the higher of the original and the revaluation", () => {
  assert.deepEqual(
    { s: revaluationOutcome({ original: 40, reval: 52 }).status, f: revaluationOutcome({ original: 40, reval: 52 }).final },
    { s: "DONE", f: 52 }
  );
  assert.equal(revaluationOutcome({ original: 60, reval: 50 }).final, 60); // never lower
  assert.equal(revaluationOutcome({ original: 40, reval: 55 }).final, 55); // exactly 15 of 100
});

test("more than 15 %: third evaluation, then the average of the best two (rounded up)", () => {
  assert.equal(revaluationOutcome({ original: 30, reval: 50 }).status, "NEEDS_THIRD");
  assert.equal(revaluationOutcome({ original: 30, reval: 50, third: 45 }).final, 48); // (50 + 45) / 2 = 47.5 -> 48
  assert.equal(revaluationOutcome({ original: 70, reval: 50, third: 60 }).final, 65);
  // a paper valued out of 50: the limit is 7.5
  assert.equal(revaluationOutcome({ original: 20, reval: 28 }, { rawMax: 50 }).status, "NEEDS_THIRD");
});

test("waiting for marks", () => {
  assert.equal(revaluationOutcome({ original: 40, reval: null }).status, "WAITING");
  assert.equal(revaluationOutcome({ original: null, reval: 40 }).status, "WAITING");
});

test("the revaluer must be a different examiner", () => {
  assert.equal(sameValuer("Dr. K. Rao", "dr k rao"), true);
  assert.equal(sameValuer("K Rao", "S Rao"), false);
  assert.equal(sameValuer("", ""), false);
});
