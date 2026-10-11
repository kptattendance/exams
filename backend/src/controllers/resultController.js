// src/controllers/resultController.js
//
// Results of an exam (KPT Academic Rules and Regulations 2025, clause 9).
//
//   1. Readiness – every permitted student needs his CIE, his theory marks
//                  (paper decoded) and his practical marks (batch submitted).
//   2. Process   – grade, grade points, SGPA and CGPA for every student. It can
//                  be repeated, e.g. after the Academic Council approves moderation.
//   3. Publish   – the results are written to CourseResult, which is what the
//                  next exam reads to find back papers. The exam is then completed.

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import Subject from "../models/Subject.js";
import CourseResult from "../models/CourseResult.js";
import AuditLog from "../models/AuditLog.js";
import { studentResult, MAX_MODERATION } from "../services/exams/results.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";

const log = (req, action, examId, details = {}) =>
  AuditLog.create({
    action,
    entity: "Result",
    entityId: examId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    details,
  }).catch(() => {});

async function loadExam(req, res) {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id."), null;
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  return exam;
}

const SUBJECT_FIELDS =
  "code subjectCategory iaMax iaMin theoryExamMax theoryExamMin practicalExamMax practicalExamMin totalMax totalMin credit";

// The result of every registered student, worked out from the marks as they are now
async function compute(exam, moderation) {
  const regs = await ExamRegistration.find({ exam: exam._id, "subjects.0": { $exists: true } }).lean();
  const earlier = await CourseResult.find({ student: { $in: regs.map((r) => r.student) }, exam: { $ne: exam._id } })
    .select("student subject status cie gradePoint credit declaredAt")
    .lean();

  const ids = new Set(earlier.map((r) => String(r.subject)));
  for (const r of regs) for (const s of r.subjects) ids.add(String(s.subject));
  const subjects = new Map((await Subject.find({ _id: { $in: [...ids] } }).select(SUBJECT_FIELDS).lean()).map((s) => [String(s._id), s]));

  // Latest earlier result per student and subject
  const latest = new Map();
  for (const r of earlier) {
    const k = `${r.student}|${r.subject}`;
    const prev = latest.get(k);
    if (!prev || new Date(r.declaredAt) > new Date(prev.declaredAt)) latest.set(k, r);
  }
  const past = new Map();
  for (const r of latest.values()) {
    const subject = subjects.get(String(r.subject));
    const sid = String(r.student);
    if (!past.has(sid)) past.set(sid, new Map());
    past.get(sid).set(String(r.subject), {
      cie: r.cie,
      status: r.status,
      points: r.status === "PASS" ? (r.gradePoint ?? null) : 0,
      credit: r.credit ?? subject?.credit ?? 0,
      kind: subject?.subjectCategory === "BRIDGE" ? "BRIDGE" : "REGULAR",
    });
  }

  const subjectOf = (id) => subjects.get(String(id));
  return regs.map((reg) => ({ reg, result: studentResult(reg, subjectOf, past.get(String(reg.student)), { moderation }) }));
}

// What is still missing, grouped by subject
function issuesOf(computed) {
  const map = new Map();
  for (const { result } of computed) {
    for (const c of result.courses) {
      if (c.status !== "INCOMPLETE") continue;
      const k = `${c.code}|${c.note}`;
      if (!map.has(k)) map.set(k, { code: c.code, name: c.name, note: c.note, students: 0 });
      map.get(k).students++;
    }
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

// Changes when any mark, grade or status changes
const fingerprint = (result) =>
  `${result.outcome}|${result.sgpa}|${result.cgpa}|` + (result.courses || []).map((c) => `${c.code}:${c.status}:${c.total}:${c.grade}`).join(",");

// GET /api/exams/:id/results/readiness
export const readiness = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const computed = await compute(exam, 0);
  const issues = issuesOf(computed);
  const outcomes = { PASS: 0, FAIL: 0, WITHHELD: 0 };
  let processed = 0;
  for (const { reg } of computed) {
    if (!reg.result?.processedAt) continue;
    processed++;
    if (reg.result.outcome in outcomes) outcomes[reg.result.outcome]++;
  }
  res.json({
    exam: {
      _id: exam._id,
      name: exam.name,
      academicYear: exam.academicYear,
      semesters: exam.semesters,
      status: exam.status,
      results: exam.results || {},
    },
    students: computed.length,
    processed,
    outcomes,
    issues,
    ready: computed.length > 0 && issues.length === 0,
    maxModeration: MAX_MODERATION,
  });
};

// POST /api/exams/:id/results/process  { moderation: 0–5 }
export const processResults = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  if (exam.results?.publishedAt) return fail(res, 409, "The results of this exam are already published.");
  const moderation = Number(req.body?.moderation ?? exam.results?.moderationMarks ?? 0);
  if (!Number.isInteger(moderation) || moderation < 0 || moderation > MAX_MODERATION)
    return fail(res, 400, `Moderation must be a whole number from 0 to ${MAX_MODERATION}.`);

  const computed = await compute(exam, moderation);
  if (!computed.length) return fail(res, 409, "No student is registered for this exam.");
  const issues = issuesOf(computed);
  if (issues.length) return fail(res, 409, `Marks are still missing in ${issues.length} place${issues.length > 1 ? "s" : ""}.`, { issues });

  const now = new Date();
  await ExamRegistration.bulkWrite(
    computed.map(({ reg, result }) => ({ updateOne: { filter: { _id: reg._id }, update: { $set: { result: { ...result, processedAt: now } } } } })),
    { ordered: false }
  );
  await Exam.updateOne(
    { _id: exam._id },
    { $set: { "results.moderationMarks": moderation, "results.processedAt": now, "results.processedBy": who(req) } }
  );
  const moderated = computed.filter(({ result }) => result.courses.some((c) => c.moderation > 0)).length;
  const passed = computed.filter(({ result }) => result.outcome === "PASS").length;
  await log(req, "RESULTS_PROCESSED", exam._id, { students: computed.length, passed, moderation, moderated });
  res.json({ message: `Results processed for ${computed.length} students: ${passed} passed in every subject.`, moderated });
};

// GET /api/exams/:id/results?department=&semester=&q=
export const listResults = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const { department, semester, q } = req.query;
  const filter = { exam: exam._id, "result.processedAt": { $ne: null } };
  if (department === "backlog") filter.group = { $in: ["backlog", "manual"] };
  else {
    if (department) filter.department = String(department).toLowerCase();
    if (semester) filter.semester = Number(semester);
    filter.group = { $nin: ["backlog", "manual"] };
  }
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { registerNumber: rx }];
  }
  const regs = await ExamRegistration.find(filter)
    .select("registerNumber name department semester admissionType result")
    .sort({ registerNumber: 1 })
    .limit(300)
    .lean();
  res.json({ data: regs });
};

// POST /api/exams/:id/results/publish
export const publishResults = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  if (exam.results?.publishedAt) return fail(res, 409, "The results of this exam are already published.");
  if (!exam.results?.processedAt) return fail(res, 409, "Process the results first.");

  // Publish only what the COE has looked at
  const computed = await compute(exam, exam.results.moderationMarks || 0);
  const stale = computed.filter(({ reg, result }) => !reg.result?.processedAt || fingerprint(reg.result) !== fingerprint(result)).length;
  if (stale) return fail(res, 409, `Marks of ${stale} student${stale > 1 ? "s" : ""} changed after the results were processed. Process them again.`);

  const now = new Date();
  const docs = [];
  for (const { reg, result } of computed) {
    for (const c of result.courses) {
      docs.push({
        student: reg.student,
        subject: c.subject,
        code: c.code,
        semester: c.semester,
        exam: exam._id,
        status: c.status,
        cie: c.cie,
        see: c.theory,
        practical: c.practical,
        total: c.total,
        max: c.max,
        grade: c.grade,
        gradePoint: c.points,
        credit: c.credit,
        declaredAt: now,
        source: "RESULT",
      });
    }
  }
  // Safe to repeat if an earlier try stopped half-way
  await CourseResult.deleteMany({ exam: exam._id, source: "RESULT" });
  await CourseResult.insertMany(docs, { ordered: false });
  await Exam.updateOne({ _id: exam._id }, { $set: { status: "COMPLETED", "results.publishedAt": now, "results.publishedBy": who(req) } });
  await log(req, "RESULTS_PUBLISHED", exam._id, { students: computed.length, subjects: docs.length });
  res.json({ message: `Results published for ${computed.length} students. The exam is now completed.` });
};
