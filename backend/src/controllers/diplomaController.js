// src/controllers/diplomaController.js
//
// Award of the Diploma (KPT 11), class (KPT 12) and ranks (KPT 14.8) – COE.
//   GET  /api/diploma?department=&startYear=&college=   every final-year student of
//        a batch: eligible or why not, CGPA, class, rank in his programme
//   POST /api/diploma/award   { studentIds, reference, awardedOn, cleared }
//        records the award for eligible students (Academic Council's
//        approval; no dues / disciplinary case confirmed – KPT 11.1.4);
//        they become "passed"
//   GET  /api/diploma/awards?department=&startYear=   the awarded (for printing)
//   DELETE /api/diploma/award/:id   undo (recorded by mistake)

import mongoose from "mongoose";

import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import CourseResult from "../models/CourseResult.js";
import ExamRegistration from "../models/ExamRegistration.js";
import DiplomaAward from "../models/DiplomaAward.js";
import { CieMakeup } from "../models/CieMakeup.js";
import { audit } from "../models/AuditLog.js";
import { collegeFilter } from "../services/evening.js";
import { CLASS_LABEL, diplomaCheck, rankList, startYearOf } from "../services/exams/diploma.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));
const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";

// final-year students of a batch (or already awarded), each with his check
async function evaluate({ department, startYear, college }) {
  const filter = { status: { $in: ["active", "detained", "passed", "inactive"] }, ...collegeFilter({ college }) };
  if (department) filter.department = String(department).toLowerCase();
  const students = (await Student.find(filter).select("registerNumber name fatherName department semester status admissionType admissionYear batch").lean()).filter(
    (s) => (Number(s.semester) >= 6 || s.status === "passed") && (!startYear || startYearOf(s) === Number(startYear))
  );
  if (!students.length) return [];
  const ids = students.map((s) => s._id);
  const [results, malpractice, supplementary, awards] = await Promise.all([
    CourseResult.find({ student: { $in: ids } }).select("student subject code semester status gradePoint credit declaredAt rejected").lean(),
    ExamRegistration.distinct("student", { student: { $in: ids }, "malpractice.decision": { $ne: null } }),
    CieMakeup.distinct("student", { student: { $in: ids } }),
    DiplomaAward.find({ student: { $in: ids } }).lean(),
  ]);
  const subjects = new Map(
    (await Subject.find({ _id: { $in: [...new Set(results.map((r) => String(r.subject)))] } }).select("subjectCategory name").lean()).map((s) => [String(s._id), s])
  );
  const byStudent = new Map();
  for (const r of results) {
    const k = String(r.student);
    if (!byStudent.has(k)) byStudent.set(k, []);
    const sub = subjects.get(String(r.subject));
    byStudent.get(k).push({ ...r, category: String(sub?.subjectCategory || "REGULAR").toUpperCase(), name: sub?.name || "" });
  }
  const mp = new Set(malpractice.map(String));
  const sup = new Set(supplementary.map(String));
  const awardOf = new Map(awards.map((a) => [String(a.student), a]));

  const rows = students.map((s) => {
    const id = String(s._id);
    const check = diplomaCheck(byStudent.get(id) || [], s, { malpractice: mp.has(id), supplementary: sup.has(id) });
    return {
      student: s._id,
      registerNumber: s.registerNumber,
      name: s.name,
      department: s.department,
      semester: s.semester,
      status: s.status,
      admissionType: s.admissionType,
      batch: s.batch,
      startYear: startYearOf(s),
      ...check,
      classLabel: check.class ? CLASS_LABEL[check.class] : "",
      award: awardOf.get(id) || null,
    };
  });
  // ranks within each programme (and batch)
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.department}|${r.startYear}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  for (const list of groups.values()) rankList(list);
  return rows.sort((a, b) => a.department.localeCompare(b.department) || (a.rank || 999) - (b.rank || 999) || a.registerNumber.localeCompare(b.registerNumber));
}

const strip = ({ sgpa, finalYearPoints, cgpaForRank, ...r }) => ({ ...r, sgpa });

// GET /api/diploma
export const diplomaList = async (req, res) => {
  const rows = await evaluate(req.query);
  res.json({ data: rows.map(strip) });
};

// POST /api/diploma/award
export const awardDiploma = async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.studentIds) ? req.body.studentIds : []).map(String))].filter(isId);
  if (!ids.length) return fail(res, 400, "Tick the students to award.");
  const reference = String(req.body?.reference || "").trim().slice(0, 300);
  if (reference.length < 3) return fail(res, 400, "Write the Academic Council's approval (resolution no. / date) – KPT 11.2.");
  if (req.body?.cleared !== true) return fail(res, 400, "Confirm that they have no dues and no disciplinary case (KPT 11.1.4).");
  const awardedOn = req.body?.awardedOn ? new Date(req.body.awardedOn) : new Date();

  const students = await Student.find({ _id: { $in: ids } }).select("department batch admissionYear").lean();
  const rows = [];
  for (const key of new Set(students.map((s) => `${s.department}|${startYearOf(s)}`))) {
    const [department, startYear] = key.split("|");
    rows.push(...(await evaluate({ department, startYear })));
  }
  const chosen = rows.filter((r) => ids.includes(String(r.student)));
  const notEligible = chosen.filter((r) => !r.eligible).map((r) => r.registerNumber);
  const already = chosen.filter((r) => r.award).map((r) => r.registerNumber);
  const todo = chosen.filter((r) => r.eligible && !r.award);
  const info = new Map((await Student.find({ _id: { $in: todo.map((r) => r.student) } }).select("fatherName status").lean()).map((s) => [String(s._id), s]));

  for (const r of todo) {
    const st = info.get(String(r.student)) || {};
    await DiplomaAward.create({
      student: r.student,
      registerNumber: r.registerNumber,
      name: r.name,
      fatherName: st.fatherName || "",
      department: r.department,
      admissionType: r.admissionType,
      batch: r.batch,
      startYear: r.startYear,
      credits: r.earned,
      cgpa: r.cgpa,
      percentage: r.percentage,
      class: r.class,
      rank: r.rank || null,
      completedOn: r.completedOn,
      awardedOn,
      reference,
      previousStatus: st.status || "active",
      by: who(req),
    });
    await Student.updateOne({ _id: r.student }, { $set: { status: "passed" } });
  }
  await audit(req, "DIPLOMA_AWARDED", null, { students: todo.map((r) => r.registerNumber), reference, notEligible, already });
  res.json({
    message: `${todo.length} student${todo.length === 1 ? "" : "s"} awarded the Diploma.${notEligible.length ? ` Not eligible (left out): ${notEligible.join(", ")}.` : ""}${
      already.length ? ` Already awarded: ${already.join(", ")}.` : ""
    }`,
  });
};

// GET /api/diploma/awards?department=&startYear=&ids=
export const listAwards = async (req, res) => {
  const filter = {};
  if (req.query.department) filter.department = String(req.query.department).toLowerCase();
  if (req.query.startYear) filter.startYear = Number(req.query.startYear);
  if (req.query.ids) filter._id = { $in: String(req.query.ids).split(",").filter(isId) };
  Object.assign(filter, collegeFilter(req.query));
  const list = await DiplomaAward.find(filter).sort({ department: 1, rank: 1, registerNumber: 1 }).collation({ locale: "en", numericOrdering: true }).lean();
  res.json({ data: list.map((a) => ({ ...a, classLabel: CLASS_LABEL[a.class] || a.class })) });
};

// DELETE /api/diploma/award/:id
export const undoAward = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const a = await DiplomaAward.findById(req.params.id);
  if (!a) return fail(res, 404, "Award not found.");
  await Student.updateOne({ _id: a.student, status: "passed" }, { $set: { status: a.previousStatus || "active" } });
  await DiplomaAward.deleteOne({ _id: a._id });
  await audit(req, "DIPLOMA_AWARD_UNDONE", null, { registerNumber: a.registerNumber });
  res.json({ message: `Award removed for ${a.registerNumber}.` });
};
