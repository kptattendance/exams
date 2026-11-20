// src/services/exams/seating.js
//
// Seating of a written-exam session (unit-tested in test/seating.test.js).
//
// A room has benches of 2 (capacity 50 = 25 benches). Desk numbers start at 1 in
// every room: bench k has seat k on the left and seat k + benches on the right
// (Room of 50: bench 1 = seats 1 and 26 … bench 25 = seats 25 and 50).
//
// Automatic arrangement – bench partners, best first:
//   1. different papers
//   2. the same (common) paper, different departments
//   3. the same paper and department – only when nothing else is left (flagged)

const deptOf = (c) => String(c.department || String(c.registerNumber || "").slice(3, 5)).toLowerCase();

// rooms: [{ name, capacity }], candidates: [{ registerNumber, code, department }]
// -> { rooms: [{ name, capacity, students: [reg], seats: { reg: seat } }], notAllotted: [reg],
//      benches: { differentPaper, differentDept, same } }
export function arrangeSeats(rooms, candidates) {
  // one queue per paper, in register-number order (so departments come in blocks)
  const queues = new Map();
  for (const c of [...candidates].sort((a, b) => String(a.registerNumber).localeCompare(String(b.registerNumber)))) {
    if (!queues.has(c.code)) queues.set(c.code, []);
    queues.get(c.code).push(c);
  }
  const left = () => [...queues.values()].reduce((n, q) => n + q.length, 0);
  const biggest = (except) =>
    [...queues.entries()].filter(([code, q]) => q.length && code !== except).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];

  // benches in the order they are filled: [a, b] (b may be null)
  const benches = [];
  const count = { differentPaper: 0, differentDept: 0, same: 0 };
  while (left()) {
    const [codeA, qa] = biggest();
    const a = qa.shift();
    const other = biggest(codeA);
    let b = null;
    if (other) {
      b = other[1].shift();
      count.differentPaper++;
    } else if (qa.length) {
      // only this paper is left: a partner from another department (from the far end)
      let i = -1;
      for (let k = qa.length - 1; k >= 0; k--) if (deptOf(qa[k]) !== deptOf(a)) {
        i = k;
        break;
      }
      if (i >= 0) {
        b = qa.splice(i, 1)[0];
        count.differentDept++;
      } else {
        b = qa.pop();
        count.same++;
      }
    }
    benches.push([a, b]);
  }

  // benches into the rooms, in the rooms' order
  const out = rooms.map((r) => ({ name: r.name, capacity: Number(r.capacity) || 50, students: [], seats: {} }));
  let bi = 0;
  for (const r of out) {
    const n = Math.floor(r.capacity / 2);
    for (let k = 1; k <= n && bi < benches.length; k++, bi++) {
      const [a, b] = benches[bi];
      r.students.push(a.registerNumber);
      r.seats[a.registerNumber] = k;
      if (b) {
        r.students.push(b.registerNumber);
        r.seats[b.registerNumber] = k + n;
      }
    }
    r.students.sort();
  }
  const notAllotted = benches.slice(bi).flatMap(([a, b]) => [a, b].filter(Boolean).map((x) => x.registerNumber));
  return { rooms: out, notAllotted, benches: count };
}

// The seats of one room: the saved ones, and the lowest free desk for anyone
// put in by hand. -> { reg: seat }
export function roomSeats(room) {
  const cap = Number(room.capacity) || 50;
  const given = room.seats instanceof Map ? Object.fromEntries(room.seats) : { ...(room.seats || {}) };
  const out = {};
  const used = new Set();
  for (const reg of [...(room.students || [])].sort()) {
    const s = Number(given[reg]);
    if (s >= 1 && s <= Math.max(cap, s) && !used.has(s)) {
      out[reg] = s;
      used.add(s);
    }
  }
  // the left side first, then the right side
  let next = 1;
  for (const reg of [...(room.students || [])].sort()) {
    if (out[reg]) continue;
    while (used.has(next)) next++;
    out[reg] = next;
    used.add(next);
  }
  return out;
}

// rooms: [{ name, order, capacity, students, seats }]
// -> { seatOf: Map(reg -> { room, seat }), ranges: Map(room -> { from, to }) }
export function seatsOf(rooms = []) {
  const seatOf = new Map();
  const ranges = new Map();
  for (const r of rooms) {
    const seats = roomSeats(r);
    const nums = Object.values(seats);
    if (!nums.length) continue;
    for (const [reg, seat] of Object.entries(seats)) seatOf.set(reg, { room: r.name, seat });
    ranges.set(r.name, { from: 1, to: Number(r.capacity) || 50 });
  }
  return { seatOf, ranges };
}

// bench partners writing the same paper AND from the same department (to flag)
// room: { capacity, students }, seats: { reg: seat }, info: Map(reg -> { code, department })
export function sameBenches(room, seats, info) {
  const n = Math.floor((Number(room.capacity) || 50) / 2);
  const at = new Map(Object.entries(seats).map(([reg, s]) => [s, reg]));
  const out = [];
  for (let k = 1; k <= n; k++) {
    const a = info.get(at.get(k));
    const b = info.get(at.get(k + n));
    if (a && b && a.code === b.code && deptOf(a) === deptOf(b)) out.push(k);
  }
  return out;
}
