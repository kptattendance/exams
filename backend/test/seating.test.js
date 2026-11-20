import test from "node:test";
import assert from "node:assert/strict";

import { arrangeSeats, roomSeats, sameBenches, seatsOf } from "../src/services/exams/seating.js";

const make = (dept, code, from, n) =>
  Array.from({ length: n }, (_, i) => ({ registerNumber: `103${dept}25${String(from + i).padStart(3, "0")}`, code, department: dept.toLowerCase() }));
const info = (list) => new Map(list.map((c) => [c.registerNumber, c]));

test("bench partners write different papers when they can", () => {
  const cands = [...make("CS", "MATHS", 1, 30), ...make("CS", "DB", 101, 30)];
  const r = arrangeSeats([{ name: "Room 1", capacity: 50 }, { name: "Room 2", capacity: 50 }], cands);
  assert.equal(r.notAllotted.length, 0);
  assert.equal(r.benches.differentPaper, 30);
  assert.equal(r.benches.same, 0);
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

test("nothing else left: same paper and department, flagged; extra students not allotted", () => {
  const cands = make("CS", "MATHS", 1, 56);
  const r = arrangeSeats([{ name: "Room 1", capacity: 50 }], cands);
  assert.equal(r.rooms[0].students.length, 50);
  assert.equal(r.notAllotted.length, 6);
  assert.equal(sameBenches(r.rooms[0], r.rooms[0].seats, info(cands)).length, 25);
});

test("seats: saved ones kept, hand-added students get the lowest free desk", () => {
  const room = { name: "R", capacity: 50, students: ["A", "B", "C"], seats: { A: 26, B: 1 } };
  assert.deepEqual(roomSeats(room), { A: 26, B: 1, C: 2 });
  const { seatOf, ranges } = seatsOf([room, { name: "Empty", students: [] }]);
  assert.deepEqual(seatOf.get("C"), { room: "R", seat: 2 });
  assert.deepEqual(ranges.get("R"), { from: 1, to: 50 });
  assert.equal(ranges.has("Empty"), false);
});
