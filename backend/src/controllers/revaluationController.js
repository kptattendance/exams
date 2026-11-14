// src/controllers/revaluationController.js
//
// After the results of an exam are published (KPT 9.8):
//   the office records applications with the fee – answer script copy,
//   in-person viewing, revaluation; the COE sets the last date, enters the
//   revaluation (a different examiner) and, when the two differ by more than
//   15 %, the third evaluation (a senior examiner). When the final marks
//   change, the student's published result is worked out again (grade,
//   SGPA, CGPA, back papers, grade card; KPT 9.3 promotion if he now qualifies).
//
// These routes are deliberately not behind the published-exam lock: they
// exist only for published exams. Everything is written to the activity log.

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import AnswerScript from "../models/AnswerScript.js";
import ValuationPaper from "../models/ValuationPaper.js";
import ValuationPacket from "../models/ValuationPacket.js";
import Revaluation from "../models/Revaluation.js";
import { audit } from "../models/AuditLog.js";
import { reduce } from "../services/exams/valuation.js";
import { cancelledBy } from "../services/exams/results.js";
import { revaluationOutcome, sameValuer } from "../services/exams/revaluation.js";
import { republishStudent } from "./resultController.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const TYPES = { COPY: "Answer script copy", VIEW: "In-person viewing", REVALUATION: "Revaluation" };
const endOfDay = (d) => new Date(new Date(d).setHours(23, 59, 59, 999));

async function publishedExam(res, id) {
  if (!isId(id)) return fail(res, 400, "Invalid exam id."), null;
  const exam = await Exam.findById(id).select("name academicYear results").lean();
  if (!exam) return fail(res, 404, "Exam not found."), null;
  if (!exam.results?.publishedAt) return fail(res, 409, "Revaluation starts after the results of this exam are published."), null;
  return exam;
}

const view = (a) => ({
  _id: a._id,
  registerNumber: a.registerNumber,
  name: a.name,
  department: a.department,
  code: a.code,
  subjectName: a.subjectName,
  subjectSemester: a.subjectSemester,
  type: a.type,
  fee: a.fee,
  status: a.status,
  rawMax: a.rawMax,
  seeMax: a.seeMax,
  original: a.original,
  reval: a.reval,
  third: a.third,
  final: a.final,
  rule: a.rule,
  changed: a.changed,
  resultBefore: a.resultBefore,
  resultAfter: a.resultAfter,
  issuedAt: a.issuedAt,
  createdAt: a.createdAt,
});

// The written papers of one student in this exam that can be asked for
async function papersOf(exam, reg) {
  const cancelled = cancelledBy(reg);
  const theory = (reg.subjects || []).filter((s) => s.see && (s.see.attendance === "PRESENT" || s.see.raw !== null));
  const codes = theory.map((s) => s.code);
  const [papers, scripts] = await Promise.all([
    ValuationPaper.find({ exam: exam._id, code: { $in: codes } }).select("code rawMax seeMax").lean(),
    AnswerScript.find({ exam: exam._id, registration: reg._id, code: { $in: codes } }).select("code dummy valuations").lean(),
  ]);
  const paperOf = new Map(papers.map((p) => [p.code, p]));
  const scriptOf = new Map(scripts.map((s) => [s.code, s]));
  return theory.map((s) => {
    const p = paperOf.get(s.code) || {};
    const sc = scriptOf.get(s.code);
    let blocked = "";
    if (s.see?.attendance !== "PRESENT") blocked = s.see?.attendance === "MALPRACTICE" ? "Malpractice case" : "Absent";
    else if (s.see?.raw === null || s.see?.raw === undefined) blocked = "No valued marks";
    else if (cancelled?.({ code: s.code, semester: s.semester })) blocked = "Performance cancelled (malpractice)";
    return {
      code: s.code,
      name: s.name,
      semester: s.semester,
      raw: s.see?.raw ?? null,
      marks: s.see?.marks ?? null,
      rawMax: p.rawMax || 100,
      seeMax: p.seeMax || 0,
      dummy: sc?.dummy || "",
      blocked,
    };
  });
}

// Valuers of the original valuation of one script (they may not revalue it)
async function originalValuers(examId, registrationId, code) {
  const sc = await AnswerScript.findOne({ exam: examId, registration: registrationId, code }).select("valuations dummy").lean();
  const ids = (sc?.valuations || []).map((v) => v.packet).filter(Boolean);
  const packets = ids.length ? await ValuationPacket.find({ _id: { $in: ids } }).select("valuer").lean() : [];
  return { valuers: [...new Set(packets.map((p) => p.valuer).filter(Boolean))], dummy: sc?.dummy || "" };
}

// GET /api/revaluation/exams/:examId
export const listApplications = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const list = await Revaluation.find({ exam: exam._id }).sort({ createdAt: -1 }).lean();
  res.json({
    exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, publishedAt: exam.results.publishedAt, lastDate: exam.results.revaluationLastDate || null },
    data: list.map(view),
  });
};

// PUT /api/revaluation/exams/:examId/last-date   { lastDate: "2027-01-10" | "" }   (COE)
export const setLastDate = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const raw = String(req.body?.lastDate || "").trim();
  const lastDate = raw ? new Date(raw) : null;
  if (raw && Number.isNaN(lastDate.getTime())) return fail(res, 400, "The date is not valid.");
  await Exam.updateOne({ _id: exam._id }, { $set: { "results.revaluationLastDate": lastDate } });
  await audit(req, "REVALUATION_LAST_DATE", exam._id, { lastDate: raw || null });
  res.json({ message: lastDate ? `Applications close on ${lastDate.toLocaleDateString("en-IN")}.` : "No last date set." });
};

// GET /api/revaluation/exams/:examId/student?registerNumber=103CS25001
export const studentPapers = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const registerNumber = String(req.query.registerNumber || "").trim().toUpperCase();
  if (!registerNumber) return fail(res, 400, "Type the register number.");
  const reg = await ExamRegistration.findOne({ exam: exam._id, registerNumber }).lean();
  if (!reg) return fail(res, 404, `${registerNumber} did not write this exam.`);
  const [papers, applied] = await Promise.all([papersOf(exam, reg), Revaluation.find({ exam: exam._id, registration: reg._id }).select("code type status").lean()]);
  res.json({ student: { registerNumber: reg.registerNumber, name: reg.name, department: reg.department, semester: reg.semester }, papers, applied });
};

// POST /api/revaluation/exams/:examId   { registerNumber, code, type, amount, receiptNo, paidOn }
export const addApplication = async (req, res) => {
  const exam = await publishedExam(res, req.params.examId);
  if (!exam) return;
  const last = exam.results.revaluationLastDate;
  if (last && Date.now() > endOfDay(last).getTime())
    return fail(res, 409, `Applications closed on ${new Date(last).toLocaleDateString("en-IN")} (KPT 9.8). The COE can change the last date.`);

  const type = String(req.body?.type || "").toUpperCase();
  if (!TYPES[type]) return fail(res, 400, "Choose copy, viewing or revaluation.");
  const registerNumber = String(req.body?.registerNumber || "").trim().toUpperCase();
  const code = String(req.body?.code || "").trim();
  const reg = await ExamRegistration.findOne({ exam: exam._id, registerNumber }).lean();
  if (!reg) return fail(res, 404, `${registerNumber} did not write this exam.`);
  const paper = (await papersOf(exam, reg)).find((p) => p.code === code);
  if (!paper) return fail(res, 400, `${code} is not a written paper of ${registerNumber} in this exam.`);
  if (paper.blocked) return fail(res, 409, `${code}: ${paper.blocked} – it cannot be asked for.`);

  const amount = req.body?.amount === "" || req.body?.amount == null ? null : Number(req.body.amount);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 100000)) return fail(res, 400, "Fee amount is not valid.");
  const receiptNo = String(req.body?.receiptNo || "").trim().slice(0, 60);
  if (!receiptNo) return fail(res, 400, "Write the fee receipt / challan number (KPT 9.8: on payment of the fee).");
  const paidOn = req.body?.paidOn ? new Date(req.body.paidOn) : new Date();
  if (Number.isNaN(paidOn.getTime())) return fail(res, 400, "Payment date is not valid.");

  try {
    const doc = await Revaluation.create({
      exam: exam._id,
      registration: reg._id,
      student: reg.student,
      registerNumber: reg.registerNumber,
      name: reg.name,
      department: reg.department,
      code,
      subjectName: paper.name,
      subjectSemester: paper.semester,
      type,
      fee: { amount, receiptNo, paidOn },
      rawMax: paper.rawMax,
      seeMax: paper.seeMax,
      original: paper.raw,
      createdBy: who(req),
    });
    await audit(req, "REVALUATION_APPLIED", exam._id, { registerNumber, code, type, receiptNo, amount });
    res.status(201).json({ data: view(doc.toObject()), message: `${TYPES[type]} recorded for ${registerNumber} · ${code}.` });
  } catch (e) {
    if (e?.code === 11000) return fail(res, 409, `${registerNumber} has already applied for ${TYPES[type].toLowerCase()} of ${code}.`);
    throw e;
  }
};

async function loadApplication(res, id) {
  if (!isId(id)) return fail(res, 400, "Invalid id."), null;
  const doc = await Revaluation.findById(id);
  if (!doc) return fail(res, 404, "Application not found."), null;
  return doc;
}

// POST /api/revaluation/:id/issue   – copy given / script shown
export const issueCopy = async (req, res) => {
  const doc = await loadApplication(res, req.params.id);
  if (!doc) return;
  if (doc.type === "REVALUATION") return fail(res, 400, "A revaluation is finished by entering its marks.");
  if (doc.status === "ISSUED") return fail(res, 409, "Already given.");
  doc.status = "ISSUED";
  doc.issuedAt = new Date();
  doc.issuedBy = who(req);
  await doc.save();
  await audit(req, "REVALUATION_COPY_ISSUED", doc.exam, { registerNumber: doc.registerNumber, code: doc.code, type: doc.type });
  res.json({ data: view(doc.toObject()), message: doc.type === "COPY" ? "Answer script copy given." : "Answer script shown." });
};

// DELETE /api/revaluation/:id   { reason }   – an application entered by mistake (COE)
export const removeApplication = async (req, res) => {
  const doc = await loadApplication(res, req.params.id);
  if (!doc) return;
  if (doc.status === "DONE" || doc.reval) return fail(res, 409, "Revaluation marks are already entered – it cannot be removed.");
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 3) return fail(res, 400, "Write why it is removed.");
  await Revaluation.deleteOne({ _id: doc._id });
  await audit(req, "REVALUATION_REMOVED", doc.exam, { registerNumber: doc.registerNumber, code: doc.code, type: doc.type, reason });
  res.json({ message: "Application removed." });
};

// POST /api/revaluation/:id/marks   { round: "REVAL" | "THIRD", marks, valuer }   (COE)
export const enterMarks = async (req, res) => {
  const doc = await loadApplication(res, req.params.id);
  if (!doc) return;
  if (doc.type !== "REVALUATION") return fail(res, 400, "Marks are entered only for a revaluation.");
  if (doc.status === "DONE") return fail(res, 409, "This revaluation is already finished.");
  const round = String(req.body?.round || "REVAL").toUpperCase();
  if (round === "THIRD" && doc.status !== "NEEDS_THIRD") return fail(res, 409, "A third evaluation is needed only when the revaluation differs by more than 15 %.");
  if (round === "REVAL" && doc.reval) return fail(res, 409, "Revaluation marks are already entered.");

  const marks = Number(req.body?.marks);
  if (req.body?.marks === "" || req.body?.marks == null || !Number.isFinite(marks) || marks < 0 || marks > doc.rawMax)
    return fail(res, 400, `Marks must be from 0 to ${doc.rawMax}.`);
  const valuer = String(req.body?.valuer || "").trim().slice(0, 100);
  if (valuer.length < 2) return fail(res, 400, round === "THIRD" ? "Write the senior examiner's name." : "Write the examiner's name.");

  // KPT 9.8.2 b: a different examiner (and the third one differs from both)
  const { valuers } = await originalValuers(doc.exam, doc.registration, doc.code);
  if (valuers.some((v) => sameValuer(v, valuer))) return fail(res, 400, `${valuer} valued this script before – a different examiner must revalue it.`);
  if (round === "THIRD" && sameValuer(doc.reval?.valuer, valuer)) return fail(res, 400, `${valuer} did the revaluation – the third evaluation needs another (senior) examiner.`);

  const entry = { marks, valuer, at: new Date(), by: who(req) };
  if (round === "THIRD") doc.third = entry;
  else doc.reval = entry;

  const out = revaluationOutcome({ original: doc.original, reval: doc.reval?.marks, third: doc.third?.marks }, { rawMax: doc.rawMax });
  if (out.status === "NEEDS_THIRD") {
    doc.status = "NEEDS_THIRD";
    await doc.save();
    await audit(req, "REVALUATION_MARKS", doc.exam, { registerNumber: doc.registerNumber, code: doc.code, round, marks, valuer, outcome: "NEEDS_THIRD" });
    return res.json({ data: view(doc.toObject()), message: `${out.reason}` });
  }
  if (out.status !== "DONE") return fail(res, 409, out.reason || "Marks are missing.");

  doc.final = out.final;
  doc.rule = out.rule;
  doc.status = "DONE";
  doc.changed = Number(out.final) !== Number(doc.original);

  let message = `Revaluation finished: ${doc.original} → ${out.final} (out of ${doc.rawMax}).`;
  if (doc.changed) {
    // the student's theory marks and his published result
    const exam = await Exam.findById(doc.exam).lean();
    await ExamRegistration.updateOne(
      { _id: doc.registration },
      { $set: { "subjects.$[x].see.raw": out.final, "subjects.$[x].see.marks": reduce(out.final, doc.rawMax, doc.seeMax) } },
      { arrayFilters: [{ "x.code": doc.code }] }
    );
    const r = await republishStudent(exam, doc.registration);
    doc.resultBefore = r?.before || "";
    doc.resultAfter = r?.after || "";
    message += ` Result now ${r?.after || "—"} (SGPA ${r?.sgpa ?? "—"}, CGPA ${r?.cgpa ?? "—"}); the grade card shows the new marks.`;
    if (r?.promoted) message += " He now meets KPT 9.3 and is promoted to the next semester.";
    if (r?.wouldDetain) message += " Note: with these marks he would not meet KPT 9.3 – he was already promoted; please check.";
  } else message += " The marks stay as they were.";
  await doc.save();
  await audit(req, "REVALUATION_MARKS", doc.exam, {
    registerNumber: doc.registerNumber,
    code: doc.code,
    round,
    marks,
    valuer,
    original: doc.original,
    final: doc.final,
    rule: doc.rule,
    changed: doc.changed,
    resultBefore: doc.resultBefore,
    resultAfter: doc.resultAfter,
  });
  res.json({ data: view(doc.toObject()), message });
};
