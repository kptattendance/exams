import test from "node:test";
import assert from "node:assert/strict";

import { rejectionCheck } from "../src/services/exams/rejection.js";

const day = 864e5;
const published = new Date("2026-12-20T10:00:00Z");
const reg = (semester, group = "cs-3") => ({
  semester,
  group,
  result: {
    courses: [
      { code: "A", name: "Mathematics", semester, kind: "REGULAR" },
      { code: "P", name: "Mini Project", semester, kind: "REGULAR" },
      { code: "B", name: "Old subject", semester: semester - 1, kind: "BACKLOG" },
    ],
  },
});

test("within a week: this semester's courses rejected, project work and back papers kept", () => {
  const r = rejectionCheck(reg(3), [], { publishedAt: published, now: new Date(published.getTime() + 6 * day) });
  assert.equal(r.ok, true);
  assert.deepEqual(r.codes, ["A"]);
  assert.deepEqual(r.kept, ["P"]);
});

test("after a week: refused", () => {
  const r = rejectionCheck(reg(3), [], { publishedAt: published, now: new Date(published.getTime() + 8 * day) });
  assert.equal(r.ok, false);
});

test("once in the program for an odd and once for an even semester", () => {
  const now = new Date(published.getTime() + day);
  assert.equal(rejectionCheck(reg(3), [{ semester: 1 }], { publishedAt: published, now }).ok, false);
  assert.equal(rejectionCheck(reg(4), [{ semester: 1 }], { publishedAt: published, now }).ok, true);
});

test("back papers only: nothing to reject", () => {
  assert.equal(rejectionCheck(reg(3, "backlog"), [], { publishedAt: published, now: published }).ok, false);
});
