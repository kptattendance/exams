import test from "node:test";
import assert from "node:assert/strict";

import { bySyllabus, currentSubjectsFor } from "../src/services/exams/rules.js";

const S = (code, sequence, extra = {}) => ({ _id: code, code, sequence, semester: 3, subjectCategory: "REGULAR", ...extra });

test("the elective keeps its place in the syllabus (not after the bridge course)", () => {
  const subjects = [
    S("A31", 1),
    S("E1", 2, { subjectCategory: "ELECTIVE", electiveGroup: "PE1" }),
    S("E2", 3, { subjectCategory: "ELECTIVE", electiveGroup: "PE1" }),
    S("A34", 4),
    S("B1", 5, { subjectCategory: "BRIDGE", forAdmissionTypes: ["lateral-iti"] }),
    S("AU", 6, { subjectCategory: "AUDIT" }),
  ];
  const { subjects: list } = currentSubjectsFor({ admissionType: "lateral-iti" }, subjects, { PE1: "E2" });
  assert.deepEqual(list.map((x) => x.subject.code), ["A31", "E2", "A34", "B1", "AU"]);
});

test("one order everywhere: this semester by syllabus, then back papers by semester", () => {
  const list = [
    { code: "B21", kind: "BACKLOG", semester: 2, sequence: "2CS01" },
    { code: "Z", kind: "BRIDGE", semester: 3, sequence: "3CS12" },
    { code: "E", kind: "ELECTIVE", semester: 3, sequence: "3CS04" },
    { code: "B11", kind: "BACKLOG", semester: 1, sequence: "1CS04" },
    { code: "A", kind: "REGULAR", semester: 3, sequence: "3CS01" },
  ];
  assert.deepEqual(bySyllabus(list).map((x) => x.code), ["A", "E", "Z", "B11", "B21"]);
});
