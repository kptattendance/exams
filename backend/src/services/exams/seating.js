// src/services/exams/seating.js
//
// Seating of a written-exam session (unit-tested in test/seating.test.js).
//
// A room has 25 benches in 3 rows (9, 7, 9 benches); Room 114 alone has 30 (10, 10,
// 10), so its desks below run to 30 / 60 / 90. Desk numbers start at 1 in
// every room:
//   left desks    1–25 : row 1 = 1–9 (front to back), row 2 = 10–16, row 3 = 17–25
//   right desks  26–50 : the bench partners – desk k + 25 sits beside desk k
//   middle desks 51–75 : only when the rooms are not enough – a third student on
//                        the bench (desk k + 50), so nobody is left without a seat
// Automatic arrangement, room after room in the preference order:
//   – one paper fills the left desks, ANOTHER paper the right desks (and a third
//     paper the middle ones), so students on a bench never write the same paper;
//     students of the same paper sit one behind another
//   – when only a common paper is left, bench partners are of different branches;
//     the same paper and branch only when nothing else is left (flagged)

// The rooms in the order they are filled
export const DEFAULT_ROOMS = [
  "220 (CS class room)",
  "117 (ME 1st year class room)",
  "114 (ME 2nd year class room)",
  "113 (Civil 1st year class room)",
  "105 (AT 2nd year class room)",
  "101 (EC 2nd year class room)",
  "AT Lab",
  "Chemical Lab (Chemical Block)",
  "EE1 (Electrical Block class room 1)",
  "EE2 (Electrical Block class room 2)",
  "Civil MT Lab",
].map((name) => ({ name, capacity: name.startsWith("114") ? 60 : 50 })); // Room 114 alone: 3 rows of 10 benches

const deptOf = (c) => String(c.department || String(c.registerNumber || "").slice(3, 5)).toLowerCase();

// The benches of a room in 3 rows: 25 -> [9, 7, 9]
export function benchRows(capacity = 50) {
  const benches = Math.floor((Number(capacity) || 50) / 2);
  if (benches === 25) return [9, 7, 9];
  if (benches < 3) return [benches];
  const side = Math.ceil(benches / 3);
  const middle = benches - 2 * side;
  return middle > 0 ? [side, middle, side] : [Math.ceil(benches / 2), Math.floor(benches / 2)];
}

// rooms: [{ name, capacity }] in preference order (capacity = 2 per bench, e.g. 50),
// candidates: [{ registerNumber, code, department }]
// -> { rooms: [{ name, capacity, perBench, students, seats: { reg: desk } }] (the rooms used),
//      notAllotted: [reg] (only when even 3 a bench is not enough),
//      benches: { differentPaper, differentDept, same }, third: students on a middle desk }
export function arrangeSeats(rooms, candidates) {
  const queues = new Map(); // paper -> students in register-number order (branches in blocks)
  for (const c of [...candidates].sort((a, b) => String(a.registerNumber).localeCompare(String(b.registerNumber)))) {
    if (!queues.has(c.code)) queues.set(c.code, []);
    queues.get(c.code).push(c);
  }
  const left = () => [...queues.values()].reduce((n, q) => n + q.length, 0);
  const biggest = (except = []) =>
    [...queues.entries()].filter(([code, q]) => q.length && !except.includes(code)).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0]?.[0];
  // a student of one of these papers but of another branch than those on the bench
  const otherBranch = (bench) => {
    const depts = bench.map(deptOf);
    for (const code of [...new Set(bench.map((c) => c.code))]) {
      const q = queues.get(code) || [];
      for (let x = q.length - 1; x >= 0; x--) if (!depts.includes(deptOf(q[x]))) return q.splice(x, 1)[0];
    }
    return null;
  };

  // a 3rd student on a bench only for those who do not fit 2 a bench – first rooms first
  let extra = Math.max(0, left() - rooms.reduce((n, r) => n + 2 * Math.floor((Number(r.capacity) || 50) / 2), 0));
  const count = { differentPaper: 0, differentDept: 0, same: 0 };
  let third = 0;
  const plan = rooms.map((r) => {
    const benches = Math.floor((Number(r.capacity) || 50) / 2);
    const middle = Math.min(benches, extra);
    extra -= middle;
    return { name: r.name, benches, sides: middle ? 3 : 2, middle, onBench: Array.from({ length: benches + 1 }, () => []), seats: {} };
  });
  const sit = (p, k, s, c) => {
    p.onBench[k].push(c);
    p.seats[c.registerNumber] = k + s * p.benches;
    if (s === 2) third++;
  };

  // ---- 1. clean: a bench partner writes another paper, or at least is of another branch
  for (const p of plan) {
    if (!left()) break;
    for (let s = 0; s < p.sides; s++) {
      const limit = s === 2 ? p.middle : p.benches;
      let stream = null;
      for (let k = 1; k <= limit && left(); k++) {
        const here = p.onBench[k];
        if (s > 0 && !here.length) continue; // fill the left desks first
        const codes = here.map((c) => c.code);
        if (!stream || !queues.get(stream)?.length || codes.includes(stream)) stream = biggest(codes) || null;
        if (stream) {
          sit(p, k, s, queues.get(stream).shift());
          if (here.length > 1) count.differentPaper++;
          continue;
        }
        const c = here.length ? otherBranch(here) : null;
        if (c) {
          sit(p, k, s, c);
          count.differentDept++;
        }
      }
    }
  }
  // ---- 2. still students left (every room used): the empty desks, then a middle desk
  for (const p of plan) {
    for (let s = 0; s < 3 && left(); s++) {
      for (let k = 1; k <= p.benches && left(); k++) {
        const desk = k + s * p.benches;
        if (Object.values(p.seats).includes(desk)) continue;
        if (s === 2 && p.sides < 3) p.sides = 3;
        const c = queues.get(biggest()).shift();
        if (p.onBench[k].length) count.same++;
        sit(p, k, s, c);
      }
    }
  }
  const out = plan
    .filter((p) => Object.keys(p.seats).length)
    .map((p) => ({
      name: p.name,
      capacity: p.benches * 2,
      perBench: Object.values(p.seats).some((d) => d > p.benches * 2) ? 3 : 2,
      students: Object.keys(p.seats).sort(),
      seats: p.seats,
    }));
  const notAllotted = [...queues.values()].flat().map((c) => c.registerNumber);
  return { rooms: out, notAllotted, benches: count, third };
}

// The desks of one room: the saved ones, and the lowest free desk for anyone put
// in by hand. -> { reg: desk }
export function roomSeats(room) {
  const given = room.seats instanceof Map ? Object.fromEntries(room.seats) : { ...(room.seats || {}) };
  const out = {};
  const used = new Set();
  for (const reg of [...(room.students || [])].sort()) {
    const s = Number(given[reg]);
    if (s >= 1 && !used.has(s)) {
      out[reg] = s;
      used.add(s);
    }
  }
  let next = 1;
  for (const reg of [...(room.students || [])].sort()) {
    if (out[reg]) continue;
    while (used.has(next)) next++;
    out[reg] = next;
    used.add(next);
  }
  return out;
}

// rooms: [{ name, capacity, students, seats }] -> { seatOf: Map(reg -> { room, seat }) }
export function seatsOf(rooms = []) {
  const seatOf = new Map();
  const ranges = new Map();
  for (const r of rooms) {
    const seats = roomSeats(r);
    if (!Object.keys(seats).length) continue;
    for (const [reg, seat] of Object.entries(seats)) seatOf.set(reg, { room: r.name, seat });
    ranges.set(r.name, { from: 1, to: Math.max(...Object.values(seats)) });
  }
  return { seatOf, ranges };
}

// benches where two students write the same paper AND are of the same branch (to flag)
export function sameBenches(room, seats, info) {
  const n = Math.floor((Number(room.capacity) || 50) / 2);
  const at = new Map(Object.entries(seats).map(([reg, s]) => [s, reg]));
  const out = [];
  for (let k = 1; k <= n; k++) {
    const list = [at.get(k), at.get(k + n), at.get(k + 2 * n)].map((reg) => info.get(reg)).filter(Boolean);
    const clash = list.some((a, i) => list.some((b, j) => j > i && a.code === b.code && deptOf(a) === deptOf(b)));
    if (clash) out.push(k);
  }
  return out;
}
