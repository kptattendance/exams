// src/services/exams/seating.js
//
// Seat (desk) numbers of a written-exam session: one running number for the
// whole session, room after room in the rooms' own order, register-number order
// inside a room – Room 1: seats 1–25, Room 2: seats 26–50 … Nothing is stored:
// the numbers follow from the saved rooms (unit-tested in test/seating.test.js).

// rooms: [{ name, order, students: [registerNumber] }]
// -> { seatOf: Map(registerNumber -> { room, seat }), ranges: Map(room -> { from, to }) }
export function seatsOf(rooms = []) {
  const seatOf = new Map();
  const ranges = new Map();
  let n = 0;
  const ordered = [...rooms].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
  for (const r of ordered) {
    const list = [...(r.students || [])].sort();
    if (!list.length) continue;
    const from = n + 1;
    for (const reg of list) seatOf.set(reg, { room: r.name, seat: ++n });
    ranges.set(r.name, { from, to: n });
  }
  return { seatOf, ranges };
}
