import test from "node:test";
import assert from "node:assert/strict";

import {
  batchLabel,
  practicalCandidates,
  splitEvenly,
  checkArrangement,
  parsePracticalMark,
  checkSheet,
  makeCode,
  newAccess,
  checkCode,
  sheetSummary,
  prune,
  boardDepartment,
  boardsOf,
  findClashes,
  MAX_CODE_TRIES,
} from "../src/services/exams/practical.js";

const sub = (o = {}) => ({ code: "LAB", kind: "REGULAR", hasPractical: true, status: "ELIGIBLE", ...o });
const reg = (n, subject, extra = {}) => ({ _id: `r${n}`, student: `s${n}`, registerNumber: `103CS2600${n}`, name: `S${n}`, regularFee: { paid: true }, subjects: [subject], ...extra });

test("candidates: eligible, fee paid, subject has a practical exam", () => {
  const regs = [
    reg(3, sub()),
    reg(1, sub()),
    reg(2, sub({ status: "ANS" })), // attendance shortage
    reg(4, sub({ status: "NE", override: { status: "ELIGIBLE" } })), // COE override wins
    reg(5, sub(), { regularFee: { paid: false } }), // fee not paid
    reg(6, sub({ hasPractical: false })),
    reg(7, sub({ kind: "BACKLOG", fee: { paid: true } }), { regularFee: { paid: false } }), // back paper paid separately
    reg(8, sub({ code: "OTHER" })),
  ];
  assert.deepEqual(practicalCandidates(regs, "LAB").map((c) => c.registration), ["r1", "r3", "r4", "r7"]);
});

test("batches: any size, split evenly", () => {
  const sizes = (n, k) => splitEvenly(Array.from({ length: n }, (_, i) => i), k).map((b) => b.length);
  assert.deepEqual(sizes(23, 1), [23]); // never a tiny extra batch
  assert.deepEqual(sizes(23, 2), [12, 11]);
  assert.deepEqual(sizes(63, 3), [21, 21, 21]);
  assert.deepEqual(sizes(2, 5), [1, 1]); // never an empty batch
  assert.deepEqual(sizes(5, 0), [5]);
  assert.deepEqual(splitEvenly([1, 2, 3, 4, 5], 2), [[1, 2, 3], [4, 5]]); // order kept
  assert.equal(batchLabel("25CS31P", 2), "25CS31P-B2");
});

test("arrangement: nobody twice, only permitted students, submitted batches untouched", () => {
  const permitted = new Set(["a", "b", "c", "d"]);
  assert.deepEqual(checkArrangement([{ number: 1, students: ["a", "b"] }, { number: 2, students: ["c"] }], permitted), { ok: true, errors: [], unassigned: ["d"] });
  assert.equal(checkArrangement([{ number: 1, students: ["a"] }, { number: 2, students: ["a"] }], permitted).ok, false);
  assert.equal(checkArrangement([{ number: 1, students: ["x"] }], permitted).ok, false);
  // batch 1 is submitted with "a": the payload for batch 1 is ignored, "a" can't move
  const locked = new Map([[1, ["a"]]]);
  assert.equal(checkArrangement([{ number: 1, students: [] }, { number: 2, students: ["b", "c", "d"] }], permitted, locked).ok, true);
  assert.equal(checkArrangement([{ number: 2, students: ["a", "b"] }], permitted, locked).ok, false);
});

test("practical marks are whole numbers up to the subject maximum", () => {
  assert.deepEqual(parsePracticalMark("42", 50), { ok: true, value: 42 });
  assert.deepEqual(parsePracticalMark(0, 50), { ok: true, value: 0 });
  assert.equal(parsePracticalMark("42.5", 50).ok, false);
  assert.equal(parsePracticalMark("51", 50).ok, false);
  assert.equal(parsePracticalMark("-1", 50).ok, false);
  assert.equal(parsePracticalMark("", 50).ok, false);
});

test("sheet: every student must be entered before submitting", () => {
  const students = [{ registerNumber: "A" }, { registerNumber: "B" }, { registerNumber: "C" }];
  const rows = { A: { attendance: "PRESENT", marks: "40" }, B: { attendance: "ABSENT", marks: "12" } };
  const draft = checkSheet(students, rows, 50, { complete: false });
  assert.equal(draft.ok, true);
  assert.deepEqual(draft.values, [
    { registerNumber: "A", attendance: "PRESENT", marks: 40 },
    { registerNumber: "B", attendance: "ABSENT", marks: null }, // an absentee never has marks
    { registerNumber: "C", attendance: null, marks: null },
  ]);
  const final = checkSheet(students, rows, 50);
  assert.deepEqual(final.errors, [{ registerNumber: "C", error: "not entered" }]);
  assert.equal(checkSheet(students, { ...rows, C: { attendance: "PRESENT", marks: "" } }, 50).ok, false);
  assert.equal(checkSheet(students, { ...rows, C: { attendance: "PRESENT", marks: "60" } }, 50).ok, false);
  const ok = checkSheet(students, { ...rows, C: { attendance: "MALPRACTICE" } }, 50);
  assert.equal(ok.ok, true);
  assert.deepEqual(sheetSummary(ok.values), { present: 1, absent: 1, malpractice: 1 });
});

test("external examiner's code: hashed, checked, locked after 5 wrong tries", () => {
  const code = makeCode();
  assert.match(code, /^\d{6}$/);
  const access = newAccess(code);
  assert.ok(!JSON.stringify(access).includes(code)); // the code itself is never stored
  assert.deepEqual(checkCode(access, code), { ok: true });
  assert.deepEqual(checkCode(access, ` ${code.slice(0, 3)} ${code.slice(3)} `), { ok: true }); // spaces ignored
  const wrong = code === "000000" ? "111111" : "000000";
  assert.deepEqual(checkCode(access, wrong), { ok: false, reason: "WRONG", left: MAX_CODE_TRIES - 1 });
  assert.equal(checkCode({ ...access, fails: MAX_CODE_TRIES }, code).reason, "LOCKED"); // even the right code
  assert.equal(checkCode({}, code).reason, "NONE");
});

test("a student who is no longer permitted leaves the batch automatically", () => {
  const students = [{ registration: "r1", registerNumber: "A", marks: 30 }, { registration: "r2", registerNumber: "B" }, { registration: "r3", registerNumber: "C" }];
  const regs = [reg(1, sub()), reg(2, sub({ status: "ANS" })), reg(3, sub(), { regularFee: { paid: false } })];
  const { keep, removed } = prune(students, regs, "LAB");
  assert.deepEqual(keep, [{ registration: "r1", registerNumber: "A", marks: 30 }]); // his draft marks stay
  assert.deepEqual(removed.map((s) => s.registerNumber), ["B", "C"]);
  assert.equal(prune(students, [], "LAB").keep.length, 0); // registration deleted
});

test("the board decides which HOD conducts the practical exam", () => {
  assert.equal(boardDepartment("CS"), "cs");
  assert.equal(boardDepartment("po"), "ps"); // Polymer board
  assert.equal(boardDepartment("EG"), "sc"); // English is with Science
  assert.equal(boardDepartment("KA"), "sc");
  assert.deepEqual(boardsOf("cs"), ["CS"]);
  assert.deepEqual(boardsOf("ps"), ["PO"]);
  assert.deepEqual(boardsOf("sc"), ["SC", "EG", "KA"]);
  assert.deepEqual(boardsOf(""), []);
});

test("students of every branch are candidates of a common subject", () => {
  const regs = [reg(1, sub(), { department: "cs" }), reg(2, sub({ kind: "BACKLOG", fee: { paid: true } }), { department: "ME" })];
  assert.deepEqual(practicalCandidates(regs, "LAB").map((c) => c.department), ["cs", "me"]);
});

test("timetable clashes stop the save", () => {
  const st = (...ids) => ids.map((id) => ({ id, registerNumber: id.toUpperCase() }));
  const b = (label, o = {}) => ({ label, date: "2026-11-20", session: "FN", lab: "", set: "", internal: "", external: "", students: [], ...o });
  const changed = new Set(["ENG-B1"]);
  // nothing in common, or a different session → fine
  assert.deepEqual(findClashes([b("ENG-B1", { students: st("a"), set: "p1", lab: "Lab 1" }), b("IT-B1", { students: st("b"), set: "p2", lab: "Lab 2" })], changed), []);
  assert.deepEqual(findClashes([b("ENG-B1", { students: st("a"), set: "p1" }), b("IT-B1", { students: st("a"), set: "p1", session: "AN" })], changed), []);
  // no date yet → never a clash
  assert.deepEqual(findClashes([b("ENG-B1", { date: "", students: st("a") }), b("IT-B1", { students: st("a") })], changed), []);
  // the same student in two practicals
  assert.match(findClashes([b("ENG-B1", { students: st("a", "b") }), b("IT-B1", { students: st("b") })], changed)[0], /B must attend both/);
  // the same examiner set, the same person in two sets, the same lab
  assert.match(findClashes([b("ENG-B1", { set: "p1" }), b("IT-B1", { set: "p1" })], changed)[0], /same examiner/);
  assert.match(findClashes([b("ENG-B1", { set: "p1", internal: "u1" }), b("IT-B1", { set: "p2", internal: "u1" })], changed)[0], /same examiner/);
  assert.match(findClashes([b("ENG-B1", { lab: "Lab 1" }), b("IT-B1", { lab: " lab 1 " })], changed)[0], /in Lab 1/);
  // a theory paper at the same time
  const written = new Map([["a", new Map([["2026-11-20|FN", "25SC11T"]])]]);
  assert.match(findClashes([b("ENG-B1", { students: st("a") })], changed, written)[0], /A writes the theory paper 25SC11T/);
  // batches that are not being saved are not checked against each other
  assert.deepEqual(findClashes([b("X-B1", { set: "p1" }), b("Y-B1", { set: "p1" })], changed), []);
  // two changed batches clash → reported once
  assert.equal(findClashes([b("ENG-B1", { set: "p1" }), b("ENG-B2", { set: "p1" })], new Set(["ENG-B1", "ENG-B2"])).length, 1);
});
