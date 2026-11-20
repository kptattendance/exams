// src/controllers/examSessionController.js
//
// Written (theory) exam – one session (date + FN/AN) as the Chief Examiner
// runs it:
//   1. Question papers – printed from 1 hour before the start (paper setting, exam-day print)
//   2. Rooms          – he allots register numbers to rooms (25 a room) until the
//                       session starts (after that only the Admin). Saving makes
//                       the ATS numbers: one room diary per paper per room, with a
//                       random 6-digit number + each student's shuffled serial.
//                       The diary prints the ATS against each register number; the
//                       student copies it onto the answer booklet, writes the
//                       answer-script number in the diary and signs.
//   3. Absentees      – from 30 minutes after the start until the session ends,
//                       he marks the absentees from the room diaries
//   4. Packets        – automatic after the session: each diary is its packet
// Candidates are the same answer scripts the valuation uses (permitted students).

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRoom from "../models/ExamRoom.js";
import AnswerScript from "../models/AnswerScript.js";
import ValuationPaper from "../models/ValuationPaper.js";
import AuditLog from "../models/AuditLog.js";
import RoomDiary from "../models/RoomDiary.js";
import Counter from "../models/Counter.js";
import { attendanceBlocked, autoCode, getPaper, syncCandidates, syncPackets } from "./valuationController.js";
import { planDiaries } from "../services/exams/valuation.js";
import { ABSENT_AFTER_MINUTES, printWindow, todayIST, windowState } from "../services/examDay.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const isChief = (req) => req.user?.role === "chief_examiner";
const isAdmin = (req) => req.user?.role === "admin";
// who sees the ATS against the register numbers: COE / ACOE / Admin, and the
// Chief Examiner on the exam day (to print the room diaries)
const seesAts = (req, date) => ["coe", "acoe", "admin"].includes(req.user?.role) || (isChief(req) && date === todayIST());

const log = (req, action, examId, details = {}) =>
  AuditLog.create({
    action,
    entity: "ExamSession",
    entityId: examId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    details,
  }).catch(() => {});

// A session can have normal and drawing papers: it runs from the earliest
// start to the latest end of its papers.
const timesOf = (entries, sessions) => {
  const ws = entries.map((e) => printWindow(e, sessions));
  const min = (k) => new Date(Math.min(...ws.map((w) => w[k].getTime())));
  const max = (k) => new Date(Math.max(...ws.map((w) => w[k].getTime())));
  const p = { opensAt: min("opensAt"), startsAt: min("startsAt"), closesAt: max("closesAt") };
  const a = { opensAt: new Date(p.startsAt.getTime() + ABSENT_AFTER_MINUTES * 60 * 1000), startsAt: p.startsAt, closesAt: p.closesAt };
  const now = new Date();
  return {
    printOpensAt: p.opensAt,
    startsAt: p.startsAt,
    endsAt: p.closesAt,
    absentOpensAt: a.opensAt,
    print: windowState(p, now),
    absent: windowState(a, now),
  };
};

// GET /api/exam-sessions – every session of the running exams (published time table)
export const listSessions = async (req, res) => {
  const exams = await Exam.find({ status: { $ne: "COMPLETED" }, "timetable.published": true }).select("name academicYear timetable").lean();
  const today = todayIST();
  const out = [];
  for (const e of exams) {
    const bySlot = new Map();
    for (const entry of e.timetable?.entries || []) {
      if (!entry.date || !entry.session) continue;
      const k = `${entry.date}|${entry.session}`;
      if (!bySlot.has(k)) bySlot.set(k, { entry, codes: [], list: [] });
      bySlot.get(k).codes.push(entry.code);
      bySlot.get(k).list.push(entry);
    }
    for (const { entry, codes, list } of bySlot.values())
      out.push({ examId: e._id, exam: e.name, date: entry.date, session: entry.session, papers: codes.sort(), today: entry.date === today, ...timesOf(list, e.timetable.sessions) });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.session.localeCompare(b.session) || a.exam.localeCompare(b.exam));
  res.json({ today, data: out });
};

async function loadSession(req, res) {
  const { examId, date, session } = req.params;
  if (!isId(examId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !["FN", "AN"].includes(session)) return fail(res, 400, "Invalid session."), null;
  const exam = await Exam.findById(examId).lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  const entries = (exam.timetable?.entries || []).filter((e) => e.date === date && e.session === session);
  if (!entries.length) return fail(res, 404, "No paper is written in this session."), null;
  return { exam, date, session, entries, times: timesOf(entries, exam.timetable.sessions) };
}

// GET /api/exam-sessions/:examId/:date/:session – papers, candidates, rooms
export const getSession = async (req, res) => {
  const s = await loadSession(req, res);
  if (!s) return;
  const { exam, date, session, entries, times } = s;
  const codes = entries.map((e) => e.code);
  const papers = [];
  for (const code of codes) {
    const paper = await getPaper(exam, code);
    if (!paper) continue;
    let waiting = "";
    if (!paper.coded) {
      await syncCandidates(exam, paper); // follows eligibility / fee until the packets are made
      waiting = await autoCode(exam, paper); // after the session: each room diary becomes its packet
    }
    papers.push({ code, name: paper.name, coded: Boolean(paper.coded), waiting, drawing: Boolean(entries.find((e) => e.code === code)?.drawing) });
  }
  const showAts = seesAts(req, date);
  const [scripts, rooms, diaries] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code: { $in: codes } }).select("code registerNumber name department semester kind attendance dummy").sort({ registerNumber: 1 }).lean(),
    ExamRoom.find({ exam: exam._id, date, session }).sort({ order: 1, name: 1 }).lean(),
    RoomDiary.find({ exam: exam._id, date, session }).sort({ number: 1 }).lean(),
  ]);
  for (const x of scripts) {
    x.ats = showAts && x.dummy ? x.dummy : undefined;
    delete x.dummy;
  }
  const roomOf = new Map();
  for (const r of rooms) for (const n of r.students) roomOf.set(n, r.name);
  for (const p of papers) {
    const mine = scripts.filter((x) => x.code === p.code);
    p.candidates = mine.length;
    p.absent = mine.filter((x) => x.attendance === "ABSENT").length;
  }
  res.json({
    exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear },
    date,
    session,
    times,
    papers,
    candidates: scripts.map((x) => ({ ...x, room: roomOf.get(x.registerNumber) || "" })),
    rooms: rooms.map((r) => ({ _id: r._id, name: r.name, invigilator: r.invigilator, students: r.students })),
    // one room diary per paper per room = one packet
    diaries: diaries.map((d) => ({
      _id: d._id,
      room: d.room,
      code: d.code,
      number: d.number,
      base: showAts ? d.base : undefined,
      students: Object.keys(d.serials || {}).length,
      reprint: Boolean(d.reprint),
    })),
    seesAts: showAts,
    // rooms (and ATS) can be changed until the session starts; after that only the Admin
    roomsOpen: isAdmin(req) ? !papers.some((p) => p.coded) : Date.now() < new Date(times.startsAt).getTime(),
  });
};

// PUT /api/exam-sessions/:examId/:date/:session/rooms  { rooms: [{ name, invigilator, students: [registerNumber] }] }
// Replaces the rooms of the session and makes the ATS numbers (one room diary per
// paper per room). Open until the session starts; after that only the Admin, and
// never once the packets are made.
export const saveRooms = async (req, res) => {
  const s = await loadSession(req, res);
  if (!s) return;
  const { exam, date, session, entries, times } = s;
  if (!isAdmin(req) && Date.now() >= new Date(times.startsAt).getTime())
    return fail(res, 403, "The session has started – rooms and ATS numbers are locked. Ask the Admin for any change.");
  const codes = entries.map((e) => e.code);
  const coded = await ValuationPaper.find({ exam: exam._id, code: { $in: codes }, coded: true }).select("code").lean();
  if (coded.length) return fail(res, 409, `The packets of ${coded.map((p) => p.code).join(", ")} are already made. Rooms can no longer be changed.`);

  const list = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  const scripts = await AnswerScript.find({ exam: exam._id, code: { $in: codes } }).select("_id code registerNumber dummy diary").lean();
  const known = new Set(scripts.map((x) => x.registerNumber));
  const seen = new Map();
  const names = new Set();
  const clean = [];
  for (const [i, r] of list.entries()) {
    const name = String(r?.name || "").trim().slice(0, 40);
    if (!name) return fail(res, 400, `Room ${i + 1} has no name.`);
    if (names.has(name.toLowerCase())) return fail(res, 400, `Room "${name}" is listed twice.`);
    names.add(name.toLowerCase());
    const students = [...new Set((Array.isArray(r.students) ? r.students : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
    for (const n of students) {
      if (!known.has(n)) return fail(res, 400, `${n} does not write a paper in this session.`);
      if (seen.has(n)) return fail(res, 400, `${n} is in "${seen.get(n)}" and also in "${name}".`);
      seen.set(n, name);
    }
    clean.push({ exam: exam._id, date, session, name, order: i, invigilator: String(r.invigilator || "").trim().slice(0, 80), students, savedBy: who(req) });
  }

  // ---- room diaries and ATS numbers
  const papersOf = new Map(); // register number -> [codes]
  for (const x of scripts) {
    if (!papersOf.has(x.registerNumber)) papersOf.set(x.registerNumber, []);
    papersOf.get(x.registerNumber).push(x.code);
  }
  const old = await RoomDiary.find({ exam: exam._id, date, session }).lean();
  const takenBases = new Set(await RoomDiary.distinct("base", { exam: exam._id }));
  let fresh = 0;
  let plan;
  try {
    plan = planDiaries({
      rooms: clean.map((r) => ({ name: r.name, students: r.students })),
      papers: papersOf,
      old: old.map((d) => ({ room: d.room, code: d.code, base: d.base, number: d.number, serials: d.serials || {} })),
      takenBases,
      nextNumber: () => `NEW-${fresh++}`,
    });
  } catch (e) {
    return fail(res, 400, e.message);
  }
  // packet numbers P-0001, P-0002 … – one running number per exam, never used twice
  if (fresh) {
    const c = await Counter.findOneAndUpdate({ _id: `packet:${exam._id}` }, { $inc: { seq: fresh } }, { upsert: true, returnDocument: "after" }).lean();
    const first = c.seq - fresh + 1;
    for (const d of plan) if (d.number.startsWith("NEW-")) d.number = `P-${String(first + Number(d.number.slice(4))).padStart(4, "0")}`;
  }

  await ExamRoom.deleteMany({ exam: exam._id, date, session });
  if (clean.length) await ExamRoom.insertMany(clean);

  const keep = new Set(plan.filter((d) => !d.isNew).map((d) => `${d.room}|${d.code}`));
  const removed = old.filter((d) => !keep.has(`${d.room}|${d.code}`));
  if (removed.length) await RoomDiary.deleteMany({ _id: { $in: removed.map((d) => d._id) } });
  const idOf = new Map(old.map((d) => [`${d.room}|${d.code}`, d._id]));
  for (const d of plan.filter((x) => !x.isNew && x.changed))
    await RoomDiary.updateOne({ _id: idOf.get(`${d.room}|${d.code}`) }, { $set: { serials: d.serials, reprint: true } });
  const made = plan.filter((d) => d.isNew).length
    ? await RoomDiary.insertMany(plan.filter((d) => d.isNew).map((d) => ({ exam: exam._id, date, session, room: d.room, code: d.code, base: d.base, number: d.number, serials: d.serials })))
    : [];
  for (const m of made) idOf.set(`${m.room}|${m.code}`, m._id);

  // every answer script: its ATS and diary (none when not in a room)
  const want = new Map(); // script id -> { dummy, diary }
  const scriptOf = new Map(scripts.map((x) => [`${x.registerNumber}|${x.code}`, x]));
  for (const d of plan)
    for (const [reg, serial] of Object.entries(d.serials)) {
      const x = scriptOf.get(`${reg}|${d.code}`);
      if (x) want.set(String(x._id), { dummy: `${d.base}${serial}`, diary: idOf.get(`${d.room}|${d.code}`) });
    }
  const changes = scripts.filter((x) => {
    const w = want.get(String(x._id));
    return (w?.dummy || null) !== (x.dummy || null) || String(w?.diary || "") !== String(x.diary || "");
  });
  if (changes.length) {
    // first clear, then set – an ATS is never on two scripts at once
    await AnswerScript.updateMany({ _id: { $in: changes.map((x) => x._id) } }, { $set: { dummy: null, diary: null } });
    const sets = changes.filter((x) => want.has(String(x._id)));
    if (sets.length)
      await AnswerScript.bulkWrite(
        sets.map((x) => ({ updateOne: { filter: { _id: x._id }, update: { $set: want.get(String(x._id)) } } })),
        { ordered: false }
      );
  }

  const reprint = plan.filter((d) => !d.isNew && d.changed).length;
  await log(req, "EXAM_ROOMS_SAVED", exam._id, { date, session, rooms: clean.length, students: seen.size, notAllotted: known.size - seen.size, diaries: plan.length, changedDiaries: reprint });
  res.json({
    message:
      `${clean.length} room${clean.length === 1 ? "" : "s"} saved · ${seen.size} of ${known.size} candidates allotted · ${plan.length} room diar${plan.length === 1 ? "y" : "ies"} with ATS numbers.` +
      (reprint ? ` ${reprint} room diar${reprint === 1 ? "y has" : "ies have"} changed – print ${reprint === 1 ? "it" : "them"} again.` : ""),
  });
};

// POST /api/exam-sessions/:examId/:date/:session/printed  { room }  – the room diaries
// (of one room, or all) are printed again: the "print again" mark goes
export const markPrinted = async (req, res) => {
  const s = await loadSession(req, res);
  if (!s) return;
  const room = String(req.body?.room || "").trim();
  await RoomDiary.updateMany({ exam: s.exam._id, date: s.date, session: s.session, ...(room ? { room } : {}) }, { $set: { reprint: false } });
  res.json({ ok: true });
};

// POST /api/exam-sessions/:examId/:date/:session/absent  { absent: [registerNumber] }
// The Chief Examiner may do this only from 30 minutes after the start until the
// session ends. The list replaces the absentees of the session (malpractice is
// left as it is). The packets follow; not possible once a packet has marks typed.
export const saveAbsentees = async (req, res) => {
  const s = await loadSession(req, res);
  if (!s) return;
  const { exam, date, session, entries, times } = s;
  const t = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  if (isChief(req)) {
    if (date !== todayIST() || times.absent === "BEFORE") return fail(res, 403, `Absentees can be marked from ${t(times.absentOpensAt)} on the exam day.`);
    if (times.absent === "CLOSED") return fail(res, 403, "The session is over – absentees can no longer be marked here. Ask the COE office.");
  }
  const codes = entries.map((e) => e.code);

  const absent = [...new Set((Array.isArray(req.body?.absent) ? req.body.absent : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
  const scripts = await AnswerScript.find({ exam: exam._id, code: { $in: codes } }).select("code registerNumber attendance diary dummy").lean();
  const known = new Set(scripts.map((x) => x.registerNumber));
  const unknown = absent.filter((n) => !known.has(n));
  if (unknown.length) return fail(res, 400, `Not a candidate in this session: ${unknown.join(", ")}`);
  const changed = scripts.filter((x) => x.attendance !== "MALPRACTICE" && (x.attendance === "ABSENT") !== absent.includes(x.registerNumber));
  const blocked = await attendanceBlocked(exam, changed, changed.filter((x) => x.attendance === "ABSENT").map((x) => x.registerNumber));
  if (blocked) return fail(res, 409, blocked);

  const scope = { exam: exam._id, code: { $in: codes } };
  await AnswerScript.updateMany({ ...scope, attendance: "ABSENT", registerNumber: { $nin: absent } }, { $set: { attendance: "PRESENT" } });
  if (absent.length) await AnswerScript.updateMany({ ...scope, registerNumber: { $in: absent }, attendance: { $ne: "MALPRACTICE" } }, { $set: { attendance: "ABSENT" } });
  // packets already made (after the session): they follow the attendance
  for (const p of await ValuationPaper.find({ exam: exam._id, code: { $in: codes }, coded: true })) await syncPackets(exam, p);
  await log(req, "EXAM_ABSENTEES_SAVED", exam._id, { date, session, absent });
  res.json({ message: `Saved: ${absent.length} absent, ${scripts.length - absent.length} present.` });
};
