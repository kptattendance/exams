import test from "node:test";
import assert from "node:assert/strict";

import { cellOf, examDate, mapOldColumns, oldRowResult, sdCodeOf } from "../src/services/exams/oldResults.js";

const theory = { iaMax: 50, theoryExamMax: 50, practicalExamMax: 0, totalMax: 100, credit: 6, semester: 1 };
const practical = { iaMax: 50, theoryExamMax: 0, practicalExamMax: 50, totalMax: 100, credit: 5, semester: 1 };
const iaOnly = { iaMax: 50, theoryExamMax: 0, practicalExamMax: 0, totalMax: 50, credit: 2, semester: 1 };

test("old column headers are found", () => {
  const m = mapOldColumns(["RSLTS_ExamID_EXMLS", "RSLTS_RegNo_STUDS", "RSLTS_SubID_SUBJS", "RSLTS_IAMarks_03HVC", "RSLTS_TrExMarks_03HVC", "RSLTS_PrExMarks_03HVC", "RSLTS_TrExGrMarks_02HIN", "RSLTS_ResultStatus_01HCH", "RSLTS_SubGradeID_03HCH"]);
  assert.equal(m.theory, "RSLTS_TrExMarks_03HVC");
  assert.equal(m.regNo, "RSLTS_RegNo_STUDS");
  assert.equal(m.gradeId, "RSLTS_SubGradeID_03HCH");
});

test("cells, exam codes and scheme codes", () => {
  assert.deepEqual(cellOf("--"), { none: true });
  assert.deepEqual(cellOf(" 24 "), { n: 24 });
  assert.deepEqual(cellOf("ab"), { code: "AB" });
  assert.ok(examDate("25S") < examDate("26A"));
  assert.equal(examDate("26X"), null);
  assert.deepEqual(sdCodeOf("ME25-1M1"), { department: "ME", semester: 1 });
});

test("passed theory subject (with grace already in the theory marks)", () => {
  const r = oldRowResult({ ia: "34", theory: "20", practical: "--", status: "P", gradeId: "E06" }, theory);
  assert.equal(r.result.status, "PASS");
  assert.equal(r.result.grade, "C+");
  assert.equal(r.result.gradePoint, 6);
  assert.equal(r.result.total, 54);
  assert.equal(r.result.marksText, "34/20/--");
  assert.deepEqual(r.warnings, []);
});

test("IA-only subject uses the 50-mark table", () => {
  const r = oldRowResult({ ia: "25", theory: "--", practical: "--", status: "P", gradeId: "I05" }, iaOnly);
  assert.equal(r.result.grade, "C");
  assert.deepEqual(r.warnings, []);
});

test("failed, absent, not eligible, malpractice, not registered", () => {
  assert.equal(oldRowResult({ ia: "24", theory: "12", practical: "--", status: "F" }, theory).result.status, "FAIL");
  assert.equal(oldRowResult({ ia: "24", theory: "--", practical: "AB", status: "F" }, practical).result.status, "ABSENT");
  assert.equal(oldRowResult({ ia: "7", theory: "NE", practical: "--", status: "F" }, theory).result.status, "NE");
  assert.equal(oldRowResult({ ia: "32", theory: "MP", practical: "--", status: "F" }, theory).result.status, "WITHHELD");
  assert.ok(oldRowResult({ ia: "0", theory: "0", practical: "0", status: "X" }, theory).skip);
  assert.ok(oldRowResult({ ia: "1", theory: "1", practical: "--", status: "Q" }, theory).error);
});

test("a grade that does not match the marks is kept but warned about", () => {
  const r = oldRowResult({ ia: "40", theory: "40", practical: "--", status: "P", gradeId: "E06" }, theory);
  assert.equal(r.result.grade, "C+");
  assert.equal(r.warnings.length, 1);
});
