// src/controllers/electiveController.js
//
// HOD chooses which elective each student studies.
// HODs only see their own department; COE/Admin can pick any department.

import mongoose from "mongoose";

import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import StudentElective from "../models/StudentElective.js";
import AuditLog from "../models/AuditLog.js";

const fail = (res, status, error) => res.status(status).json({ error });
const ci = (v) => new RegExp(`^${String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");

function departmentFor(req, requested) {
  if (req.user?.role === "hod") return String(req.user.department || "").toLowerCase();
  return String(requested || "").toLowerCase();
}

// GET /api/electives/overview?department=cs
// Which semesters of the department have elective groups
export const electiveOverview = async (req, res) => {
  const department = departmentFor(req, req.query.department);
  if (!department) return fail(res, 400, "Department is required.");
  const rows = await Subject.aggregate([
    { $match: { department: ci(department), subjectCategory: "ELECTIVE" } },
    { $group: { _id: { semester: "$semester", group: "$electiveGroup" }, subjects: { $sum: 1 } } },
    { $sort: { "_id.semester": 1, "_id.group": 1 } },
  ]);
  const semesters = {};
  for (const r of rows) {
    semesters[r._id.semester] ||= { semester: r._id.semester, groups: [] };
    semesters[r._id.semester].groups.push({ group: r._id.group, subjects: r.subjects });
  }
  res.json({ data: { department, semesters: Object.values(semesters) } });
};

// GET /api/electives?department=cs&semester=5
export const getElectives = async (req, res) => {
  const department = departmentFor(req, req.query.department);
  const semester = Number(req.query.semester);
  if (!department) return fail(res, 400, "Department is required.");
  if (!(semester >= 1 && semester <= 6)) return fail(res, 400, "Choose a semester.");

  const [subjects, students] = await Promise.all([
    Subject.find({ department: ci(department), semester, subjectCategory: "ELECTIVE" })
      .select("code name electiveGroup schemeYear")
      .sort({ electiveGroup: 1, code: 1 })
      .lean(),
    Student.find({ department: ci(department), semester, status: "active" })
      .select("registerNumber rollNumber name batch admissionType")
      .sort({ registerNumber: 1 })
      .lean(),
  ]);
  const choices = await StudentElective.find({ student: { $in: students.map((s) => s._id) }, semester }).lean();

  const groups = {};
  for (const s of subjects) {
    const g = s.electiveGroup || "-";
    groups[g] ||= { group: g, subjects: [] };
    groups[g].subjects.push({ _id: s._id, code: s.code, name: s.name, schemeYear: s.schemeYear });
  }
  const chosen = {};
  for (const c of choices) {
    chosen[c.student] ||= {};
    chosen[c.student][c.electiveGroup] = String(c.subject);
  }
  res.json({ data: { department, semester, groups: Object.values(groups), students, choices: chosen } });
};

// PUT /api/electives  { department, semester, choices: [{ studentId, group, subjectId|null }] }
export const saveElectives = async (req, res) => {
  const department = departmentFor(req, req.body?.department);
  const semester = Number(req.body?.semester);
  const list = Array.isArray(req.body?.choices) ? req.body.choices : [];
  if (!department || !(semester >= 1 && semester <= 6)) return fail(res, 400, "Department and semester are required.");
  if (!list.length) return fail(res, 400, "Nothing to save.");

  const [subjects, students] = await Promise.all([
    Subject.find({ department: ci(department), semester, subjectCategory: "ELECTIVE" }).select("electiveGroup").lean(),
    Student.find({
      _id: { $in: list.map((c) => c.studentId).filter((id) => mongoose.Types.ObjectId.isValid(id)) },
      department: ci(department),
    })
      .select("_id")
      .lean(),
  ]);
  const subjectGroup = new Map(subjects.map((s) => [String(s._id), s.electiveGroup]));
  const validStudents = new Set(students.map((s) => String(s._id)));

  const ops = [];
  for (const c of list) {
    const group = String(c.group || "").toUpperCase();
    if (!validStudents.has(String(c.studentId))) return fail(res, 400, "A student is not in this department.");
    if (!group) return fail(res, 400, "Elective group missing.");
    const filter = { student: c.studentId, semester, electiveGroup: group };
    if (!c.subjectId) {
      ops.push({ deleteOne: { filter } });
      continue;
    }
    if (subjectGroup.get(String(c.subjectId)) !== group) {
      return fail(res, 400, `That subject is not an elective of group ${group} in semester ${semester}.`);
    }
    ops.push({
      updateOne: {
        filter,
        update: {
          $set: {
            subject: c.subjectId,
            department,
            setBy: req.user?.id || "",
            setByEmail: req.user?.email || "",
          },
        },
        upsert: true,
      },
    });
  }
  await StudentElective.bulkWrite(ops, { ordered: false });
  AuditLog.create({
    action: "ELECTIVES_SAVED",
    entity: "StudentElective",
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    details: { department, semester, changes: ops.length },
  }).catch(() => {});
  res.json({ message: `Saved ${ops.length} choices.` });
};
