// src/controllers/examController.js
//
// Examinations, automatic registration and eligibility.
//
//  1. COE creates an exam (name, academic year, semesters, back-paper rule).
//  2. "Register students" splits the work into groups (one per department +
//     semester, plus one for back-paper-only students) and the browser calls
//     /process repeatedly until every group is DONE. Each call works for at
//     most ~7 seconds so it fits Vercel's time limit.
//  3. For every student the software decides the subjects (regular, bridge
//     for his lateral type, chosen electives, back papers) and whether he may
//     write each one, from the HOD's Final IA and Final attendance.
//  4. The COE can override a decision (with a reason) or add back papers by
//     hand. Refreshing keeps those changes.

import mongoose from "mongoose";
import XLSX from "xlsx";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import StudentElective from "../models/StudentElective.js";
import CourseResult from "../models/CourseResult.js";
import AuditLog from "../models/AuditLog.js";
import { getAcademicYear } from "../services/academicYear.js";
import {
  ADMISSION_LABEL,
  normalizeAdmissionTypes,
  batchStartYear,
  pickScheme,
  currentSubjectsFor,
  backlogsFrom,
  backPaperAllowed,
  eligibilityFor,
  backlogEligibility,
  summarize,
  mergeSubjects,
  effectiveOf,
  hasTheoryPaper,
  hasPracticalExam,
  examGroupKey,
  isIncomplete,
  feeSummary,
} from "../services/exams/rules.js";

const DEPARTMENTS = ["at", "ch", "ce", "cs", "ec", "ee", "me", "ps"];
const LOCK_MS = 25_000;
const BUDGET_MS = 7_000;
// Students who may still have back papers
const BACKLOG_STATUSES = ["active", "detained", "passed"];

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const ci = (v) => new RegExp(`^${String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

const logAction = (req, action, entityId, details = {}) =>
  AuditLog.create({
    action,
    entity: "Exam",
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

const actor = (req) => req.user?.email || req.user?.id || "unknown";

// ====================================================================
// Exams
// ====================================================================

function readExamBody(body, { partial = false } = {}) {
  const out = {};
  const errors = [];
  if (!partial || body.name !== undefined) {
    out.name = String(body.name || "").trim();
    if (out.name.length < 3) errors.push("Give the exam a name, e.g. Nov/Dec 2026 Semester End Exam.");
  }
  if (!partial || body.academicYear !== undefined) {
    out.academicYear = String(body.academicYear || "").trim();
    if (!/^\d{4}-\d{2}$/.test(out.academicYear)) errors.push("Academic year must look like 2026-27.");
  }
  if (!partial || body.semesters !== undefined) {
    const sems = [...new Set((Array.isArray(body.semesters) ? body.semesters : []).map(Number))]
      .filter((s) => s >= 1 && s <= 6)
      .sort();
    if (!sems.length) errors.push("Choose at least one semester.");
    out.semesters = sems;
  }
  if (!partial || body.backPapers !== undefined) {
    out.backPapers = ["SAME_PARITY", "ALL", "NONE"].includes(body.backPapers) ? body.backPapers : "SAME_PARITY";
  }
  if (!partial || body.minAttendance !== undefined) {
    const m = body.minAttendance === undefined || body.minAttendance === "" ? 75 : Number(body.minAttendance);
    if (!(m >= 0 && m <= 100)) errors.push("Minimum attendance must be between 0 and 100.");
    out["settings.minAttendance"] = m;
  }
  return { out, errors };
}

function examView(exam, extra = {}) {
  const e = exam.toObject ? exam.toObject() : exam;
  const groups = e.generation?.groups || [];
  const running = groups.some((g) => g.state === "PENDING");
  return {
    _id: e._id,
    name: e.name,
    academicYear: e.academicYear,
    semesters: e.semesters,
    backPapers: e.backPapers,
    minAttendance: e.settings?.minAttendance ?? 75,
    status: e.status,
    createdAt: e.createdAt,
    createdByEmail: e.createdByEmail,
    generation: {
      running,
      total: groups.length,
      done: groups.filter((g) => g.state !== "PENDING").length,
      failed: groups.filter((g) => g.state === "FAILED").map((g) => ({ key: g.key, error: g.error })),
      startedAt: e.generation?.startedAt,
      finishedAt: e.generation?.finishedAt,
    },
    ...extra,
  };
}

// GET /api/exams
export const listExams = async (req, res) => {
  const exams = await Exam.find().sort({ createdAt: -1 }).lean();
  const stats = await ExamRegistration.aggregate([
    { $match: { exam: { $in: exams.map((e) => e._id) } } },
    { $group: { _id: { exam: "$exam", overall: "$overall" }, n: { $sum: 1 } } },
  ]);
  const byExam = {};
  for (const s of stats) {
    const k = String(s._id.exam);
    byExam[k] ||= { students: 0, ALL_CLEAR: 0, PARTIAL: 0, BLOCKED: 0, PENDING: 0 };
    byExam[k][s._id.overall] = s.n;
    byExam[k].students += s.n;
  }
  res.json({ data: exams.map((e) => examView(e, { stats: byExam[String(e._id)] || { students: 0 } })) });
};

// POST /api/exams
export const createExam = async (req, res) => {
  // Only the Admin may pick another academic year; everyone else uses the running one
  const body = { ...(req.body || {}) };
  if (req.user?.role !== "admin") body.academicYear = await getAcademicYear();
  const { out, errors } = readExamBody(body);
  if (errors.length) return fail(res, 400, errors[0], { errors });
  const { "settings.minAttendance": minAttendance, ...rest } = out;
  try {
    const exam = await Exam.create({
      ...rest,
      settings: { minAttendance },
      createdBy: req.user?.id || "unknown",
      createdByEmail: req.user?.email || "",
    });
    await logAction(req, "EXAM_CREATED", exam._id, { name: exam.name });
    res.status(201).json({ data: examView(exam) });
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "An exam with this name already exists for that academic year.");
    throw e;
  }
};

// PATCH /api/exams/:id
export const updateExam = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const body = { ...(req.body || {}) };
  if (req.user?.role !== "admin") delete body.academicYear; // fixed for everyone but Admin
  const { out, errors } = readExamBody(body, { partial: true });
  if (errors.length) return fail(res, 400, errors[0], { errors });
  try {
    const exam = await Exam.findByIdAndUpdate(req.params.id, { $set: out }, { returnDocument: "after", runValidators: true });
    if (!exam) return fail(res, 404, "Exam not found.");
    await logAction(req, "EXAM_UPDATED", exam._id, out);
    res.json({ data: examView(exam), message: "Saved. Click “Refresh registration” to apply the change to students." });
  } catch (e) {
    if (e.code === 11000) return fail(res, 409, "An exam with this name already exists for that academic year.");
    throw e;
  }
};

// DELETE /api/exams/:id   { confirm: "DELETE" }
export const deleteExam = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  if (req.body?.confirm !== "DELETE") return fail(res, 400, "Type DELETE to confirm.");
  const exam = await Exam.findById(req.params.id);
  if (!exam) return fail(res, 404, "Exam not found.");
  const paid = await ExamRegistration.countDocuments({
    exam: exam._id,
    $or: [{ "regularFee.paid": true }, { "subjects.fee.paid": true }],
  });
  if (paid) return fail(res, 409, `Fees are already recorded for ${paid} students. This exam cannot be deleted.`);
  const { deletedCount } = await ExamRegistration.deleteMany({ exam: exam._id });
  await exam.deleteOne();
  await logAction(req, "EXAM_DELETED", exam._id, { name: exam.name, registrations: deletedCount });
  res.json({ message: "Exam deleted." });
};

// --------------------------------------------------------------------
// GET /api/exams/:id  – overview: progress, class-wise counts, readiness
// --------------------------------------------------------------------
export const getExam = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found.");

  const [classStats, issueStats, readiness, unmappedBridge, feeStats] = await Promise.all([
    ExamRegistration.aggregate([
      { $match: { exam: exam._id } },
      {
        $group: {
          _id: { department: "$department", semester: "$semester", group: "$group", overall: "$overall" },
          n: { $sum: 1 },
        },
      },
    ]),
    ExamRegistration.aggregate([
      { $match: { exam: exam._id } },
      { $unwind: "$subjects" },
      { $group: { _id: "$subjects.effective", n: { $sum: 1 } } },
    ]),
    readinessFor(exam),
    Subject.find({ subjectCategory: "BRIDGE", semester: { $in: exam.semesters }, forAdmissionTypes: { $size: 0 } })
      .select("code name department semester")
      .sort({ department: 1, semester: 1, code: 1 })
      .lean(),
    ExamRegistration.aggregate([
      { $match: { exam: exam._id } },
      { $group: { _id: { $ifNull: ["$feeStatus", "UNPAID"] }, n: { $sum: 1 } } },
    ]),
  ]);

  const classes = {};
  for (const s of classStats) {
    const isBacklog = s._id.group === "backlog" || s._id.group === "manual";
    const key = isBacklog ? "backlog" : examGroupKey(s._id.department, s._id.semester);
    classes[key] ||= {
      key,
      department: isBacklog ? "" : s._id.department,
      semester: isBacklog ? null : s._id.semester,
      students: 0,
      ALL_CLEAR: 0,
      PARTIAL: 0,
      BLOCKED: 0,
      PENDING: 0,
    };
    classes[key][s._id.overall] += s.n;
    classes[key].students += s.n;
  }
  const subjects = Object.fromEntries(issueStats.map((s) => [s._id, s.n]));

  res.json({
    data: examView(exam, {
      classes: Object.values(classes).sort((a, b) =>
        a.key === "backlog" ? 1 : b.key === "backlog" ? -1 : a.semester - b.semester || a.department.localeCompare(b.department)
      ),
      subjectCounts: {
        ELIGIBLE: subjects.ELIGIBLE || 0,
        ANS: subjects.ANS || 0,
        NE: subjects.NE || 0,
        PENDING: subjects.PENDING || 0,
      },
      readiness,
      unmappedBridge,
      feeCounts: Object.fromEntries(["PAID", "PARTIAL", "UNPAID", "NONE"].map((k) => [k, feeStats.find((f) => f._id === k)?.n || 0])),
    }),
  });
};

// IA / attendance sheet status for every department + semester of the exam
async function readinessFor(exam) {
  const filter = { academicYear: exam.academicYear, semester: { $in: exam.semesters } };
  const [ia, att] = await Promise.all([
    FinalIA.find(filter).select("department semester batch status").lean(),
    FinalAttendance.find(filter).select("department semester batch status").lean(),
  ]);
  const pick = (list, d, s) => {
    const docs = list.filter((x) => x.department === d && x.semester === s);
    if (!docs.length) return "missing";
    const order = ["draft", "submitted", "confirmed"];
    // the least-ready sheet decides (a class can have more than one batch)
    return docs.map((x) => x.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0];
  };
  // sheets the HOD saved under a different academic year (a common mistake)
  const other = { semester: { $in: exam.semesters }, academicYear: { $ne: exam.academicYear } };
  const [iaOther, attOther] = await Promise.all([
    FinalIA.find(other).select("department semester academicYear").lean(),
    FinalAttendance.find(other).select("department semester academicYear").lean(),
  ]);
  const otherYear = (list, d, s) => [...new Set(list.filter((x) => x.department === d && x.semester === s).map((x) => x.academicYear))];

  const out = [];
  for (const semester of exam.semesters) {
    for (const department of DEPARTMENTS) {
      const iaState = pick(ia, department, semester);
      const attState = pick(att, department, semester);
      out.push({
        department,
        semester,
        ia: iaState,
        attendance: attState,
        iaOtherYears: iaState === "missing" ? otherYear(iaOther, department, semester) : [],
        attendanceOtherYears: attState === "missing" ? otherYear(attOther, department, semester) : [],
      });
    }
  }
  return out;
}

// ====================================================================
// Automatic registration (batched)
// ====================================================================

// POST /api/exams/:id/generate   { departments?: [...] }
// Marks groups as PENDING. The browser then calls /process until done.
export const startGeneration = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id);
  if (!exam) return fail(res, 404, "Exam not found.");
  if (exam.status === "COMPLETED") return fail(res, 409, "This exam is completed. Registration can no longer change.");
  if (exam.generation.lockedUntil && exam.generation.lockedUntil > new Date()) {
    return fail(res, 409, "Registration is already running. Please wait a moment.");
  }

  const only = Array.isArray(req.body?.departments) ? req.body.departments.map((d) => String(d).toLowerCase()) : null;

  const classes = await Student.aggregate([
    { $match: { status: "active", semester: { $in: exam.semesters } } },
    { $group: { _id: { department: { $toLower: "$department" }, semester: "$semester" }, n: { $sum: 1 } } },
  ]);
  const groups = classes
    .filter((c) => !only || only.includes(c._id.department))
    .map((c) => ({
      key: examGroupKey(c._id.department, c._id.semester),
      department: c._id.department,
      semester: c._id.semester,
      state: "PENDING",
    }))
    .sort((a, b) => a.semester - b.semester || a.department.localeCompare(b.department));

  if (exam.backPapers !== "NONE" && !only) groups.push({ key: "backlog", state: "PENDING" });
  if (!groups.length) return fail(res, 400, "No active students found in the selected semesters.");

  exam.generation.groups = groups;
  exam.generation.startedAt = new Date();
  exam.generation.finishedAt = null;
  exam.generation.startedBy = actor(req);
  await exam.save();
  await logAction(req, "EXAM_REGISTRATION_STARTED", exam._id, { groups: groups.map((g) => g.key) });
  res.json({ data: examView(exam) });
};

// POST /api/exams/:id/process – works through PENDING groups for ~7 seconds
export const processGeneration = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const now = new Date();
  const exam = await Exam.findOneAndUpdate(
    {
      _id: req.params.id,
      $or: [{ "generation.lockedUntil": null }, { "generation.lockedUntil": { $lt: now } }],
    },
    { $set: { "generation.lockedUntil": new Date(now.getTime() + LOCK_MS) } },
    { returnDocument: "after" }
  );
  if (!exam) {
    const exists = await Exam.findById(req.params.id).lean();
    if (!exists) return fail(res, 404, "Exam not found.");
    return res.json({ data: examView(exists), busy: true });
  }

  const started = Date.now();
  try {
    for (const g of exam.generation.groups) {
      if (g.state !== "PENDING") continue;
      if (Date.now() - started > BUDGET_MS) break;
      try {
        g.students =
          g.key === "backlog" ? await generateBacklogGroup(exam) : await generateClassGroup(exam, g.department, g.semester);
        g.state = "DONE";
        g.error = "";
      } catch (e) {
        console.error("Exam registration group failed:", g.key, e);
        g.state = "FAILED";
        g.error = e.message || "Unknown error";
      }
      g.doneAt = new Date();
    }
    if (exam.generation.groups.every((g) => g.state !== "PENDING")) {
      exam.generation.finishedAt = new Date();
    }
  } finally {
    exam.generation.lockedUntil = null;
    exam.markModified("generation.groups");
    await exam.save();
  }
  res.json({ data: examView(exam) });
};

// Look-up tables for the IA and attendance sheets of one class
async function loadSheets(exam, department, semester) {
  const filter = { academicYear: exam.academicYear, department, semester };
  const [iaDocs, attDocs] = await Promise.all([FinalIA.find(filter).lean(), FinalAttendance.find(filter).lean()]);

  const byBatch = (docs, kind) => {
    const map = new Map();
    for (const d of docs) {
      const subjects = new Map(
        (d.subjects || []).map((s) => [String(s.subjectId), kind === "ia" ? s.maxMarks : s.maxClasses])
      );
      const students = new Map();
      for (const st of d.students || []) {
        const vals = new Map();
        for (const m of (kind === "ia" ? st.marks : st.attendance) || []) {
          vals.set(String(m.subjectId), kind === "ia" ? m.marks : m.classesAttended);
        }
        students.set(String(st.studentId), vals);
      }
      map.set(d.batch, { status: d.status, subjects, students });
    }
    return map;
  };
  return { ia: byBatch(iaDocs, "ia"), att: byBatch(attDocs, "att") };
}

function sheetEntry(sheet, studentId, subjectId) {
  if (!sheet) return { state: "missing" };
  if (sheet.status !== "confirmed") return { state: sheet.status };
  const key = String(subjectId);
  if (!sheet.subjects.has(key)) return { state: "no-subject" };
  const vals = sheet.students.get(String(studentId));
  return { state: "confirmed", max: sheet.subjects.get(key), value: vals ? (vals.get(key) ?? null) : null };
}

function regSubject(subject, kind, extra = {}) {
  return {
    subject: subject._id,
    code: subject.code,
    name: subject.name,
    semester: subject.semester,
    kind,
    credit: subject.credit || 0,
    hasTheory: hasTheoryPaper(subject),
    hasPractical: hasPracticalExam(subject),
    source: "AUTO",
    override: { status: null, reason: "", by: "", at: null },
    ...extra,
  };
}

const SUBJECT_FIELDS =
  "code name semester department subjectCategory electiveGroup forAdmissionTypes iaMax iaMin theoryExamMax practicalExamMax credit schemeYear sequence";
const STUDENT_FIELDS =
  "registerNumber rollNumber name department semester batch admissionYear admissionType imageUrl status";

// Back papers for a set of students -> Map(studentId -> [{ subject doc, lastStatus }])
async function backlogsByStudent(exam, studentIds) {
  if (exam.backPapers === "NONE" || !studentIds.length) return new Map();
  const results = await CourseResult.find({ student: { $in: studentIds } })
    .select("student subject status declaredAt semester")
    .lean();
  if (!results.length) return new Map();

  const perStudent = new Map();
  for (const r of results) {
    const k = String(r.student);
    if (!perStudent.has(k)) perStudent.set(k, []);
    perStudent.get(k).push(r);
  }
  const pending = new Map();
  const subjectIds = new Set();
  for (const [sid, list] of perStudent) {
    const backs = backlogsFrom(list);
    if (backs.length) {
      pending.set(sid, backs);
      backs.forEach((b) => subjectIds.add(String(b.subject)));
    }
  }
  const subjects = new Map(
    (await Subject.find({ _id: { $in: [...subjectIds] } }).select(SUBJECT_FIELDS).lean()).map((s) => [String(s._id), s])
  );
  const out = new Map();
  for (const [sid, backs] of pending) {
    const list = backs
      .map((b) => ({ subject: subjects.get(String(b.subject)), lastStatus: b.status }))
      .filter((b) => b.subject && backPaperAllowed(exam.backPapers, exam.semesters, b.subject.semester));
    if (list.length) out.set(sid, list);
  }
  return out;
}

function backlogSubjects(backs, alreadyCodes) {
  return backs
    .filter((b) => !alreadyCodes.has(b.subject.code))
    .map((b) => {
      const el = backlogEligibility(b.lastStatus);
      return regSubject(b.subject, "BACKLOG", { status: el.status, reasons: el.reasons });
    });
}

function studentFields(st, group) {
  return {
    registerNumber: st.registerNumber || "",
    rollNumber: st.rollNumber || "",
    name: st.name || "",
    department: String(st.department || "").toLowerCase(),
    semester: st.semester,
    batch: st.batch || "",
    admissionType: st.admissionType || "regular",
    imageUrl: st.imageUrl || "",
    group,
  };
}

async function saveRegistrations(exam, docs, existingByStudent) {
  const ops = docs.map(({ student, fields, subjects, warnings }) => {
    const prev = existingByStudent.get(String(student));
    const merged = mergeSubjects(subjects, prev?.subjects || []).map((s) => ({ ...s, effective: effectiveOf(s) }));
    const { counts, overall } = summarize(merged, { incomplete: isIncomplete(warnings) });
    const feeStatus = feeSummary({ subjects: merged, regularFee: prev?.regularFee }).status;
    return {
      updateOne: {
        filter: { exam: exam._id, student },
        update: { $set: { ...fields, subjects: merged, warnings, counts, overall, feeStatus } },
        upsert: true,
      },
    };
  });
  if (ops.length) await ExamRegistration.bulkWrite(ops, { ordered: false });
}

// One class: department + current semester
async function generateClassGroup(exam, department, semester) {
  const key = examGroupKey(department, semester);
  const [students, allSubjects, sheets] = await Promise.all([
    Student.find({ department: ci(department), semester, status: "active" }).select(STUDENT_FIELDS).lean(),
    Subject.find({ department: ci(department), semester }).select(SUBJECT_FIELDS).sort({ sequence: 1 }).lean(),
    loadSheets(exam, department, semester),
  ]);
  const ids = students.map((s) => s._id);

  const [electives, backlogs, existing] = await Promise.all([
    StudentElective.find({ student: { $in: ids }, semester }).lean(),
    backlogsByStudent(exam, ids),
    ExamRegistration.find({ exam: exam._id, student: { $in: ids } }).lean(),
  ]);

  const choices = new Map();
  for (const e of electives) {
    const k = String(e.student);
    if (!choices.has(k)) choices.set(k, {});
    choices.get(k)[e.electiveGroup] = e.subject;
  }
  const existingByStudent = new Map(existing.map((r) => [String(r.student), r]));
  const minAttendance = exam.settings?.minAttendance ?? 75;

  const docs = students.map((st) => {
    const sid = String(st._id);
    const scheme = pickScheme(allSubjects, batchStartYear(st));
    const { subjects, warnings } = currentSubjectsFor(st, scheme, choices.get(sid) || {});
    const iaSheet = sheets.ia.get(st.batch);
    const attSheet = sheets.att.get(st.batch);

    const current = subjects.map(({ subject, kind }) => {
      const ia = sheetEntry(iaSheet, st._id, subject._id);
      const att = sheetEntry(attSheet, st._id, subject._id);
      const el = eligibilityFor(
        subject,
        { state: ia.state, marks: ia.value, maxMarks: ia.max },
        { state: att.state, attended: att.value, maxClasses: att.max },
        minAttendance
      );
      return regSubject(subject, kind, el);
    });
    if (!subjects.length) warnings.push(`No subjects found for ${department.toUpperCase()} semester ${semester}.`);

    const codes = new Set(current.map((s) => s.code));
    const backs = backlogSubjects(backlogs.get(sid) || [], codes);
    return { student: st._id, fields: studentFields(st, key), subjects: [...current, ...backs], warnings };
  });

  await saveRegistrations(exam, docs, existingByStudent);

  // Students who left this class (status/semester changed) – remove their
  // registration unless the COE already worked on it
  await ExamRegistration.deleteMany({
    exam: exam._id,
    group: key,
    student: { $nin: ids },
    "regularFee.paid": { $ne: true },
    "subjects.fee.paid": { $ne: true },
    "subjects.source": { $ne: "MANUAL" },
  });
  return students.length;
}

// Students not in the exam's semesters who still have back papers
async function generateBacklogGroup(exam) {
  const candidates = await CourseResult.distinct("student", { status: { $ne: "PASS" } });
  if (!candidates.length) return 0;
  const students = await Student.find({
    _id: { $in: candidates },
    status: { $in: BACKLOG_STATUSES },
    $or: [{ semester: { $nin: exam.semesters } }, { status: { $ne: "active" } }],
  })
    .select(STUDENT_FIELDS)
    .lean();
  const ids = students.map((s) => s._id);
  const [backlogs, existing] = await Promise.all([
    backlogsByStudent(exam, ids),
    ExamRegistration.find({ exam: exam._id, student: { $in: ids } }).lean(),
  ]);
  const existingByStudent = new Map(existing.map((r) => [String(r.student), r]));

  const docs = [];
  for (const st of students) {
    const backs = backlogSubjects(backlogs.get(String(st._id)) || [], new Set());
    if (!backs.length) continue;
    docs.push({ student: st._id, fields: studentFields(st, "backlog"), subjects: backs, warnings: [] });
  }
  await saveRegistrations(exam, docs, existingByStudent);
  return docs.length;
}

// ====================================================================
// Registrations: list, details, overrides, manual back papers
// ====================================================================

function regListView(r) {
  return {
    _id: r._id,
    registerNumber: r.registerNumber,
    rollNumber: r.rollNumber,
    name: r.name,
    department: r.department,
    semester: r.semester,
    admissionType: r.admissionType,
    admissionLabel: ADMISSION_LABEL[r.admissionType] || r.admissionType,
    imageUrl: r.imageUrl,
    group: r.group,
    counts: r.counts,
    overall: r.overall,
    feeStatus: r.feeStatus,
    warnings: r.warnings,
    subjects: (r.subjects || []).map((s) => ({
      subject: s.subject,
      code: s.code,
      name: s.name,
      semester: s.semester,
      kind: s.kind,
      source: s.source,
      hasTheory: s.hasTheory,
      hasPractical: s.hasPractical,
      status: s.status,
      effective: s.effective,
      reasons: s.reasons,
      iaMarks: s.iaMarks,
      iaMax: s.iaMax,
      attendancePct: s.attendancePct,
      override: s.override?.status ? s.override : null,
    })),
  };
}

// GET /api/exams/:id/registrations?department=&semester=&overall=&issue=&q=&page=&limit=
export const listRegistrations = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const { department, semester, overall, issue, q } = req.query;
  const filter = { exam: new mongoose.Types.ObjectId(req.params.id) };
  if (department === "backlog") filter.group = { $in: ["backlog", "manual"] };
  else if (department) filter.department = String(department).toLowerCase();
  if (semester && department !== "backlog") filter.semester = Number(semester);
  if (overall) filter.overall = overall;
  if (issue === "OVERRIDDEN") filter["subjects.override.status"] = { $ne: null };
  else if (issue === "BACKLOG") filter["subjects.kind"] = "BACKLOG";
  else if (issue === "WARNING") filter["warnings.0"] = { $exists: true };
  else if (issue) filter["subjects.effective"] = issue;
  if (q) {
    const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ name: rx }, { registerNumber: rx }, { rollNumber: rx }];
  }
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    ExamRegistration.find(filter)
      .sort({ semester: 1, department: 1, registerNumber: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ExamRegistration.countDocuments(filter),
  ]);
  res.json({ data: items.map(regListView), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
};

async function loadReg(req, res) {
  const { id, regId } = req.params;
  if (!isId(id) || !isId(regId)) return fail(res, 400, "Invalid id."), null;
  const reg = await ExamRegistration.findOne({ _id: regId, exam: id });
  if (!reg) return fail(res, 404, "Registration not found."), null;
  return reg;
}

export function recount(reg) {
  for (const s of reg.subjects) s.effective = effectiveOf(s);
  const { counts, overall } = summarize(reg.subjects, { incomplete: isIncomplete(reg.warnings) });
  reg.counts = counts;
  reg.overall = overall;
  reg.feeStatus = feeSummary(reg).status;
  reg.markModified("subjects");
}

// POST /api/exams/:id/registrations/:regId/override  { subjectId, status|null, reason }
export const overrideSubject = async (req, res) => {
  const reg = await loadReg(req, res);
  if (!reg) return;
  const { subjectId, status, reason } = req.body || {};
  const s = reg.subjects.find((x) => String(x.subject) === String(subjectId));
  if (!s) return fail(res, 404, "This subject is not in the student's registration.");

  if (status) {
    if (!["ELIGIBLE", "ANS", "NE"].includes(status)) return fail(res, 400, "Status must be ELIGIBLE, ANS or NE.");
    const why = String(reason || "").trim();
    if (why.length < 3) return fail(res, 400, "Write a reason, e.g. “Condoned – medical certificate”.");
    s.override = { status, reason: why, by: actor(req), at: new Date() };
  } else {
    s.override = { status: null, reason: "", by: "", at: null };
  }
  recount(reg);
  await reg.save();
  await logAction(req, status ? "EXAM_ELIGIBILITY_OVERRIDDEN" : "EXAM_OVERRIDE_REMOVED", reg.exam, {
    registration: reg._id,
    registerNumber: reg.registerNumber,
    code: s.code,
    computed: s.status,
    override: status || null,
    reason: reason || "",
  });
  res.json({ data: regListView(reg.toObject()) });
};

// POST /api/exams/:id/back-papers  { registerNumber, codes: ["25SC11T0", ...] }
// Adds back papers by hand (for seniors whose old results are not in the
// software yet). Creates the registration if the student has none.
export const addBackPapers = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found.");

  const regNo = String(req.body?.registerNumber || "").trim().toUpperCase();
  const codes = [...new Set((req.body?.codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
  if (!regNo) return fail(res, 400, "Enter the register number.");
  if (!codes.length) return fail(res, 400, "Enter at least one subject code.");

  const student = await Student.findOne({ registerNumber: regNo }).select(STUDENT_FIELDS).lean();
  if (!student) return fail(res, 404, `No student with register number ${regNo}.`);

  const dept = String(student.department || "").toLowerCase();
  const found = await Subject.find({ code: { $in: codes } }).select(SUBJECT_FIELDS).lean();
  // the same code can exist in several departments – prefer the student's own
  const byCode = new Map();
  for (const s of found) {
    const own = String(s.department).toLowerCase() === dept;
    if (!byCode.has(s.code) || own) byCode.set(s.code, s);
  }
  const missing = codes.filter((c) => !byCode.has(c));
  if (missing.length) return fail(res, 404, `Subject code not found: ${missing.join(", ")}.`);

  let reg = await ExamRegistration.findOne({ exam: exam._id, student: student._id });
  if (!reg) {
    reg = new ExamRegistration({ exam: exam._id, student: student._id, ...studentFields(student, "manual"), subjects: [] });
  }
  const already = new Set(reg.subjects.map((s) => s.code));
  const added = [];
  for (const code of codes) {
    if (already.has(code)) continue;
    reg.subjects.push(
      regSubject(byCode.get(code), "BACKLOG", {
        source: "MANUAL",
        status: "ELIGIBLE",
        reasons: [],
        effective: "ELIGIBLE",
      })
    );
    added.push(code);
  }
  if (!added.length) return fail(res, 409, "These subjects are already in the student's registration.");
  recount(reg);
  await reg.save();
  await logAction(req, "EXAM_BACK_PAPER_ADDED", exam._id, { registerNumber: regNo, codes: added });
  res.json({ data: regListView(reg.toObject()), message: `Added ${added.join(", ")} for ${regNo}.` });
};

// DELETE /api/exams/:id/registrations/:regId/subjects/:subjectId  (manual subjects only)
export const removeManualSubject = async (req, res) => {
  const reg = await loadReg(req, res);
  if (!reg) return;
  const s = reg.subjects.find((x) => String(x.subject) === String(req.params.subjectId));
  if (!s) return fail(res, 404, "Subject not found in this registration.");
  if (s.source !== "MANUAL") return fail(res, 400, "Only subjects added by hand can be removed. Use “Change decision” instead.");
  if (s.fee?.paid) return fail(res, 409, "The fee for this subject is already recorded.");
  reg.subjects = reg.subjects.filter((x) => x !== s);
  if (!reg.subjects.length && reg.group === "manual") {
    await reg.deleteOne();
    await logAction(req, "EXAM_BACK_PAPER_REMOVED", reg.exam, { registerNumber: reg.registerNumber, code: s.code });
    return res.json({ data: null, message: "Removed. The student had no other subjects, so his registration was removed." });
  }
  recount(reg);
  await reg.save();
  await logAction(req, "EXAM_BACK_PAPER_REMOVED", reg.exam, { registerNumber: reg.registerNumber, code: s.code });
  res.json({ data: regListView(reg.toObject()) });
};

// ====================================================================
// Excel export: one row per student per subject
// ====================================================================

const STATUS_TEXT = {
  ELIGIBLE: "Eligible",
  ANS: "Not permitted – attendance shortage",
  NE: "Not permitted – IA below minimum",
  PENDING: "Pending",
};

// GET /api/exams/:id/export?department=&semester=
export const exportRegistrations = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const exam = await Exam.findById(req.params.id).lean();
  if (!exam) return fail(res, 404, "Exam not found.");
  const filter = { exam: exam._id };
  if (req.query.department) filter.department = String(req.query.department).toLowerCase();
  if (req.query.semester) filter.semester = Number(req.query.semester);
  const regs = await ExamRegistration.find(filter).sort({ semester: 1, department: 1, registerNumber: 1 }).lean();

  const rows = [];
  for (const r of regs) {
    for (const s of r.subjects) {
      rows.push({
        "Register Number": r.registerNumber,
        "Roll Number": r.rollNumber,
        "Student Name": r.name,
        Department: r.department.toUpperCase(),
        Semester: r.semester,
        "Admission Type": ADMISSION_LABEL[r.admissionType] || r.admissionType,
        "Subject Code": s.code,
        "Subject Name": s.name,
        "Subject Sem": s.semester,
        Type: { REGULAR: "Regular", ELECTIVE: "Elective", BRIDGE: "Bridge", BACKLOG: "Back paper" }[s.kind],
        "Written exam": s.hasTheory ? "Yes" : "No (practical only)",
        "IA Marks": s.iaMarks ?? "",
        "Attendance %": s.attendancePct ?? "",
        Decision: STATUS_TEXT[s.effective],
        "Changed by COE": s.override?.status ? `${s.override.reason} (${s.override.by})` : "",
        Notes: (s.reasons || []).join(" "),
      });
    }
  }
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: "No registrations yet." }]);
  ws["!cols"] = [16, 12, 30, 10, 9, 22, 12, 36, 10, 12, 18, 9, 12, 34, 30, 50].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Eligibility");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  await logAction(req, "EXAM_ELIGIBILITY_EXPORTED", exam._id, filter);

  const safe = exam.name.replace(/[^a-z0-9]+/gi, "_").slice(0, 40);
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="eligibility_${safe}.xlsx"`,
    "Cache-Control": "no-store",
  });
  res.send(buf);
};

// ====================================================================
// Bridge courses: which lateral types take each one
// ====================================================================

// GET /api/exams/setup/bridge-courses
export const listBridgeCourses = async (req, res) => {
  const subjects = await Subject.find({ subjectCategory: "BRIDGE" })
    .select("code name department semester forAdmissionTypes schemeYear sequence theoryExamMax practicalExamMax")
    .sort({ department: 1, semester: 1, sequence: 1 })
    .lean();
  res.json({ data: subjects });
};

// PUT /api/exams/setup/bridge-courses   { updates: [{ id, forAdmissionTypes: [...] }] }
export const saveBridgeCourses = async (req, res) => {
  const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
  if (!updates.length) return fail(res, 400, "Nothing to save.");
  const ops = [];
  for (const u of updates) {
    if (!isId(u.id)) return fail(res, 400, "Invalid subject id.");
    let types;
    try {
      types = normalizeAdmissionTypes(u.forAdmissionTypes);
    } catch (e) {
      return fail(res, 400, e.message);
    }
    ops.push({
      updateOne: { filter: { _id: u.id, subjectCategory: "BRIDGE" }, update: { $set: { forAdmissionTypes: types } } },
    });
  }
  const r = await Subject.bulkWrite(ops);
  await logAction(req, "BRIDGE_COURSES_MAPPED", null, { subjects: updates.length });
  res.json({ message: `Saved ${r.matchedCount} bridge courses.` });
};
