// src/controllers/specialExamController.js
//
// KPT 6.2.5 – special examinations for students on official NCC / NSS /
// Red Cross / sports / cultural duty during the regular examination.
//   COE : records the application (activity, participation order, the
//         papers that clash); where his attendance is short because of the
//         duty, he is kept eligible (KPT 6.2.5 b – the COE's override, with
//         the reason written);
//         after the special exam, enters its marks. They are entered only
//         after the regular paper is decoded, so decoding never overwrites them.
// Not a re-examination: the marks count like the regular paper's.

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import ValuationPaper from "../models/ValuationPaper.js";
import SpecialExam from "../models/SpecialExam.js";
import { audit } from "../models/AuditLog.js";
import { effectiveOf } from "../services/exams/rules.js";
import { reduce } from "../services/exams/valuation.js";
import { recount } from "./examController.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";
export const ACTIVITY = { NCC: "NCC", NSS: "NSS", RED_CROSS: "Red Cross", SPORTS: "Sports", CULTURAL: "Cultural" };

async function openExam(res, id) {
  if (!isId(id)) return fail(res, 400, "Invalid exam id."), null;
  const exam = await Exam.findById(id).select("name academicYear results").lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  return exam;
}
const notPublished = (res, exam) => (exam.results?.publishedAt ? (fail(res, 409, "The results of this exam are published – it can no longer change."), false) : true);

// GET /api/special-exams/exams/:examId
export const listSpecial = async (req, res) => {
  const exam = await openExam(res, req.params.examId);
  if (!exam) return;
  const list = await SpecialExam.find({ exam: exam._id }).sort({ registerNumber: 1 }).lean();
  res.json({ exam: { _id: exam._id, name: exam.name, published: Boolean(exam.results?.publishedAt) }, data: list });
};

// GET /api/special-exams/exams/:examId/student?registerNumber=
export const studentForSpecial = async (req, res) => {
  const exam = await openExam(res, req.params.examId);
  if (!exam) return;
  const registerNumber = String(req.query.registerNumber || "").trim().toUpperCase();
  const reg = await ExamRegistration.findOne({ exam: exam._id, registerNumber }).lean();
  if (!reg) return fail(res, 404, `${registerNumber || "This student"} is not registered for this exam.`);
  res.json({
    student: { registerNumber: reg.registerNumber, name: reg.name, department: reg.department, semester: reg.semester },
    papers: (reg.subjects || [])
      .filter((s) => s.hasTheory)
      .map((s) => ({ code: s.code, name: s.name, semester: s.semester, kind: s.kind, status: effectiveOf(s), attendancePct: s.attendancePct ?? null })),
  });
};

// POST /api/special-exams/exams/:examId
//   { registerNumber, activity, orderRef, event, codes: [...], condone: [...codes whose ANS is because of the duty] }
export const addSpecial = async (req, res) => {
  const exam = await openExam(res, req.params.examId);
  if (!exam || !notPublished(res, exam)) return;
  const activity = String(req.body?.activity || "").toUpperCase();
  if (!ACTIVITY[activity]) return fail(res, 400, "Choose NCC, NSS, Red Cross, Sports or Cultural.");
  const orderRef = String(req.body?.orderRef || "").trim().slice(0, 200);
  if (orderRef.length < 3) return fail(res, 400, "Write the official participation order (KPT 6.2.5 c).");
  const registerNumber = String(req.body?.registerNumber || "").trim().toUpperCase();
  const reg = await ExamRegistration.findOne({ exam: exam._id, registerNumber });
  if (!reg) return fail(res, 404, `${registerNumber} is not registered for this exam.`);
  const codes = [...new Set((Array.isArray(req.body?.codes) ? req.body.codes : []).map(String))];
  const papers = reg.subjects.filter((s) => s.hasTheory && codes.includes(s.code));
  if (!papers.length) return fail(res, 400, "Tick the paper(s) that clash with the duty.");
  const condone = new Set((Array.isArray(req.body?.condone) ? req.body.condone : []).map(String));

  // KPT 6.2.5 b: attendance short because of the duty – he stays eligible
  const reason = `KPT 6.2.5 – ${ACTIVITY[activity]} duty (${orderRef})`;
  const condoned = [];
  for (const s of papers) {
    if (condone.has(s.code) && effectiveOf(s) === "ANS") {
      s.override = { status: "ELIGIBLE", reason, by: who(req), at: new Date() };
      condoned.push(s.code);
    }
  }
  if (condoned.length) {
    recount(reg);
    await reg.save();
  }

  try {
    const doc = await SpecialExam.create({
      exam: exam._id,
      registration: reg._id,
      student: reg.student,
      registerNumber: reg.registerNumber,
      name: reg.name,
      department: reg.department,
      activity,
      orderRef,
      event: String(req.body?.event || "").trim().slice(0, 200),
      papers: papers.map((s) => ({ code: s.code, name: s.name, semester: s.semester, condoned: condoned.includes(s.code) })),
      createdBy: who(req),
    });
    await audit(req, "SPECIAL_EXAM_GRANTED", exam._id, { registerNumber, activity, orderRef, codes: papers.map((s) => s.code), condoned });
    res.status(201).json({
      data: doc,
      message: `Special exam recorded for ${registerNumber}: ${papers.map((s) => s.code).join(", ")}.${condoned.length ? ` Kept eligible despite attendance: ${condoned.join(", ")}.` : ""}`,
    });
  } catch (e) {
    if (e?.code === 11000) return fail(res, 409, `${registerNumber} already has a special exam in this examination – change that one.`);
    throw e;
  }
};

// POST /api/special-exams/:id/marks   { code, raw }   – after the special exam
export const specialMarks = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const doc = await SpecialExam.findById(req.params.id);
  if (!doc) return fail(res, 404, "Not found.");
  const exam = await Exam.findById(doc.exam).select("results").lean();
  if (!notPublished(res, exam)) return;
  const code = String(req.body?.code || "");
  const p = doc.papers.find((x) => x.code === code);
  if (!p) return fail(res, 400, `${code} is not one of his special-exam papers.`);
  const paper = await ValuationPaper.findOne({ exam: doc.exam, code }).select("rawMax seeMax decoded").lean();
  if (!paper?.decoded) return fail(res, 409, `Enter the special exam marks after ${code} is decoded in valuation (otherwise decoding would overwrite them).`);
  const raw = req.body?.raw === "" || req.body?.raw == null ? null : Number(req.body.raw);
  const rawMax = paper.rawMax || 100;
  if (raw === null || !Number.isFinite(raw) || raw < 0 || raw > rawMax) return fail(res, 400, `Marks must be from 0 to ${rawMax}.`);
  const marks = reduce(raw, rawMax, paper.seeMax);
  await ExamRegistration.updateOne(
    { _id: doc.registration },
    { $set: { "subjects.$[x].see": { attendance: "PRESENT", raw, marks, decodedAt: new Date() } } },
    { arrayFilters: [{ "x.code": code }] }
  );
  Object.assign(p, { raw, rawMax, marks, enteredBy: who(req), enteredAt: new Date() });
  await doc.save();
  await audit(req, "SPECIAL_EXAM_MARKS", doc.exam, { registerNumber: doc.registerNumber, code, raw, marks });
  res.json({ data: doc, message: `${doc.registerNumber} · ${code}: ${raw}/${rawMax} saved. Process the results again to include it.` });
};

// DELETE /api/special-exams/:id   – recorded by mistake, no marks yet (the eligibility override stays; remove it in Examinations if needed)
export const removeSpecial = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const doc = await SpecialExam.findById(req.params.id);
  if (!doc) return fail(res, 404, "Not found.");
  if (doc.papers.some((p) => p.raw !== null)) return fail(res, 409, "Marks are entered – it cannot be removed.");
  await SpecialExam.deleteOne({ _id: doc._id });
  await audit(req, "SPECIAL_EXAM_REMOVED", doc.exam, { registerNumber: doc.registerNumber });
  res.json({ message: "Removed. Any 'kept eligible' decision stays – change it in Examinations if needed." });
};
