import test from "node:test";
import assert from "node:assert/strict";

import { ML_MAX, parseEntry, assignSerials, fmtAts, newAtsBase, planDiaries, parseMark, compareEntries, finalMarks, reduce, shuffle } from "../src/services/exams/valuation.js";

test("ATS: random 6-digit room-diary number, never one already used", () => {
  const taken = new Set();
  for (let i = 0; i < 3000; i++) {
    const b = newAtsBase(taken);
    assert.match(b, /^[1-9]\d{5}$/);
    assert.ok(!taken.has(b));
    taken.add(b);
  }
  assert.equal(fmtAts("48271507"), "482715-07");
  assert.equal(shuffle([1, 2, 3, 4]).length, 4);
});

test("ATS serials: 01..n shuffled; students who stay keep theirs", () => {
  const regs = Array.from({ length: 25 }, (_, i) => `103CS25${String(i + 1).padStart(3, "0")}`);
  const s1 = assignSerials({}, regs);
  assert.deepEqual(Object.values(s1).sort(), Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, "0")));
  // shuffled: practically never 01, 02, 03 … in register-number order
  let inOrder = 0;
  for (let k = 0; k < 20; k++) if (Object.values(assignSerials({}, regs)).join() === Object.values(s1).sort().join()) inOrder++;
  assert.ok(inOrder < 2);
  // one leaves, one comes: the others keep their serial, the new one takes the free serial
  const leaving = regs[3];
  const next = [...regs.filter((r) => r !== leaving), "103CS25099"].sort();
  const s2 = assignSerials(s1, next);
  for (const r of next) if (r !== "103CS25099") assert.equal(s2[r], s1[r]);
  assert.equal(s2["103CS25099"], s1[leaving]);
  assert.throws(() => assignSerials({}, Array.from({ length: 100 }, (_, i) => `R${i}`)));
});

test("room diaries: one per paper per room, kept when nothing changes, marked when changed", () => {
  const papers = new Map([
    ["A1", ["MATH"]],
    ["A2", ["MATH"]],
    ["B1", ["ENG"]],
    ["B2", ["ENG"]],
  ]);
  let n = 0;
  const nextNumber = () => `P-${String(++n).padStart(4, "0")}`;
  const rooms = [
    { name: "Room 1", students: ["A1", "B1"] },
    { name: "Room 2", students: ["A2", "B2"] },
  ];
  const p1 = planDiaries({ rooms, papers, nextNumber });
  assert.equal(p1.length, 4); // Room 1 MATH, Room 1 ENG, Room 2 MATH, Room 2 ENG
  assert.equal(new Set(p1.map((d) => d.base)).size, 4);
  assert.equal(new Set(p1.map((d) => d.number)).size, 4);
  assert.ok(p1.every((d) => d.isNew && !d.changed));

  // saved again unchanged: same numbers, same ATS, nothing to reprint
  const p2 = planDiaries({ rooms, papers, old: p1, nextNumber });
  assert.deepEqual(p2.map((d) => [d.base, d.number, d.serials]), p1.map((d) => [d.base, d.number, d.serials]));
  assert.ok(p2.every((d) => !d.isNew && !d.changed));

  // A2 moves to Room 1: both MATH diaries change; Room 2 MATH is now empty (gone)
  const moved = [
    { name: "Room 1", students: ["A1", "A2", "B1"] },
    { name: "Room 2", students: ["B2"] },
  ];
  const p3 = planDiaries({ rooms: moved, papers, old: p1, nextNumber });
  const r1math = p3.find((d) => d.room === "Room 1" && d.code === "MATH");
  assert.ok(r1math.changed);
  assert.equal(r1math.serials.A1, p1.find((d) => d.room === "Room 1" && d.code === "MATH").serials.A1);
  assert.ok(!p3.some((d) => d.room === "Room 2" && d.code === "MATH"));
  assert.ok(!p3.find((d) => d.room === "Room 1" && d.code === "ENG").changed);
});

test("typed marks", () => {
  assert.deepEqual(parseMark("67", 100), { ok: true, value: 67 });
  assert.deepEqual(parseMark("67.5", 100), { ok: true, value: 67.5 });
  assert.equal(parseMark("101", 100).ok, false);
  assert.equal(parseMark("6.3", 100).ok, false);
  assert.equal(parseMark("", 100).ok, false);
  assert.deepEqual(compareEntries({ A: 10, B: 20 }, { A: 10, B: 21 }), ["B"]);
});

test("final marks: 15% rule and third valuation", () => {
  assert.deepEqual(finalMarks({ v1: 62 }), { status: "DONE", raw: 62, rule: "single" });
  assert.equal(finalMarks({ v1: 62, v2: 71 }).raw, 67); // gap 9 → average 66.5 → 67
  assert.equal(finalMarks({ v1: 40, v2: 56 }).status, "NEEDS_THIRD"); // gap 16 > 15
  assert.equal(finalMarks({ v1: 40, v2: 55 }).status, "DONE"); // gap 15 is allowed
  assert.equal(finalMarks({ v1: 40, v2: 60, v3: 57 }).raw, 59); // nearer = 60 → (57+60)/2 = 58.5 → 59
  assert.equal(finalMarks({ v1: 40, v2: 60, v3: 50 }).raw, 55); // equally near → higher (60)
});

test("reduce 100 → 50, rounded up", () => {
  assert.equal(reduce(67, 100, 50), 34);
  assert.equal(reduce(66, 100, 50), 33);
  assert.equal(reduce(39, 100, 50), 20); // 19.5 → 20
  assert.equal(reduce(80, 100, 100), 80);
  assert.equal(reduce(null, 100, 50), null);
});

test("one ATS holds 25 students in every room, also the 60-seat Room 114, split by desk", () => {
  let n = 0;
  const nextNumber = () => `P-${++n}`;
  const make = (count) => Array.from({ length: count }, (_, i) => `103CS26${String(i + 1).padStart(3, "0")}`);
  const papersOf = (regs) => new Map(regs.map((r) => [r, ["MATH"]]));
  const seatsOf = (regs) => Object.fromEntries(regs.map((r, i) => [r, regs.length - i])); // desks not in register order

  const r50 = make(50);
  const a = planDiaries({ rooms: [{ name: "220 (CS class room)", students: r50, seats: seatsOf(r50) }], papers: papersOf(r50), nextNumber });
  assert.deepEqual(a.map((d) => Object.keys(d.serials).length), [25, 25]);
  assert.deepEqual(a.map((d) => d.part), [1, 2]);
  assert.equal(new Set(a.map((d) => d.base)).size, 2);
  const s = seatsOf(r50);
  assert.ok(Object.keys(a[0].serials).every((r) => s[r] <= 25), "the first ATS is desks 1-25");

  const r60 = make(60);
  const b = planDiaries({ rooms: [{ name: "114 (ME 2nd year class room)", students: r60, seats: seatsOf(r60) }], papers: papersOf(r60), nextNumber });
  assert.deepEqual(b.map((d) => Object.keys(d.serials).length), [25, 25, 10]);

  const r61 = make(61);
  const c = planDiaries({ rooms: [{ name: "220", students: r61 }], papers: papersOf(r61), nextNumber });
  assert.deepEqual(c.map((d) => Object.keys(d.serials).length), [25, 25, 11]);

  // saved again: the same ATS numbers and serials, nothing to reprint
  const again = planDiaries({ rooms: [{ name: "220 (CS class room)", students: r50, seats: seatsOf(r50) }], papers: papersOf(r50), old: a, nextNumber });
  assert.deepEqual(again.map((d) => [d.base, d.number, d.serials]), a.map((d) => [d.base, d.number, d.serials]));
  assert.ok(again.every((d) => !d.isNew && !d.changed));
});

test("theory award list: at most 50, and AB in any case", () => {
  assert.equal(ML_MAX, 50);
  for (const t of ["ab", "AB", "aB", "Ab", " ab "]) assert.deepEqual(parseEntry(t, 50), { ok: true, value: "AB" });
  assert.deepEqual(parseEntry("50", 50), { ok: true, value: 50 });
  assert.deepEqual(parseEntry("0", 50), { ok: true, value: 0 });
  assert.deepEqual(parseEntry("32.5", 50), { ok: true, value: 32.5 });
  assert.equal(parseEntry("50.5", 50).ok, false);
  assert.equal(parseEntry("51", 50).ok, false);
  assert.equal(parseEntry("51", 100).ok, false, "an old maximum of 100 still stops at 50");
  assert.equal(parseEntry("A", 50).ok, false);
  assert.equal(parseEntry("", 50).ok, false);
  assert.equal(parseEntry("-1", 50).ok, false);
});
