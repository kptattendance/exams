// src/services/exams/timetable.js
//
// Pure helpers for the written-exam timetable (unit-tested in test/timetable.test.js).
//
//  paper   = one subject code with a written (theory) exam. All departments
//            that have the same code write it together.
//  clash   = a student has two papers in the same date + session  (must fix)
//  sameDay = a student has two papers on the same date            (warning)

// Registrations -> papers to schedule + which papers each student writes
export function buildPapers(regs) {
  const papers = new Map(); // code -> paper
  const studentCodes = [];
  for (const r of regs) {
    const mine = new Set();
    for (const s of r.subjects || []) {
      if (!s.hasTheory) continue;
      if (!papers.has(s.code)) {
        papers.set(s.code, { code: s.code, name: s.name, semesters: new Set(), departments: new Set(), candidates: 0, backlog: 0 });
      }
      const p = papers.get(s.code);
      if (mine.has(s.code)) continue;
      mine.add(s.code);
      p.candidates++;
      if (s.kind === "BACKLOG") p.backlog++;
      else {
        p.departments.add(String(r.department || "").toLowerCase());
        if (s.semester) p.semesters.add(s.semester);
      }
      if (s.kind === "BACKLOG" && s.semester) p.semesters.add(s.semester);
    }
    if (mine.size) studentCodes.push([...mine]);
  }
  const list = [...papers.values()]
    .map((p) => ({ ...p, semesters: [...p.semesters].sort(), departments: [...p.departments].sort() }))
    .sort((a, b) => (a.semesters[0] || 9) - (b.semesters[0] || 9) || b.departments.length - a.departments.length || a.code.localeCompare(b.code));
  const index = new Map(list.map((p, i) => [p.code, i]));
  return { papers: list, studentCodes: studentCodes.map((codes) => codes.map((c) => index.get(c))) };
}

// entries: [{ code, date, session }]  papers: [{code}]  studentCodes: [[paperIndex]]
export function checkTimetable(entries, papers, studentCodes) {
  const slotOf = new Map(entries.map((e) => [e.code, e]));
  const clashMap = new Map();
  const dayMap = new Map();

  for (const idxs of studentCodes) {
    const bySlot = new Map();
    const byDay = new Map();
    for (const i of idxs) {
      const code = papers[i]?.code;
      const e = code && slotOf.get(code);
      if (!e) continue;
      const slot = `${e.date}|${e.session}`;
      if (!bySlot.has(slot)) bySlot.set(slot, []);
      bySlot.get(slot).push(code);
      if (!byDay.has(e.date)) byDay.set(e.date, []);
      byDay.get(e.date).push(code);
    }
    for (const [slot, codes] of bySlot) {
      if (codes.length < 2) continue;
      const key = `${slot}|${[...codes].sort().join(",")}`;
      const c = clashMap.get(key) || { date: slot.split("|")[0], session: slot.split("|")[1], codes: [...codes].sort(), students: 0 };
      c.students++;
      clashMap.set(key, c);
    }
    for (const [date, codes] of byDay) {
      if (codes.length < 2) continue;
      const sessions = new Set(codes.map((c) => slotOf.get(c).session));
      if (sessions.size < 2) continue; // already a clash, not just "same day"
      const key = `${date}|${[...codes].sort().join(",")}`;
      const d = dayMap.get(key) || { date, codes: [...codes].sort(), students: 0 };
      d.students++;
      dayMap.set(key, d);
    }
  }
  const unscheduled = papers.filter((p) => !slotOf.has(p.code)).map((p) => p.code);
  const byDate = (a, b) => a.date.localeCompare(b.date);
  return { clashes: [...clashMap.values()].sort(byDate), sameDay: [...dayMap.values()].sort(byDate), unscheduled };
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const isSunday = (iso) => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;

// Suggest dates: each paper goes to the earliest slot where none of its
// students already has a paper that day. Papers already placed by the COE
// (keep) stay where they are. Sundays and holidays are skipped.
export function suggestTimetable(papers, studentCodes, { startDate, holidays = [], keep = [], maxDays = 90 }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || "")) throw new Error("Choose the first exam date.");
  const skip = new Set(holidays);
  const studentsOf = papers.map(() => []);
  studentCodes.forEach((idxs, s) => idxs.forEach((i) => studentsOf[i]?.push(s)));

  const busy = new Set(); // "student|date"
  const placed = new Map(keep.map((e) => [e.code, e]));
  const index = new Map(papers.map((p, i) => [p.code, i]));
  for (const e of keep) {
    const i = index.get(e.code);
    if (i === undefined) continue;
    for (const s of studentsOf[i]) busy.add(`${s}|${e.date}`);
  }

  // bigger, common papers first within a semester – they are hardest to fit
  const order = papers
    .map((p, i) => i)
    .filter((i) => !placed.has(papers[i].code))
    .sort((a, b) => (papers[a].semesters[0] || 9) - (papers[b].semesters[0] || 9) || studentsOf[b].length - studentsOf[a].length);

  const days = [];
  for (let n = 0, d = startDate; n < maxDays; n++, d = addDays(d, 1)) if (!isSunday(d) && !skip.has(d)) days.push(d);

  const out = [...keep];
  const unplaced = [];
  for (const i of order) {
    let done = false;
    for (const date of days) {
      if (studentsOf[i].some((s) => busy.has(`${s}|${date}`))) continue;
      // 1st & 3rd year in the morning, 2nd year in the afternoon
      const year = Math.ceil((papers[i].semesters[0] || 1) / 2);
      const session = year === 2 ? "AN" : "FN";
      out.push({ code: papers[i].code, date, session });
      studentsOf[i].forEach((s) => busy.add(`${s}|${date}`));
      done = true;
      break;
    }
    if (!done) unplaced.push(papers[i].code);
  }
  return { entries: out.sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session)), unplaced };
}
