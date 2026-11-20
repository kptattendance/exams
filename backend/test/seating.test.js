import test from "node:test";
import assert from "node:assert/strict";

import { seatsOf } from "../src/services/exams/seating.js";

test("seats run on from room to room, register-number order inside a room", () => {
  const regs = (from, n) => Array.from({ length: n }, (_, i) => `103CS25${String(from + i).padStart(3, "0")}`);
  const rooms = [
    { name: "Room 2", order: 1, students: regs(26, 25).reverse() },
    { name: "Room 1", order: 0, students: regs(1, 25) },
    { name: "Empty", order: 2, students: [] },
    { name: "Room 3", order: 3, students: regs(51, 3) },
  ];
  const { seatOf, ranges } = seatsOf(rooms);
  assert.deepEqual(seatOf.get("103CS25001"), { room: "Room 1", seat: 1 });
  assert.deepEqual(seatOf.get("103CS25025"), { room: "Room 1", seat: 25 });
  assert.deepEqual(seatOf.get("103CS25026"), { room: "Room 2", seat: 26 }); // sorted inside the room
  assert.deepEqual(seatOf.get("103CS25053"), { room: "Room 3", seat: 53 });
  assert.deepEqual(ranges.get("Room 2"), { from: 26, to: 50 });
  assert.equal(ranges.has("Empty"), false);
});
