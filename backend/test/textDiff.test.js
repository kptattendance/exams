import test from "node:test";
import assert from "node:assert/strict";

import { linesOf, diffLines, changeRecord } from "../src/services/textDiff.js";

test("lines: blank lines dropped, spaces tidied", () => {
  assert.deepEqual(linesOf("Q1. Define  stress.\n\n  Q2. State Hooke's law \r\n"), ["Q1. Define stress.", "Q2. State Hooke's law"]);
});

test("diff marks removed and added lines and keeps the rest", () => {
  const d = diffLines(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"]);
  assert.deepEqual(
    d.map((x) => `${x.op[0]}${x.text}`),
    ["sa", "rb", "ax", "sc", "sd", "ae"]
  );
  assert.deepEqual(diffLines([], ["a"]), [{ op: "added", text: "a" }]);
  assert.deepEqual(diffLines(["a"], []), [{ op: "removed", text: "a" }]);
});

test("change record of a scrutinised paper", () => {
  const before = "PART A\nQ1. Define strain. (5 marks)\nQ2. State Ohm's law. (5 marks)\nPART B";
  const after = "PART A\nQ1. Define strain and stress. (5 marks)\nQ2. State Ohm's law. (5 marks)\nPART B\nQ9. Draw a neat sketch.";
  const r = changeRecord(before, after);
  assert.equal(r.removed, 1);
  assert.equal(r.added, 2);
  assert.deepEqual(r.changes[0], { op: "removed", text: "Q1. Define strain. (5 marks)", after: "PART A" });
  assert.deepEqual(r.changes[1], { op: "added", text: "Q1. Define strain and stress. (5 marks)", after: "PART A" });
  assert.equal(r.changes[2].after, "PART B");
  assert.deepEqual(changeRecord("same\ntext", "same\n\ntext").changes, []);
});
