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
import Student from "../models/Student.js";
import CourseResult from "../models/CourseResult.js";
import AuditLog from "../models/AuditLog.js";
import { studentResult, MAX_MODERATION, caughtSubjects, MALPRACTICE_LABEL, progressionFor } from "../services/exams/results.js";
import { collegeFilter } from "../services/evening.js";

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
async function compute(exam, moderation, only = {}) {
  const regs = await ExamRegistration.find({ exam: exam._id, "subjects.0": { $exists: true }, ...only }).lean();
  const earlier = await CourseResult.find({ student: { $in: regs.map((r) => r.student) }, exam: { $ne: exam._id }, rejected: { $ne: true } })
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
      kind: ["BRIDGE", "AUDIT"].includes(subject?.subjectCategory) ? subject.subjectCategory : "REGULAR",
    });
  }

  const subjectOf = (id) => subjects.get(String(id));
  return regs.map((reg) => ({ reg, result: studentResult(reg, subjectOf, past.get(String(reg.student)), { moderation }) }));
}

// What is still missing, grouped by subject
// What is still missing, grouped by COURSE – code and name (not the code alone: two different
// courses may share a code, e.g. 25SD3100 in AT and in the other branches).
// Split: students writing it as a course of their own class -> by semester
// and department; students writing it as a BACK PAPER (failed / NE / absent
// earlier) -> listed by name, with their department and present semester.
function issuesOf(computed) {
  const map = new Map();
  for (const { reg, result } of computed) {
    const dept = String(reg.department || "").toUpperCase();
    for (const c of result.courses) {
      if (c.status !== "INCOMPLETE") continue;
      const k = `${c.code}|${String(c.name || "").trim().toLowerCase()}|${c.note}`;
      if (!map.has(k)) map.set(k, { code: c.code, name: c.name, semester: c.semester, note: c.note, students: 0, bySemester: {}, backPapers: [], departments: new Set() });
      const x = map.get(k);
      x.students++;
      x.departments.add(dept);
      if (c.kind === "BACKLOG") {
        x.backPapers.push({ registerNumber: reg.registerNumber, name: reg.name, department: dept, semester: reg.semester, backPapersOnly: ["backlog", "manual"].includes(reg.group) });
      } else {
        const sem = String(reg.semester ?? c.semester ?? "–");
        x.bySemester[sem] ||= {};
        x.bySemester[sem][dept] = (x.bySemester[sem][dept] || 0) + 1;
      }
    }
  }
  return [...map.values()]
    .map(({ departments, ...x }) => ({
      ...x,
      departments: [...departments].sort(),
      backPapers: x.backPapers.sort((a, b) => a.registerNumber.localeCompare(b.registerNumber)),
    }))
    .sort((a, b) => (a.semester || 0) - (b.semester || 0) || a.code.localeCompare(b.code) || a.name.localeCompare(b.name));
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
  const filter = { exam: exam._id, "result.processedAt": { $ne: null }, ...collegeFilter(req.query) };
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
    .sort({ semester: 1, department: 1, rollNumber: 1, registerNumber: 1 })
    .collation({ locale: "en", numericOrdering: true })
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
  // malpractice PEC / PEC+ (KPT 10.2): not promoted – Detained from now on
  const detained = await detainFor(computed.map(({ reg }) => reg));
  // vertical progression (KPT 9.3): promoted to the next semester, or detained
  const prog = await progressAfterResults(exam, computed);
  await log(req, "RESULTS_PUBLISHED", exam._id, { students: computed.length, subjects: docs.length, detained, progression: prog });
  res.json({
    message: `Results published for ${computed.length} students. The exam is now completed. ${prog.promoted} promoted to the next semester, ${prog.detained.length} detained (KPT 9.3)${
      prog.undecided.length ? `, ${prog.undecided.length} not decided (result withheld)` : ""
    }.`,
    progression: prog,
  });
};

// ====================================================================
// Malpractice decisions (KPT 10.2) – COE
// ====================================================================

const NOT_PROMOTED = ["PEC", "PEC_PLUS"];
// Students whose decision means "not promoted": active -> detained
async function detainFor(regs) {
  const ids = regs.filter((r) => NOT_PROMOTED.includes(r.malpractice?.decision)).map((r) => r.student);
  if (!ids.length) return 0;
  const out = await Student.updateMany({ _id: { $in: ids }, status: "active" }, { $set: { status: "detained" } });
  return out.modifiedCount || 0;
}

const caseView = (r) => ({
  _id: r._id,
  registerNumber: r.registerNumber,
  name: r.name,
  department: r.department,
  semester: r.semester,
  group: r.group,
  caught: caughtSubjects(r).map((s) => ({
    code: s.code,
    name: s.name,
    semester: s.semester,
    parts: [s.see?.attendance === "MALPRACTICE" && "Theory", s.practical?.attendance === "MALPRACTICE" && "Practical"].filter(Boolean),
  })),
  subjects: (r.subjects || []).map((s) => ({ code: s.code, name: s.name, semester: s.semester, kind: s.kind })),
  malpractice: r.malpractice || null,
});

// GET /api/exams/:id/malpractice   – everyone caught in this exam, with the decision
export const listMalpractice = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  const regs = await ExamRegistration.find({
    exam: exam._id,
    $or: [{ "subjects.see.attendance": "MALPRACTICE" }, { "subjects.practical.attendance": "MALPRACTICE" }, { "malpractice.decision": { $ne: null } }],
  })
    .select("registerNumber name department semester group subjects malpractice student")
    .sort({ registerNumber: 1 })
    .lean();
  res.json({ data: regs.map(caseView), published: Boolean(exam.results?.publishedAt) });
};

// POST /api/exams/:id/registrations/:regId/malpractice
//   { decision: "PSC" | "PEC" | "PEC_PLUS" | "" (remove), subjects: ["25CS11T0"], reference, debarExams, note }
export const saveMalpractice = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  if (!isId(req.params.regId)) return fail(res, 400, "Invalid id.");
  const reg = await ExamRegistration.findOne({ _id: req.params.regId, exam: exam._id });
  if (!reg) return fail(res, 404, "Registration not found.");

  const decision = String(req.body?.decision || "").toUpperCase();
  const before = reg.malpractice?.decision || "";
  if (!decision) {
    reg.malpractice = null;
  } else {
    if (!MALPRACTICE_LABEL[decision]) return fail(res, 400, "Choose PSC, PEC or PEC+.");
    const reference = String(req.body?.reference || "").trim().slice(0, 200);
    if (reference.length < 3) return fail(res, 400, "Write the committee's (MPEC) reference – proceedings number or date.");
    const caught = caughtSubjects(reg);
    const codes = new Set((reg.subjects || []).map((s) => s.code));
    let subjects = [];
    let semesters = [];
    if (decision === "PSC") {
      subjects = [...new Set((Array.isArray(req.body?.subjects) ? req.body.subjects : []).map(String))].filter((c) => codes.has(c));
      if (!subjects.length) subjects = caught.map((s) => s.code);
      if (!subjects.length) return fail(res, 400, "Tick the subject(s) whose performance is cancelled.");
    }
    if (decision === "PEC") {
      semesters = [...new Set((caught.length ? caught : reg.subjects).map((s) => Number(s.semester)).filter(Boolean))];
      if (!semesters.length) return fail(res, 400, "No semester found for this student.");
    }
    const debar = req.body?.debarExams === "" || req.body?.debarExams == null ? null : Number(req.body.debarExams);
    if (debar !== null && !(Number.isInteger(debar) && debar >= 1 && debar <= 8)) return fail(res, 400, "Debarred for: 1 to 8 examinations, or leave it empty.");
    reg.malpractice = {
      decision,
      subjects,
      semesters,
      reference,
      debarExams: decision === "PEC_PLUS" ? debar : null,
      note: String(req.body?.note || "").trim().slice(0, 500),
      by: who(req),
      at: new Date(),
    };
  }
  await reg.save();

  // Results already published (the Admin, with a reason): the published
  // result of this student is corrected now, and PEC / PEC+ detain him now
  let republished = false;
  let detained = 0;
  if (exam.results?.publishedAt) {
    const out = await republishStudent(exam, reg._id, { progression: false });
    if (out) {
      republished = true;
      detained = await detainFor([reg.toObject()]);
    }
  }

  await log(req, "MALPRACTICE_DECISION", exam._id, {
    registration: reg._id,
    registerNumber: reg.registerNumber,
    decision: decision || "removed",
    before: before || null,
    subjects: reg.malpractice?.subjects,
    semesters: reg.malpractice?.semesters,
    reference: reg.malpractice?.reference,
    debarExams: reg.malpractice?.debarExams ?? null,
    republished,
    detained,
  });
  const label = decision ? MALPRACTICE_LABEL[decision] : "";
  res.json({
    data: caseView(reg.toObject()),
    message: decision
      ? `${label} recorded for ${reg.registerNumber}.${republished ? " The published result is corrected." : " It is applied when the results are processed."}${
          NOT_PROMOTED.includes(decision) ? (republished ? " He is now Detained." : " He becomes Detained when the results are published.") : ""
        }`
      : `Decision removed for ${reg.registerNumber}.`,
  });
};

// ====================================================================
// Vertical progression (KPT 9.3) – when the results are published
// ====================================================================

// Credits passed so far, per student and semester: the latest result of each
// subject (back papers cleared count); bridge and audit courses not counted
async function earnedBySemester(studentIds) {
  const rows = await CourseResult.find({ student: { $in: studentIds }, rejected: { $ne: true } }).select("student subject semester status credit declaredAt").lean();
  const cats = new Map(
    (await Subject.find({ _id: { $in: [...new Set(rows.map((r) => String(r.subject)))] } }).select("subjectCategory credit semester").lean()).map((s) => [String(s._id), s])
  );
  const latest = new Map();
  for (const r of rows) {
    const k = `${r.student}|${r.subject}`;
    const prev = latest.get(k);
    if (!prev || new Date(r.declaredAt) > new Date(prev.declaredAt)) latest.set(k, r);
  }
  const out = new Map();
  for (const r of latest.values()) {
    if (r.status !== "PASS") continue;
    const subject = cats.get(String(r.subject));
    if (["BRIDGE", "AUDIT"].includes(String(subject?.subjectCategory || "").toUpperCase())) continue;
    const sem = Number(r.semester ?? subject?.semester);
    const credit = Number(r.credit ?? subject?.credit) || 0;
    if (!sem || !credit) continue;
    const sid = String(r.student);
    if (!out.has(sid)) out.set(sid, {});
    out.get(sid)[sem] = (out.get(sid)[sem] || 0) + credit;
  }
  return out;
}

// Students of the exam's classes (not the back-paper group) who are still
// active in the semester they wrote: next semester, or Detained.
async function progressAfterResults(exam, computed) {
  const summary = { promoted: 0, detained: [], undecided: [] };
  const mine = computed.filter(({ reg }) => !["backlog", "manual"].includes(reg.group) && exam.semesters.includes(Number(reg.semester)));
  if (!mine.length) return summary;
  const students = new Map(
    (await Student.find({ _id: { $in: mine.map(({ reg }) => reg.student) }, status: "active" }).select("semester").lean()).map((s) => [String(s._id), s])
  );
  const earned = await earnedBySemester([...students.keys()]);
  const studentOps = [];
  const regOps = [];
  for (const { reg, result } of mine) {
    const st = students.get(String(reg.student));
    // already detained (e.g. malpractice), or his semester changed meanwhile
    if (!st || Number(st.semester) !== Number(reg.semester)) continue;
    const p = progressionFor(reg.semester, earned.get(String(reg.student)) || {}, result.cgpa);
    const toSemester = p.decision === "PROMOTE" ? Number(reg.semester) + 1 : null;
    if (p.decision === "PROMOTE") {
      studentOps.push({ updateOne: { filter: { _id: reg.student, status: "active", semester: Number(reg.semester) }, update: { $set: { semester: toSemester } } } });
      summary.promoted++;
    } else if (p.decision === "DETAIN") {
      studentOps.push({ updateOne: { filter: { _id: reg.student, status: "active", semester: Number(reg.semester) }, update: { $set: { status: "detained" } } } });
      summary.detained.push(reg.registerNumber);
    } else if (p.decision === "UNDECIDED") summary.undecided.push(reg.registerNumber);
    regOps.push({
      updateOne: {
        filter: { _id: reg._id },
        update: { $set: { "result.progression": { decision: p.decision, earned: p.earned ?? null, required: p.required ?? null, toSemester, note: p.note || "" } } },
      },
    });
  }
  if (studentOps.length) await Student.bulkWrite(studentOps, { ordered: false });
  if (regOps.length) await ExamRegistration.bulkWrite(regOps, { ordered: false });
  return summary;
}

// ====================================================================
// Grade cards (KPT 9.7) – after the results are published
// ====================================================================

// GET /api/exams/:id/grade-cards?department=&semester=&college=&q=
export const gradeCards = async (req, res) => {
  const exam = await loadExam(req, res);
  if (!exam) return;
  if (!exam.results?.publishedAt) return fail(res, 409, "Grade cards are printed after the results are published.");
  const { department, semester, q } = req.query;
  const filter = { exam: exam._id, "result.processedAt": { $ne: null }, ...collegeFilter(req.query) };
  if (department === "backlog") filter.group = { $in: ["backlog", "manual"] };
  else {
    if (department) filter.department = String(department).toLowerCase();
    if (semester) filter.semester = Number(semester);
    if (department || semester) filter.group = { $nin: ["backlog", "manual"] };
  }
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { registerNumber: rx }];
  }
  const regs = await ExamRegistration.find(filter)
    .select("student registerNumber name department semester batch admissionType imageUrl group result rejection")
    .sort({ semester: 1, department: 1, rollNumber: 1, registerNumber: 1 })
    .collation({ locale: "en", numericOrdering: true })
    .limit(400)
    .lean();
  const info = new Map(
    (await Student.find({ _id: { $in: regs.map((r) => r.student) } }).select("fatherName imageUrl").lean()).map((s) => [String(s._id), s])
  );
  await log(req, "GRADE_CARDS_PRINTED", exam._id, { count: regs.length, department: department || "", semester: semester || "", q: q || "" });
  res.json({
    exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, publishedAt: exam.results.publishedAt },
    data: regs.map((r) => {
      const st = info.get(String(r.student)) || {};
      return {
        _id: r._id,
        registerNumber: r.registerNumber,
        name: r.name,
        fatherName: st.fatherName || "",
        imageUrl: st.imageUrl || r.imageUrl || "",
        department: r.department,
        semester: r.semester,
        batch: r.batch,
        admissionType: r.admissionType,
        backPapersOnly: ["backlog", "manual"].includes(r.group),
        rejection: r.rejection?.at ? { semester: r.rejection.semester, codes: r.rejection.codes } : null,
        result: {
          // moderation marks are confidential – not on the card
          courses: (r.result?.courses || []).map(({ moderation, ...c }) => c),
          sgpa: r.result?.sgpa ?? null,
          cgpa: r.result?.cgpa ?? null,
          credits: r.result?.credits || { registered: 0, earned: 0 },
          outcome: r.result?.outcome || null,
          progression: r.result?.progression || null,
        },
      };
    }),
  });
};

// ====================================================================
// One student's published result worked out again (malpractice decision
// after publishing, revaluation): his registration result, his
// CourseResults (back papers, CGPA) and – with progression – a student who
// was detained under KPT 9.3 but now qualifies is promoted. Nobody is
// demoted here; that is reported for the COE to look at.
//   -> { before, after, promoted, wouldDetain } or null
// ====================================================================
export async function republishStudent(exam, regId, { progression = true } = {}) {
  const [one] = await compute(exam, exam.results?.moderationMarks || 0, { _id: regId });
  if (!one) return null;
  const { reg, result } = one;
  const before = reg.result || {};
  const at = new Date();
  const kept = before.progression || null;
  await ExamRegistration.updateOne({ _id: reg._id }, { $set: { result: { ...result, processedAt: at, ...(kept ? { progression: kept } : {}) } } });
  await CourseResult.deleteMany({ exam: exam._id, student: reg.student, source: "RESULT" });
  const rejectedCodes = new Set(reg.rejection?.codes || []);
  await CourseResult.insertMany(
    result.courses.map((c) => ({
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
      declaredAt: exam.results?.publishedAt || at,
      source: "RESULT",
      rejected: rejectedCodes.has(c.code),
    })),
    { ordered: false }
  );

  let promoted = false;
  let wouldDetain = false;
  if (progression && kept?.decision && kept.decision !== "NONE") {
    const earned = (await earnedBySemester([reg.student])).get(String(reg.student)) || {};
    const p = progressionFor(reg.semester, earned, result.cgpa);
    if (kept.decision === "DETAIN" && p.decision === "PROMOTE") {
      const out = await Student.updateOne(
        { _id: reg.student, status: "detained", semester: Number(reg.semester) },
        { $set: { status: "active", semester: Number(reg.semester) + 1 } }
      );
      promoted = Boolean(out.modifiedCount);
      if (promoted)
        await ExamRegistration.updateOne(
          { _id: reg._id },
          { $set: { "result.progression": { decision: "PROMOTE", earned: p.earned, required: p.required, toSemester: Number(reg.semester) + 1, note: `${p.note} (after revaluation)` } } }
        );
    } else if (kept.decision === "PROMOTE" && p.decision === "DETAIN") wouldDetain = true;
  }
  return { before: before.outcome || null, after: result.outcome, sgpa: result.sgpa, cgpa: result.cgpa, promoted, wouldDetain };
}
