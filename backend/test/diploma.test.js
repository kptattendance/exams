import test from "node:test";
import assert from "node:assert/strict";

import { classOf, diplomaCheck, rankList } from "../src/services/exams/diploma.js";

// a lateral (92 credits): sem 3–6, one course per semester carrying 23 credits
const lateral = { admissionType: "lateral-iti", batch: "2026-2028" };
const course = (sem, gp, opts = {}) => ({
  subject: `S${sem}${opts.id || ""}`,
  code: `C${sem}${opts.id || ""}`,
  name: opts.name || `Course ${sem}`,
  semester: sem,
  category: opts.category || "REGULAR",
  status: opts.status || "PASS",
  gradePoint: gp,
  credit: opts.credit ?? 23,
  declaredAt: opts.at || `${sem <= 4 ? 2027 : 2028}-0${sem % 2 ? 1 : 6}-15`,
  rejected: opts.rejected || false,
});
const allPass = (gp) => [course(3, gp), course(4, gp), course(5, gp), course(6, gp, { name: "Industrial Internship" })];

test("class (KPT 12.2)", () => {
  assert.equal(classOf(7.75, true), "FIRST_CLASS_DISTINCTION");
  assert.equal(classOf(7.75, false), "FIRST_CLASS"); // 12.3 not met
  assert.equal(classOf(6.75, true), "FIRST_CLASS");
  assert.equal(classOf(5.75, true), "SECOND_CLASS");
  assert.equal(classOf(5.74, true), "PASS_CLASS");
});

test("eligible lateral with 92 credits, distinction and rank", () => {
  const r = diplomaCheck(allPass(9), lateral, {});
  assert.equal(r.eligible, true);
  assert.equal(r.earned, 92);
  assert.equal(r.class, "FIRST_CLASS_DISTINCTION");
  assert.equal(r.rankEligible, true);
});

test("not eligible: a course not passed / no internship / CGPA below 4", () => {
  const failed = allPass(8);
  failed[1] = course(4, 0, { status: "FAIL" });
  assert.equal(diplomaCheck(failed, lateral).eligible, false);
  const noIntern = [course(3, 8), course(4, 8), course(5, 8), course(6, 8)];
  assert.match(diplomaCheck(noIntern, lateral).reasons.join(), /internship/i);
  assert.equal(diplomaCheck(allPass(3), lateral).eligible, false);
});

test("a second attempt: First Class only, no rank (KPT 12.3, 14.8)", () => {
  const list = [...allPass(9), course(4, 0, { status: "FAIL", at: "2027-01-10" })];
  const r = diplomaCheck(list, lateral, {});
  assert.equal(r.eligible, true);
  assert.equal(r.class, "FIRST_CLASS");
  assert.equal(r.rankEligible, false);
});

test("malpractice history: no distinction, no rank", () => {
  const r = diplomaCheck(allPass(9), lateral, { malpractice: true });
  assert.equal(r.class, "FIRST_CLASS");
  assert.equal(r.rankEligible, false);
});

test("ranks: CGPA order, equal CGPAs share a rank when the tie-break is equal, below 8 not ranked", () => {
  const a = { ...diplomaCheck(allPass(10), lateral), id: "a" };
  const b = { ...diplomaCheck(allPass(9), lateral), id: "b" };
  const c = { ...diplomaCheck(allPass(9), lateral), id: "c" };
  const d = { ...diplomaCheck(allPass(7), lateral), id: "d" };
  rankList([a, b, c, d]);
  assert.deepEqual([a.rank, b.rank, c.rank, d.rank], [1, 2, 2, undefined]);
});
