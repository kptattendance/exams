import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAdmissionTypes,
  pickScheme,
  currentSubjectsFor,
  backlogsFrom,
  backPaperAllowed,
  eligibilityFor,
  backlogEligibility,
  summarize,
  mergeSubjects,
  batchStartYear,
} from "../src/services/exams/rules.js";

const sub = (o) => ({ _id: o.code, code: o.code, subjectCategory: "REGULAR", iaMax: 50, iaMin: 20, theoryExamMax: 50, schemeYear: 2025, ...o });
const confirmed = (extra) => ({ state: "confirmed", ...extra });

test("admission types accept short names", () => {
  assert.deepEqual(normalizeAdmissionTypes("PUC; iti-cross"), ["lateral-puc", "lateral-iti-cross"]);
  assert.deepEqual(normalizeAdmissionTypes(["lateral-iti"]), ["lateral-iti"]);
  assert.deepEqual(normalizeAdmissionTypes("all"), ["lateral-puc", "lateral-iti", "lateral-iti-cross"]);
  assert.deepEqual(normalizeAdmissionTypes(""), []);
  assert.throws(() => normalizeAdmissionTypes("diploma"));
});

test("batch start year", () => {
  assert.equal(batchStartYear({ batch: "2026-2029" }), 2026);
  assert.equal(batchStartYear({ admissionYear: 2027, admissionType: "lateral-puc" }), 2026);
});

test("scheme: newest scheme started on or before the batch", () => {
  const list = [sub({ code: "A", schemeYear: 2021 }), sub({ code: "B", schemeYear: 2025 })];
  assert.deepEqual(pickScheme(list, 2024).map((s) => s.code), ["A"]);
  assert.deepEqual(pickScheme(list, 2026).map((s) => s.code), ["B"]);
  assert.deepEqual(pickScheme(list, 2019).map((s) => s.code), ["A"]);
});

test("bridge courses go only to the matching lateral type", () => {
  const subjects = [
    sub({ code: "R1" }),
    sub({ code: "BPUC", subjectCategory: "BRIDGE", forAdmissionTypes: ["lateral-puc"] }),
    sub({ code: "BITI", subjectCategory: "BRIDGE", forAdmissionTypes: ["lateral-iti", "lateral-iti-cross"] }),
  ];
  const codes = (t) => currentSubjectsFor({ admissionType: t }, subjects).subjects.map((x) => x.subject.code);
  assert.deepEqual(codes("regular"), ["R1"]);
  assert.deepEqual(codes("lateral-puc"), ["R1", "BPUC"]);
  assert.deepEqual(codes("lateral-iti-cross"), ["R1", "BITI"]);
});

test("unmapped bridge course goes to all laterals with a warning", () => {
  const r = currentSubjectsFor({ admissionType: "lateral-iti" }, [sub({ code: "B", subjectCategory: "BRIDGE" })]);
  assert.equal(r.subjects.length, 1);
  assert.match(r.warnings[0], /not set/);
});

test("electives: only the chosen one, warning when missing", () => {
  const subjects = [
    sub({ _id: "e1", code: "E1", subjectCategory: "ELECTIVE", electiveGroup: "G1" }),
    sub({ _id: "e2", code: "E2", subjectCategory: "ELECTIVE", electiveGroup: "G1" }),
    sub({ _id: "e3", code: "E3", subjectCategory: "ELECTIVE", electiveGroup: "G2" }),
  ];
  const r = currentSubjectsFor({ admissionType: "regular" }, subjects, { G1: "e2" });
  assert.deepEqual(r.subjects.map((x) => x.subject.code), ["E2"]);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /G2/);
});

test("back papers: latest attempt that is not a pass", () => {
  const res = [
    { subject: "s1", status: "FAIL", declaredAt: "2026-01-01" },
    { subject: "s1", status: "PASS", declaredAt: "2026-07-01" },
    { subject: "s2", status: "FAIL", declaredAt: "2026-07-01" },
  ];
  assert.deepEqual(backlogsFrom(res).map((r) => r.subject), ["s2"]);
  assert.equal(backPaperAllowed("SAME_PARITY", [1, 3, 5], 2), false);
  assert.equal(backPaperAllowed("SAME_PARITY", [1, 3, 5], 1), true);
  assert.equal(backPaperAllowed("ALL", [1], 2), true);
  assert.equal(backlogEligibility("FAIL").status, "ELIGIBLE");
  assert.equal(backlogEligibility("NE").status, "PENDING");
});

test("eligibility: attendance below 75% is ANS", () => {
  const r = eligibilityFor(sub({}), confirmed({ marks: 30, maxMarks: 50 }), confirmed({ attended: 37, maxClasses: 50 }));
  assert.equal(r.status, "ANS");
  assert.equal(r.attendancePct, 74);
});

test("eligibility: exactly 75% is allowed, IA below minimum is NE", () => {
  const ok = eligibilityFor(sub({}), confirmed({ marks: 20, maxMarks: 50 }), confirmed({ attended: 30, maxClasses: 40 }));
  assert.equal(ok.status, "ELIGIBLE");
  const ne = eligibilityFor(sub({}), confirmed({ marks: 19, maxMarks: 50 }), confirmed({ attended: 40, maxClasses: 40 }));
  assert.equal(ne.status, "NE");
});

test("eligibility: IA entered out of a different maximum is scaled", () => {
  // 10/25 = 20/50 -> exactly the minimum
  const r = eligibilityFor(sub({}), confirmed({ marks: 10, maxMarks: 25 }), confirmed({ attended: 40, maxClasses: 40 }));
  assert.equal(r.status, "ELIGIBLE");
});

test("eligibility: not frozen yet is PENDING, but a shortage still shows", () => {
  const p = eligibilityFor(sub({}), { state: "submitted", marks: 30 }, confirmed({ attended: 40, maxClasses: 40 }));
  assert.equal(p.status, "PENDING");
  assert.match(p.reasons[0], /Exam Officer/);
  const a = eligibilityFor(sub({}), { state: "missing" }, confirmed({ attended: 10, maxClasses: 40 }));
  assert.equal(a.status, "ANS");
});

test("summary and overall", () => {
  const s = summarize([{ status: "ELIGIBLE" }, { status: "ANS", override: { status: "ELIGIBLE" } }]);
  assert.equal(s.overall, "ALL_CLEAR");
  assert.equal(summarize([{ status: "ELIGIBLE" }, { status: "NE" }]).overall, "PARTIAL");
  assert.equal(summarize([{ status: "NE" }]).overall, "BLOCKED");
  assert.equal(summarize([{ status: "ELIGIBLE" }, { status: "PENDING" }]).overall, "PENDING");
  // elective not chosen yet -> not final
  assert.equal(summarize([{ status: "ELIGIBLE" }], { incomplete: true }).overall, "PENDING");
});

test("refresh keeps overrides, fee ticks and manual subjects", () => {
  const existing = [
    { subject: "a", status: "ANS", override: { status: "ELIGIBLE", reason: "Medical" }, source: "AUTO" },
    { subject: "m", status: "ELIGIBLE", source: "MANUAL", kind: "BACKLOG" },
    { subject: "gone", status: "ELIGIBLE", source: "AUTO" },
  ];
  const fresh = [{ subject: "a", status: "ANS", source: "AUTO" }];
  const merged = mergeSubjects(fresh, existing);
  assert.deepEqual(merged.map((s) => s.subject), ["a", "m"]);
  assert.equal(merged[0].effective, "ELIGIBLE");
});

import { feeItems, feeSummary, subjectFeePaid, parsePays } from "../src/services/exams/rules.js";

test("fees: regular block + one item per back paper", () => {
  const reg = {
    regularFee: { paid: true, receiptNo: "4521" },
    subjects: [
      { subject: "r1", code: "R1", kind: "REGULAR" },
      { subject: "e1", code: "E1", kind: "ELECTIVE" },
      { subject: "b1", code: "B1", kind: "BACKLOG", fee: { paid: false } },
    ],
  };
  assert.deepEqual(feeItems(reg).map((i) => i.key), ["REGULAR", "b1"]);
  assert.deepEqual(feeSummary(reg), { status: "PARTIAL", total: 2, paid: 1 });
  assert.equal(subjectFeePaid(reg, reg.subjects[0]), true);
  assert.equal(subjectFeePaid(reg, reg.subjects[2]), false);
  // back-paper-only student has no regular fee
  assert.deepEqual(feeSummary({ subjects: [{ subject: "b", kind: "BACKLOG", fee: { paid: true } }] }), { status: "PAID", total: 1, paid: 1 });
  assert.equal(feeSummary({ subjects: [] }).status, "NONE");
});

test("fees: office Excel 'pays' column", () => {
  assert.deepEqual(parsePays(""), { all: true, regular: true, codes: [] });
  assert.deepEqual(parsePays("regular"), { all: false, regular: true, codes: [] });
  assert.deepEqual(parsePays("25sc11t0, Regular"), { all: false, regular: true, codes: ["25SC11T0"] });
});
