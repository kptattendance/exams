// src/controllers/cieMakeupController.js
//
// Supplementary semester – CIE make-up for NE students (KPT 5.5, 9.1.3).
//   COE     : opens a round (name, last date to register)
//   office  : registers a student for a course with the exam-fee receipt,
//             enters the make-up CIE marks
//   result  : marks at or above the CIE minimum -> the course is an eligible
//             back paper in the next examination, with the new CIE; the open
//             examinations' registrations are refreshed automatically.

import mongoose from "mongoose";

import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import CourseResult from "../models/CourseResult.js";
import { CieMakeup, CieMakeupRound } from "../models/CieMakeup.js";
import { audit } from "../models/AuditLog.js";
import { cieMinimum, makeupAllowed, makeupPassed } from "../services/exams/cieMakeup.js";
import { refreshAfterChange, refreshNote } from "../services/exams/autoRefresh.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));
const GONE = ["passed", "discontinued", "transferred"];

const entryView = (e) => ({
  _id: e._id,
  student: e.student,
  subject: e.subject,
  registerNumber: e.registerNumber,
  name: e.name,
  department: e.department,
  code: e.code,
  subjectName: e.subjectName,
  subjectSemester: e.subjectSemester,
  originalCie: e.originalCie,
  cieMax: e.cieMax,
  cieMin: e.cieMin,
  fee: e.fee,
  marks: e.marks,
  passed: e.passed,
  enteredAt: e.enteredAt,
});

// Everyone whose latest result in a course is NE (and who has not already
// made it up), for courses that allow a make-up (KPT 5.5.2)
async function candidates() {
  const neStudents = await CourseResult.distinct("student", { status: "NE", rejected: { $ne: true } });
  if (!neStudents.length) return [];
  const rows = await CourseResult.find({ student: { $in: neStudents }, rejected: { $ne: true } }).select("student subject status cie declaredAt").lean();
  const latest = new Map();
  for (const r of rows) {
    const k = `${r.student}|${r.subject}`;
    const prev = latest.get(k);
    if (!prev || new Date(r.declaredAt) > new Date(prev.declaredAt)) latest.set(k, r);
  }
  const ne = [...latest.values()].filter((r) => r.status === "NE");
  if (!ne.length) return [];
  const [subjects, students, madeUp] = await Promise.all([
    Subject.find({ _id: { $in: [...new Set(ne.map((r) => String(r.subject)))] } }).select("code name semester iaMax iaMin theoryExamMax practicalExamMax").lean(),
    Student.find({ _id: { $in: [...new Set(ne.map((r) => String(r.student)))] } }).select("registerNumber name department semester status").lean(),
    CieMakeup.find({ passed: true, student: { $in: neStudents } }).select("student subject").lean(),
  ]);
  const subjectOf = new Map(subjects.map((s) => [String(s._id), s]));
  const studentOf = new Map(students.map((s) => [String(s._id), s]));
  const done = new Set(madeUp.map((m) => `${m.student}|${m.subject}`));
  return ne
    .map((r) => ({ r, subject: subjectOf.get(String(r.subject)), student: studentOf.get(String(r.student)) }))
    .filter(({ r, subject, student }) => subject && student && !GONE.includes(student.status) && makeupAllowed(subject) && !done.has(`${r.student}|${r.subject}`))
    .map(({ r, subject, student }) => ({
      student: student._id,
      subject: subject._id,
      registerNumber: student.registerNumber,
      name: student.name,
      department: student.department,
      studentSemester: student.semester,
      code: subject.code,
      subjectName: subject.name,
      subjectSemester: subject.semester,
      originalCie: r.cie ?? null,
      cieMax: Number(subject.iaMax) || 0,
      cieMin: cieMinimum(subject),
    }))
    .sort((a, b) => a.registerNumber.localeCompare(b.registerNumber) || a.code.localeCompare(b.code));
}

// GET /api/cie-makeup/rounds
export const listRounds = async (req, res) => {
  const rounds = await CieMakeupRound.find().sort({ createdAt: -1 }).lean();
  const counts = await CieMakeup.aggregate([{ $group: { _id: "$round", registered: { $sum: 1 }, passed: { $sum: { $cond: ["$passed", 1, 0] } } } }]);
  const by = new Map(counts.map((c) => [String(c._id), c]));
  res.json({ data: rounds.map((r) => ({ ...r, registered: by.get(String(r._id))?.registered || 0, passed: by.get(String(r._id))?.passed || 0 })) });
};

// POST /api/cie-makeup/rounds   { name, academicYear, lastDate }   (COE)
export const createRound = async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 120);
  if (name.length < 3) return fail(res, 400, "Give the round a name, e.g. Supplementary semester June 2027.");
  const lastDate = req.body?.lastDate ? new Date(req.body.lastDate) : null;
  if (lastDate && Number.isNaN(lastDate.getTime())) return fail(res, 400, "The last date is not valid.");
  const round = await CieMakeupRound.create({ name, academicYear: String(req.body?.academicYear || "").trim().slice(0, 20), lastDate, createdBy: who(req) });
  await audit(req, "CIE_MAKEUP_ROUND_CREATED", round._id, { name, lastDate: req.body?.lastDate || null });
  res.status(201).json({ data: round, message: `${name} opened.` });
};

// PUT /api/cie-makeup/rounds/:id   { lastDate }   (COE)
export const updateRound = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const raw = String(req.body?.lastDate || "").trim();
  const lastDate = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(lastDate.getTime())) return fail(res, 400, "The date is not valid.");
  const round = await CieMakeupRound.findByIdAndUpdate(req.params.id, { $set: { lastDate } }, { new: true }).lean();
  if (!round) return fail(res, 404, "Round not found.");
  await audit(req, "CIE_MAKEUP_LAST_DATE", round._id, { lastDate: raw || null });
  res.json({ data: round, message: lastDate ? `Registration closes on ${lastDate.toLocaleDateString("en-IN")}.` : "No last date set." });
};

// GET /api/cie-makeup/rounds/:id   – the round, its registrations and who may still register
export const getRound = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const round = await CieMakeupRound.findById(req.params.id).lean();
  if (!round) return fail(res, 404, "Round not found.");
  const [entries, open] = await Promise.all([CieMakeup.find({ round: round._id }).sort({ registerNumber: 1, code: 1 }).lean(), candidates()]);
  const registered = new Set(entries.map((e) => `${e.student}|${e.subject}`));
  res.json({
    round,
    entries: entries.map(entryView),
    candidates: open.filter((c) => !registered.has(`${c.student}|${c.subject}`)),
  });
};

// POST /api/cie-makeup/rounds/:id/register   { student, subject, receiptNo, amount, paidOn }
export const registerStudent = async (req, res) => {
  if (!isId(req.params.id) || !isId(req.body?.student) || !isId(req.body?.subject)) return fail(res, 400, "Invalid id.");
  const round = await CieMakeupRound.findById(req.params.id).lean();
  if (!round) return fail(res, 404, "Round not found.");
  if (round.lastDate && Date.now() > endOfDay(round.lastDate).getTime())
    return fail(res, 409, `Registration closed on ${new Date(round.lastDate).toLocaleDateString("en-IN")} (KPT 5.5.1 b).`);
  const c = (await candidates()).find((x) => String(x.student) === String(req.body.student) && String(x.subject) === String(req.body.subject));
  if (!c) return fail(res, 409, "This student does not have an NE in this course that can be made up (or has already made it up).");
  const receiptNo = String(req.body?.receiptNo || "").trim().slice(0, 60);
  if (!receiptNo) return fail(res, 400, "Write the exam fee receipt / challan number (KPT 5.5.1 a).");
  const amount = req.body?.amount === "" || req.body?.amount == null ? null : Number(req.body.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 100000)) return fail(res, 400, "Fee amount is not valid.");
  const paidOn = req.body?.paidOn ? new Date(req.body.paidOn) : new Date();
  try {
    const e = await CieMakeup.create({
      round: round._id,
      student: c.student,
      subject: c.subject,
      registerNumber: c.registerNumber,
      name: c.name,
      department: c.department,
      code: c.code,
      subjectName: c.subjectName,
      subjectSemester: c.subjectSemester,
      originalCie: c.originalCie,
      cieMax: c.cieMax,
      cieMin: c.cieMin,
      fee: { amount, receiptNo, paidOn },
      createdBy: who(req),
    });
    await audit(req, "CIE_MAKEUP_REGISTERED", round._id, { registerNumber: c.registerNumber, code: c.code, receiptNo, amount });
    res.status(201).json({ data: entryView(e.toObject()), message: `${c.registerNumber} registered for ${c.code}.` });
  } catch (err) {
    if (err?.code === 11000) return fail(res, 409, "Already registered in this round.");
    throw err;
  }
};

// POST /api/cie-makeup/entries/:id/marks   { marks }
export const enterMarks = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const e = await CieMakeup.findById(req.params.id);
  if (!e) return fail(res, 404, "Registration not found.");
  const raw = req.body?.marks;
  const marks = raw === "" || raw == null ? null : Number(raw);
  if (marks !== null && (!Number.isFinite(marks) || marks < 0 || marks > e.cieMax)) return fail(res, 400, `Marks must be from 0 to ${e.cieMax}.`);
  const was = e.passed;
  e.marks = marks;
  e.passed = makeupPassed(marks, { iaMax: e.cieMax, iaMin: e.cieMin });
  e.enteredBy = who(req);
  e.enteredAt = new Date();
  await e.save();

  // the open examinations: his class and the back-paper group get the new CIE
  let note = "";
  if (was !== e.passed || e.passed) {
    const st = await Student.findById(e.student).select("department semester").lean();
    const auto = await refreshAfterChange([{ backlog: true }, st && { department: st.department, semester: st.semester }], "CIE make-up");
    note = refreshNote(auto);
  }
  await audit(req, "CIE_MAKEUP_MARKS", e.round, { registerNumber: e.registerNumber, code: e.code, marks, passed: e.passed });
  res.json({
    data: entryView(e.toObject()),
    message:
      marks === null
        ? "Marks cleared."
        : e.passed
          ? `${e.registerNumber} · ${e.code}: ${marks}/${e.cieMax} – CIE made up. The course is an eligible back paper in the next exam with this CIE.${note}`
          : `${e.registerNumber} · ${e.code}: ${marks}/${e.cieMax} – still below the minimum ${e.cieMin}; remains NE.${note}`,
  });
};

// DELETE /api/cie-makeup/entries/:id   – registered by mistake, no marks yet (COE)
export const removeEntry = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const e = await CieMakeup.findById(req.params.id);
  if (!e) return fail(res, 404, "Registration not found.");
  if (e.marks !== null) return fail(res, 409, "Marks are entered – clear the marks first.");
  await CieMakeup.deleteOne({ _id: e._id });
  await audit(req, "CIE_MAKEUP_REMOVED", e.round, { registerNumber: e.registerNumber, code: e.code });
  res.json({ message: "Registration removed." });
};
