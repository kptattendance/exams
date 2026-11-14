// src/controllers/rejectionController.js
//
// KPT 9.9 – a student rejects his semester result (COE records it, with the
// HOD's forwarding / Dean (Academic)'s approval as the reference):
//   - this semester's courses of that exam are marked rejected: kept for the
//     record, not counted (no CGPA, no credits, no back paper); project work stays
//   - he goes back to that semester as Inactive – he repeats it after
//     readmission (odd) / in the next academic year (even); the Admin makes
//     him Active again when he rejoins
// Can be undone by the COE (e.g. recorded for the wrong student).

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import Student from "../models/Student.js";
import CourseResult from "../models/CourseResult.js";
import { audit } from "../models/AuditLog.js";
import { rejectionCheck } from "../services/exams/rejection.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";

async function publishedExam(res, id) {
  if (!isId(id)) return fail(res, 400, "Invalid exam id."), null;
  const exam = await Exam.findById(id).select("name academicYear results").lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  if (!exam.results?.publishedAt) return fail(res, 409, "A result can be rejected only after it is published."), null;
  return exam;
}

// his rejections in other exams
const earlierOf = (studentId, regId) =>
  ExamRegistration.find({ student: studentId, _id: { $ne: regId }, "rejection.at": { $ne: null } }).select("rejection exam").lean();

const caseView = (r) => ({
  _id: r._id,
  registerNumber: r.registerNumber,
  name: r.name,
  department: r.department,
  semester: r.semester,
  rejection: r.rejection,
});

// GET /api/result-rejection/exams/:examId
export const listRejections = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const regs = await ExamRegistration.find({ exam: exam._id, "rejection.at": { $ne: null } }).select("registerNumber name department semester rejection").sort({ registerNumber: 1 }).lean();
  res.json({ exam: { _id: exam._id, name: exam.name, publishedAt: exam.results.publishedAt }, data: regs.map(caseView) });
};

// GET /api/result-rejection/exams/:examId/student?registerNumber=   – what would be rejected, or why not
export const checkRejection = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const registerNumber = String(req.query.registerNumber || "").trim().toUpperCase();
  const reg = await ExamRegistration.findOne({ exam: exam._id, registerNumber }).lean();
  if (!reg) return fail(res, 404, `${registerNumber || "This student"} did not write this exam.`);
  if (reg.rejection?.at) return res.json({ student: caseView(reg), already: true, check: { ok: false, errors: ["Already rejected in this exam."], codes: reg.rejection.codes, kept: [] } });
  const check = rejectionCheck(reg, await earlierOf(reg.student, reg._id), { publishedAt: exam.results.publishedAt });
  const courses = (reg.result?.courses || []).map((c) => ({ code: c.code, name: c.name, semester: c.semester, kind: c.kind, grade: c.grade, status: c.status }));
  res.json({ student: caseView(reg), result: { sgpa: reg.result?.sgpa ?? null, cgpa: reg.result?.cgpa ?? null, outcome: reg.result?.outcome || null }, courses, check });
};

// POST /api/result-rejection/exams/:examId   { registerNumber, reference }
export const rejectResult = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const reference = String(req.body?.reference || "").trim().slice(0, 300);
  if (reference.length < 3) return fail(res, 400, "Write the HOD's forwarding / Dean (Academic)'s approval reference (KPT 9.9).");
  const registerNumber = String(req.body?.registerNumber || "").trim().toUpperCase();
  const reg = await ExamRegistration.findOne({ exam: exam._id, registerNumber });
  if (!reg) return fail(res, 404, `${registerNumber} did not write this exam.`);
  if (reg.rejection?.at) return fail(res, 409, "Already rejected in this exam.");
  const check = rejectionCheck(reg.toObject(), await earlierOf(reg.student, reg._id), { publishedAt: exam.results.publishedAt });
  if (!check.ok) return fail(res, 409, check.errors.join(" "));

  const student = await Student.findById(reg.student).select("semester status").lean();
  reg.rejection = {
    semester: reg.semester,
    codes: check.codes,
    reference,
    by: who(req),
    at: new Date(),
    before: { semester: student?.semester ?? null, status: student?.status || "" },
  };
  await reg.save();
  await CourseResult.updateMany({ exam: exam._id, student: reg.student, code: { $in: check.codes } }, { $set: { rejected: true } });
  // back to that semester, inactive until he rejoins
  await Student.updateOne({ _id: reg.student }, { $set: { semester: reg.semester, status: "inactive" } });

  await audit(req, "RESULT_REJECTED", exam._id, { registerNumber, semester: reg.semester, codes: check.codes, kept: check.kept, reference });
  res.json({
    data: caseView(reg.toObject()),
    message: `${registerNumber}: semester ${reg.semester} result rejected (${check.codes.length} course${check.codes.length > 1 ? "s" : ""}${
      check.kept.length ? `; project work ${check.kept.join(", ")} kept` : ""
    }). He is back in semester ${reg.semester} as Inactive – make him Active in Students when he rejoins to repeat it.`,
  });
};

// DELETE /api/result-rejection/exams/:examId/:regId   – undo (recorded by mistake)
export const undoRejection = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  if (!isId(req.params.regId)) return fail(res, 400, "Invalid id.");
  const reg = await ExamRegistration.findOne({ _id: req.params.regId, exam: exam._id });
  if (!reg?.rejection?.at) return fail(res, 404, "No rejection to undo.");
  const { codes, before } = reg.rejection;
  await CourseResult.updateMany({ exam: exam._id, student: reg.student, code: { $in: codes } }, { $set: { rejected: false } });
  // only if nobody has changed him since
  if (before?.status)
    await Student.updateOne({ _id: reg.student, status: "inactive", semester: reg.rejection.semester }, { $set: { semester: before.semester, status: before.status } });
  reg.rejection = { semester: null, codes: [], reference: "", by: "", at: null, before: { semester: null, status: "" } };
  await reg.save();
  await audit(req, "RESULT_REJECTION_UNDONE", exam._id, { registerNumber: reg.registerNumber, codes });
  res.json({ message: `Rejection undone for ${reg.registerNumber}; his result counts again.` });
};
