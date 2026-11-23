import test from "node:test";
import assert from "node:assert/strict";

import { DEFAULT_ROOMS, arrangeSeats, benchRows, roomSeats, sameBenches, seatsOf } from "../src/services/exams/seating.js";

const make = (dept, code, from, n) =>
  Array.from({ length: n }, (_, i) => ({ registerNumber: `103${dept}25${String(from + i).padStart(3, "0")}`, code, department: dept.toLowerCase() }));
const info = (list) => new Map(list.map((c) => [c.registerNumber, c]));

test("bench partners write different papers when they can", () => {
  const cands = [...make("CS", "MATHS", 1, 30), ...make("CS", "DB", 101, 30)];
  const r = arrangeSeats([{ name: "Room 1", capacity: 50 }, { name: "Room 2", capacity: 50 }], cands);
  assert.equal(r.notAllotted.length, 0);
  assert.equal(r.benches.differentPaper, 25);
  assert.equal(r.benches.same, 0);
  // the 10 left over sit alone in room 2 rather than beside the same paper and branch
  assert.deepEqual(sameBenches(r.rooms[1], r.rooms[1].seats, info(cands)), []);
  const room1 = r.rooms[0];
  assert.equal(room1.students.length, 50);
  // bench 1 = seats 1 and 26, different papers
  const at = new Map(Object.entries(room1.seats).map(([reg, s]) => [s, reg]));
  const m = info(cands);
  assert.notEqual(m.get(at.get(1)).code, m.get(at.get(26)).code);
  assert.deepEqual(sameBenches(room1, room1.seats, m), []);
});

test("a common paper only: partners from different departments", () => {
  const cands = [...make("CS", "MATHS", 1, 25), ...make("EE", "MATHS", 1, 25)];
  const r = arrangeSeats([{ name: "Room 1", capacity: 50 }], cands);
  assert.equal(r.benches.differentDept, 25);
  assert.equal(r.benches.same, 0);
  assert.deepEqual(sameBenches(r.rooms[0], r.rooms[0].seats, info(cands)), []);
});

test("no other choice: same paper and branch side by side (flagged), a 3rd student on a bench – nobody left out", () => {
  const cands = make("CS", "MATHS", 1, 56);
  const r = arrangeSeats([{ name: "Room 1", capacity: 50 }], cands);
  assert.equal(r.rooms[0].students.length, 56);
  assert.equal(r.notAllotted.length, 0);
  assert.equal(r.third, 6);
  assert.equal(r.rooms[0].perBench, 3);
  assert.equal(sameBenches(r.rooms[0], r.rooms[0].seats, info(cands)).length, 25);
});

test("more students than 560 desks: a 3rd student (another paper) on the benches of the first rooms", () => {
  const papers = ["AT1", "CH1", "CS1", "EE1", "ME1", "CE1"];
  const cands = papers.flatMap((p, i) => make(p.slice(0, 2), p, i * 100 + 1, 100)); // 600
  const r = arrangeSeats(DEFAULT_ROOMS, cands);
  assert.equal(r.notAllotted.length, 0);
  assert.equal(r.rooms.length, 11);
  assert.equal(r.third, 40);
  const m = info(cands);
  for (const x of r.rooms) assert.deepEqual(sameBenches(x, x.seats, m), [], x.name);
  // a middle desk is 51–75, only in the first rooms
  assert.ok(Object.values(r.rooms[0].seats).some((d) => d > 50));
  assert.ok(!Object.values(r.rooms[10].seats).some((d) => d > 50));
});

test("seats: saved ones kept, hand-added students get the lowest free desk", () => {
  const room = { name: "R", capacity: 50, students: ["A", "B", "C"], seats: { A: 26, B: 1 } };
  assert.deepEqual(roomSeats(room), { A: 26, B: 1, C: 2 });
  const { seatOf, ranges } = seatsOf([room, { name: "Empty", students: [] }]);
  assert.deepEqual(seatOf.get("C"), { room: "R", seat: 2 });
  assert.deepEqual(ranges.get("R"), { from: 1, to: 26 });
  assert.equal(ranges.has("Empty"), false);
});

test("one paper on the left desks, another on the right; rooms in preference order, only as many as needed", () => {
  const cands = [...make("CS", "MATHS", 1, 40), ...make("ME", "DRAW", 1, 30)];
  const r = arrangeSeats(DEFAULT_ROOMS, cands);
  assert.equal(r.rooms.length, 2); // 70 students: 220 and 117 only
  assert.equal(r.rooms[0].name, DEFAULT_ROOMS[0].name);
  const m = info(cands);
  const room = r.rooms[0];
  const at = new Map(Object.entries(room.seats).map(([reg, s]) => [s, reg]));
  const leftPapers = new Set([...Array(25)].map((_, i) => m.get(at.get(i + 1))?.code));
  const rightPapers = new Set([...Array(25)].map((_, i) => m.get(at.get(i + 26))?.code));
  assert.deepEqual([...leftPapers], ["MATHS"]);
  assert.deepEqual([...rightPapers], ["DRAW"]);
  for (const x of r.rooms) assert.deepEqual(sameBenches(x, x.seats, m), []);
  assert.equal(r.notAllotted.length, 0);
});

test("3 rows of benches: 9, 7, 9", () => {
  assert.deepEqual(benchRows(50), [9, 7, 9]);
  assert.equal(benchRows(40).reduce((a, b) => a + b, 0), 20);
  assert.equal(DEFAULT_ROOMS.length, 11);
});

test("Room 114 alone holds 60: 3 rows of 10 benches, 30 students of a paper on one side", () => {
  const r114 = DEFAULT_ROOMS.find((r) => r.name.startsWith("114"));
  assert.equal(r114.capacity, 60);
  assert.deepEqual(benchRows(60), [10, 10, 10]);
  assert.equal(DEFAULT_ROOMS.filter((r) => r.capacity !== 50).length, 1);
  const cands = [
    ...Array.from({ length: 30 }, (_, i) => ({ registerNumber: `103CS26${String(i + 1).padStart(3, "0")}`, code: "P1", department: "cs" })),
    ...Array.from({ length: 30 }, (_, i) => ({ registerNumber: `103ME26${String(i + 1).padStart(3, "0")}`, code: "P2", department: "me" })),
  ];
  const out = arrangeSeats([r114], cands);
  assert.equal(out.rooms[0].students.length, 60);
  const code = new Map(cands.map((c) => [c.registerNumber, c.code]));
  const left = Object.entries(out.rooms[0].seats).filter(([, d]) => d <= 30).map(([reg]) => code.get(reg));
  assert.equal(left.length, 30);
  assert.equal(new Set(left).size, 1);
});
