import test from "node:test";
import assert from "node:assert/strict";

import { batchStartYear, batchesOfClass, classBatch, takesSubject } from "../src/services/exams/rules.js";

test("a lateral's 2-year batch belongs to the regulars' class", () => {
  assert.equal(classBatch("2026-2028"), "2025-2028");
  assert.equal(classBatch("2025-2028"), "2025-2028");
  assert.equal(classBatch(" 2026-2029 "), "2026-2029");
  assert.equal(classBatch(""), "");
  assert.deepEqual(batchesOfClass("2025-2028"), ["2025-2028", "2026-2028"]);
  assert.deepEqual(batchesOfClass("2026-2028"), ["2026-2028"]);
  assert.equal(batchStartYear({ batch: "2026-2028" }), 2025);
  assert.equal(batchStartYear({ batch: "2025-2028" }), 2025);
});

test("bridge courses only for the lateral types they are marked for", () => {
  const regular = { subjectCategory: "REGULAR" };
  const iti = { subjectCategory: "BRIDGE", forAdmissionTypes: ["lateral-iti", "lateral-iti-cross"] };
  const unset = { subjectCategory: "BRIDGE", forAdmissionTypes: [] };
  assert.equal(takesSubject({ admissionType: "regular" }, regular), true);
  assert.equal(takesSubject({ admissionType: "lateral-puc" }, regular), true);
  assert.equal(takesSubject({ admissionType: "regular" }, iti), false);
  assert.equal(takesSubject({ admissionType: "lateral-puc" }, iti), false);
  assert.equal(takesSubject({ admissionType: "lateral-iti" }, iti), true);
  assert.equal(takesSubject({ admissionType: "lateral-puc" }, unset), true);
  assert.equal(takesSubject({ admissionType: "regular" }, unset), false);
});

test("an Excel date cell keeps its calendar day on any server", async () => {
  const { parseDate } = await import("../src/services/studentImport/rules.js");
  // what the Excel library gives for 18-02-2008 on a server set to India time / to UTC
  assert.equal(parseDate(new Date("2008-02-17T18:29:50.000Z")).toISOString().slice(0, 10), new Date("2008-02-17T18:29:50.000Z").getTimezoneOffset() === -330 ? "2008-02-18" : "2008-02-17");
  assert.equal(parseDate(new Date(2008, 1, 18)).toISOString(), "2008-02-18T00:00:00.000Z");
  assert.equal(parseDate("18-02-2008").toISOString(), "2008-02-18T00:00:00.000Z");
  assert.equal(parseDate(39496).toISOString(), "2008-02-18T00:00:00.000Z");
});

test("a bridge course is decided by IA alone (no attendance)", async () => {
  const { eligibilityFor } = await import("../src/services/exams/rules.js");
  const subject = { iaMax: 50, iaMin: 20 };
  const ok = eligibilityFor(subject, { state: "confirmed", marks: 30, maxMarks: 50 }, { state: "not-required" });
  assert.equal(ok.status, "ELIGIBLE");
  const low = eligibilityFor(subject, { state: "confirmed", marks: 10, maxMarks: 50 }, { state: "not-required" });
  assert.equal(low.status, "NE");
});

test("exam fee: 350 per eligible subject, 200 per back paper, late fee by date", async () => {
  const { examFeeFor, lateFeeOn } = await import("../src/services/exams/rules.js");
  const subjects = [
    { kind: "REGULAR", status: "ELIGIBLE" },
    { kind: "BRIDGE", status: "ELIGIBLE" },
    { kind: "REGULAR", status: "ANS" }, // not permitted: not charged
    { kind: "REGULAR", status: "PENDING", override: { status: "ELIGIBLE" } }, // allowed by the COE
    { kind: "BACKLOG", status: "ELIGIBLE" },
  ];
  const lateFees = [{ from: "2026-11-15", amount: 500 }, { from: "2026-11-25", amount: 2000 }];
  assert.equal(lateFeeOn(lateFees, "2026-11-10"), 0);
  assert.equal(lateFeeOn(lateFees, "2026-11-15"), 500);
  assert.equal(lateFeeOn(lateFees, "2026-12-01"), 2000);
  const f = examFeeFor(subjects, { perSubject: 350, backPaper: 200, lateFees }, "2026-11-20");
  assert.deepEqual(f, { current: 3, backPapers: 1, currentFee: 1050, backPaperFee: 200, base: 1250, late: 500, total: 1750 });
  assert.equal(examFeeFor([{ kind: "REGULAR", status: "NE" }], { lateFees }, "2026-12-01").total, 0);
});
