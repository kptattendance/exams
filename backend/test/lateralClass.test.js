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

test("exam fee per semester exam (DTE circular): 1-2 subjects 200, 3+ 300, marks card 50, late fee each", async () => {
  const { examFeeFor, lateFeeOn } = await import("../src/services/exams/rules.js");
  const lateFees = [
    { from: "2026-09-10", amount: 50 },
    { from: "2026-09-21", amount: 100 },
    { from: "2026-09-30", amount: 200 },
    { from: "2026-10-09", amount: 400 },
    { from: "2026-10-19", amount: 2000 },
  ];
  assert.equal(lateFeeOn(lateFees, "2026-09-09"), 0);
  assert.equal(lateFeeOn(lateFees, "2026-09-25"), 100);
  assert.equal(lateFeeOn(lateFees, "2026-10-20"), 2000);
  const sem3 = (code, status = "ELIGIBLE", extra = {}) => ({ code, semester: 3, kind: "REGULAR", status, ...extra });
  const subjects = [
    sem3("A"), sem3("B"), sem3("C"), sem3("D", "ANS"), sem3("E", "PENDING", { override: { status: "ELIGIBLE" } }),
    { code: "BR1", semester: 3, kind: "BRIDGE", status: "ELIGIBLE" },
    { code: "M1", semester: 1, kind: "BACKLOG", status: "ELIGIBLE" },
  ];
  // full semester only, paid in time: 300 + 50
  assert.equal(examFeeFor([sem3("A"), sem3("B"), sem3("C")], {}, "2026-09-01").total, 350);
  const f = examFeeFor(subjects, { lateFees }, "2026-09-15"); // late fee Rs 50 for each of the 3 exams
  assert.deepEqual(f.exams.map((e) => [e.label, e.count, e.total]), [["Sem 3", 4, 400], ["Sem 1", 1, 300], ["Bridge", 1, 300]]);
  assert.equal(f.total, 1000);
  assert.equal(examFeeFor([sem3("A", "NE")], {}, "2026-10-20").total, 0);
});
