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
