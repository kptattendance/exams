// src/controllers/examSessionController.js
//
// Written (theory) exam – one session (date + FN/AN) as the Chief Examiner
// runs it:
//   1. Question papers – printed from 1 hour before the start (paper setting, exam-day print)
//   2. Rooms          – he allots register numbers to rooms and prints a room
//                       diary for each (answer script no., signature, "Absent")
//   3. Absentees      – from 30 minutes after the start until the session ends,
//                       he marks the absentees from the room diaries
//   4. Coding         – then the COE codes the papers (Valuation)
// Candidates are the same answer scripts the valuation uses (permitted students).

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRoom from "../models/ExamRoom.js";
import AnswerScript from "../models/AnswerScript.js";
import ValuationPaper from "../models/ValuationPaper.js";
import AuditLog from "../models/AuditLog.js";
import { getPaper, syncCandidates } from "./valuationController.js";
import { absentWindow, printWindow, todayIST, windowState } from "../services/examDay.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const isChief = (req) => req.user?.role === "chief_examiner";

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

const timesOf = (entry, sessions) => {
  const p = printWindow(entry, sessions);
  const a = absentWindow(entry, sessions);
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
      if (!bySlot.has(k)) bySlot.set(k, { entry, codes: [] });
      bySlot.get(k).codes.push(entry.code);
    }
    for (const { entry, codes } of bySlot.values())
      out.push({ examId: e._id, exam: e.name, date: entry.date, session: entry.session, papers: codes.sort(), today: entry.date === today, ...timesOf(entry, e.timetable.sessions) });
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
  return { exam, date, session, entries, times: timesOf(entries[0], exam.timetable.sessions) };
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
    if (!paper.coded) await syncCandidates(exam, paper); // follows eligibility / fee until coding
    papers.push({ code, name: paper.name, coded: Boolean(paper.coded) });
  }
  const [scripts, rooms] = await Promise.all([
    AnswerScript.find({ exam: exam._id, code: { $in: codes } }).select("code registerNumber name department semester kind attendance").sort({ registerNumber: 1 }).lean(),
    ExamRoom.find({ exam: exam._id, date, session }).sort({ order: 1, name: 1 }).lean(),
  ]);
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
  });
};

// PUT /api/exam-sessions/:examId/:date/:session/rooms  { rooms: [{ name, invigilator, students: [registerNumber] }] }
// Replaces the rooms of the session. Open until the session ends.
export const saveRooms = async (req, res) => {
  const s = await loadSession(req, res);
  if (!s) return;
  const { exam, date, session, entries, times } = s;
  if (isChief(req) && times.absent === "CLOSED") return fail(res, 403, "The session is over – rooms can no longer be changed.");
  const list = Array.isArray(req.body?.rooms) ? req.body.rooms : [];
  const known = new Set(
    (await AnswerScript.find({ exam: exam._id, code: { $in: entries.map((e) => e.code) } }).select("registerNumber").lean()).map((x) => x.registerNumber)
  );
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
  await ExamRoom.deleteMany({ exam: exam._id, date, session });
  if (clean.length) await ExamRoom.insertMany(clean);
  await log(req, "EXAM_ROOMS_SAVED", exam._id, { date, session, rooms: clean.length, students: seen.size, notAllotted: known.size - seen.size });
  res.json({ message: `${clean.length} room${clean.length === 1 ? "" : "s"} saved · ${seen.size} of ${known.size} candidates allotted.` });
};

// POST /api/exam-sessions/:examId/:date/:session/absent  { absent: [registerNumber] }
// The Chief Examiner may do this only from 30 minutes after the start until the
// session ends. The list replaces the absentees of the session (malpractice is
// left as it is). Not possible once a paper is coded.
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
  const coded = await ValuationPaper.find({ exam: exam._id, code: { $in: codes }, coded: true }).select("code").lean();
  if (coded.length) return fail(res, 409, `Already coded: ${coded.map((p) => p.code).join(", ")}. Attendance can no longer be changed.`);

  const absent = [...new Set((Array.isArray(req.body?.absent) ? req.body.absent : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean))];
  const scripts = await AnswerScript.find({ exam: exam._id, code: { $in: codes } }).select("registerNumber attendance").lean();
  const known = new Set(scripts.map((x) => x.registerNumber));
  const unknown = absent.filter((n) => !known.has(n));
  if (unknown.length) return fail(res, 400, `Not a candidate in this session: ${unknown.join(", ")}`);

  const scope = { exam: exam._id, code: { $in: codes } };
  await AnswerScript.updateMany({ ...scope, attendance: "ABSENT", registerNumber: { $nin: absent } }, { $set: { attendance: "PRESENT" } });
  if (absent.length) await AnswerScript.updateMany({ ...scope, registerNumber: { $in: absent }, attendance: { $ne: "MALPRACTICE" } }, { $set: { attendance: "ABSENT" } });
  await log(req, "EXAM_ABSENTEES_SAVED", exam._id, { date, session, absent });
  res.json({ message: `Saved: ${absent.length} absent, ${scripts.length - absent.length} present.` });
};
