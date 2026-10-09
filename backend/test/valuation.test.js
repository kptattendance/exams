import test from "node:test";
import assert from "node:assert/strict";

import { makeDummies, packetize, parseMark, compareEntries, finalMarks, reduce, shuffle } from "../src/services/exams/valuation.js";

test("dummy numbers are unique, readable and avoid ones already used", () => {
  const taken = new Set(["AA0001"]);
  const d = makeDummies(2000, taken);
  assert.equal(new Set(d).size, 2000);
  assert.ok(d.every((x) => /^[A-HJ-NP-Z]{2}\d{4}$/.test(x)));
  assert.ok(!d.includes("AA0001"));
});

test("packets of about 30, last one never tiny", () => {
  const sizes = (n) => packetize(Array.from({ length: n }, (_, i) => i), 30).map((p) => p.length);
  assert.deepEqual(sizes(64), [32, 32]);
  assert.deepEqual(sizes(70), [35, 35]);
  assert.deepEqual(sizes(10), [10]);
  assert.equal(sizes(512).reduce((a, b) => a + b, 0), 512);
  assert.ok(Math.min(...sizes(512)) >= 20);
  assert.equal(shuffle([1, 2, 3, 4]).length, 4);
});

test("typed marks", () => {
  assert.deepEqual(parseMark("67", 100), { ok: true, value: 67 });
  assert.deepEqual(parseMark("67.5", 100), { ok: true, value: 67.5 });
  assert.equal(parseMark("101", 100).ok, false);
  assert.equal(parseMark("6.3", 100).ok, false);
  assert.equal(parseMark("", 100).ok, false);
  assert.deepEqual(compareEntries({ A: 10, B: 20 }, { A: 10, B: 21 }), ["B"]);
});

test("final marks: 15% rule and third valuation", () => {
  assert.deepEqual(finalMarks({ v1: 62 }), { status: "DONE", raw: 62, rule: "single" });
  assert.equal(finalMarks({ v1: 62, v2: 71 }).raw, 67); // gap 9 → average 66.5 → 67
  assert.equal(finalMarks({ v1: 40, v2: 56 }).status, "NEEDS_THIRD"); // gap 16 > 15
  assert.equal(finalMarks({ v1: 40, v2: 55 }).status, "DONE"); // gap 15 is allowed
  assert.equal(finalMarks({ v1: 40, v2: 60, v3: 57 }).raw, 59); // nearer = 60 → (57+60)/2 = 58.5 → 59
  assert.equal(finalMarks({ v1: 40, v2: 60, v3: 50 }).raw, 55); // equally near → higher (60)
});

test("reduce 100 → 50, rounded up", () => {
  assert.equal(reduce(67, 100, 50), 34);
  assert.equal(reduce(66, 100, 50), 33);
  assert.equal(reduce(39, 100, 50), 20); // 19.5 → 20
  assert.equal(reduce(80, 100, 100), 80);
  assert.equal(reduce(null, 100, 50), null);
});
