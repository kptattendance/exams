import test from "node:test";
import assert from "node:assert/strict";

import { buildPapers, checkTimetable, suggestTimetable } from "../src/services/exams/timetable.js";

const sub = (code, semester, kind = "REGULAR", hasTheory = true) => ({ code, name: code + " name", semester, kind, hasTheory });
const regs = [
  // CS sem 3, with a sem-1 back paper
  { department: "cs", subjects: [sub("MATH1", 3, "BRIDGE"), sub("CS31", 3), sub("LAB", 3, "REGULAR", false), sub("CS11", 1, "BACKLOG")] },
  { department: "cs", subjects: [sub("CS31", 3)] },
  // EC sem 3 shares MATH1
  { department: "ec", subjects: [sub("MATH1", 3, "BRIDGE"), sub("EC31", 3)] },
  // CS sem 1
  { department: "cs", subjects: [sub("CS11", 1), sub("ENG1", 1)] },
];

test("papers: one per code, practical-only left out, common codes merged", () => {
  const { papers, studentCodes } = buildPapers(regs);
  const codes = papers.map((p) => p.code);
  assert.ok(!codes.includes("LAB"));
  const math = papers.find((p) => p.code === "MATH1");
  assert.deepEqual(math.departments, ["cs", "ec"]);
  assert.equal(math.candidates, 2);
  const cs11 = papers.find((p) => p.code === "CS11");
  assert.equal(cs11.candidates, 2);
  assert.equal(cs11.backlog, 1);
  assert.equal(studentCodes.length, 4);
});

test("clash: back paper in the same session as a current paper", () => {
  const { papers, studentCodes } = buildPapers(regs);
  const entries = [
    { code: "CS11", date: "2026-11-16", session: "FN" },
    { code: "ENG1", date: "2026-11-17", session: "FN" },
    { code: "CS31", date: "2026-11-16", session: "FN" },
    { code: "MATH1", date: "2026-11-16", session: "AN" },
  ];
  const r = checkTimetable(entries, papers, studentCodes);
  assert.equal(r.clashes.length, 1);
  assert.deepEqual(r.clashes[0].codes, ["CS11", "CS31"]);
  assert.equal(r.clashes[0].students, 1);
  assert.deepEqual(r.unscheduled, ["EC31"]);
  // MATH1 (AN) + CS31 (FN) on the same day for student 1 -> same-day warning
  assert.equal(r.sameDay.length, 1);
});

test("suggest: no student gets two papers on one day, Sundays skipped, kept entries stay", () => {
  const { papers, studentCodes } = buildPapers(regs);
  const keep = [{ code: "CS31", date: "2026-11-16", session: "AN" }];
  const { entries, unplaced } = suggestTimetable(papers, studentCodes, { startDate: "2026-11-14", holidays: ["2026-11-17"], keep });
  assert.equal(unplaced.length, 0);
  assert.equal(entries.length, papers.length);
  assert.deepEqual(entries.find((e) => e.code === "CS31"), keep[0]);
  assert.ok(!entries.some((e) => e.date === "2026-11-15")); // Sunday
  assert.ok(!entries.some((e) => e.date === "2026-11-17")); // holiday
  const r = checkTimetable(entries, papers, studentCodes);
  assert.equal(r.clashes.length, 0);
  assert.equal(r.sameDay.length, 0);
  assert.equal(entries.find((e) => e.code === "MATH1").session, "AN"); // 2nd year in the afternoon
});
