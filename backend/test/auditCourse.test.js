import test from "node:test";
import assert from "node:assert/strict";

import { currentSubjectsFor, examFeeFor } from "../src/services/exams/rules.js";
import { ticketFor } from "../src/services/exams/hallTicket.js";
import { courseResult } from "../src/services/exams/results.js";

const audit = { _id: "au1", code: "25CS36A", subjectCategory: "AUDIT", iaMax: 50, iaMin: 20, theoryExamMax: 0, practicalExamMax: 0, totalMax: 50 };

test("an audit course is registered for every student of the class", () => {
  const { subjects } = currentSubjectsFor({ admissionType: "regular" }, [{ _id: "r1", code: "25CS31T" }, audit]);
  assert.deepEqual(subjects.map((s) => s.kind), ["REGULAR", "AUDIT"]);
});

test("an audit course carries no exam fee", () => {
  const sem3 = (code) => ({ code, semester: 3, kind: "REGULAR" });
  const f = examFeeFor([sem3("A"), sem3("B"), sem3("C"), { code: "25CS36A", semester: 3, kind: "AUDIT" }], {}, "2026-09-01");
  assert.equal(f.subjects, 3);
  assert.equal(f.total, 350);
});

test("an audit course is on the hall ticket, struck out – no semester-end exam", () => {
  const reg = {
    overall: "ALL_CLEAR",
    regularFee: { paid: true },
    subjects: [
      { code: "25CS31T", kind: "REGULAR", hasTheory: true, status: "ELIGIBLE" },
      { code: "25CS36A", kind: "AUDIT", hasTheory: false, status: "PENDING" },
    ],
  };
  const t = ticketFor(reg, { entries: [{ code: "25CS31T", date: "2026-11-20", session: "FN" }], published: true });
  assert.deepEqual(t.subjects.map((s) => s.code), ["25CS31T", "25CS36A"]); // audit last
  const audit = t.subjects[1];
  assert.equal(audit.audit, true);
  assert.equal(audit.permitted, false);
  assert.match(audit.note, /no semester-end exam/i);
  // it never stops the hall ticket and is not counted as permitted
  assert.equal(t.ready, true);
  assert.equal(t.permittedCount, 1);
});

test("an audit course is decided by the internal test alone", () => {
  assert.equal(courseResult(audit, { cie: 30 }).status, "PASS");
  assert.equal(courseResult(audit, { cie: 30 }).max, 50);
  assert.equal(courseResult(audit, { cie: 12 }).status, "FAIL");
  assert.equal(courseResult(audit, { eligibility: "NE" }).status, "NE");
});
