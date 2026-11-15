// src/controllers/markCardController.js
//
// Earlier mark cards – from results imported from the old results software
// (25S = Nov/Dec 2025, 26A = Apr/May 2026 …), in the same shape as the grade
// cards of exams published in this website, so the same print page is used.
//
//   GET /api/mark-cards/exams                         the earlier exams on record
//   GET /api/mark-cards?examCode=25S&department=&semester=&college=&q=
//
// For each student who has results in that exam: its courses (the semester
// he wrote = the highest semester among them; lower ones are back papers),
// SGPA of that semester, CGPA up to that exam (latest attempt of every
// course declared by then), credits and the result.

import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import CourseResult from "../models/CourseResult.js";
import { audit } from "../models/AuditLog.js";
import { collegeFilter } from "../services/evening.js";
import { bySyllabus } from "../services/exams/rules.js";

const fail = (res, status, error) => res.status(status).json({ error });
const r2 = (n) => Math.round(n * 100) / 100;

// "25S" -> Nov/Dec 2025 (academic year 2025-26); "26A" -> Apr/May 2026 (2025-26)
export function examLabel(code) {
  const m = String(code || "").toUpperCase().match(/^(\d{2})([AS])$/);
  if (!m) return { name: code, academicYear: "" };
  const y = 2000 + Number(m[1]);
  return m[2] === "S"
    ? { name: `Nov/Dec ${y} Semester End Examination`, academicYear: `${y}-${String((y + 1) % 100).padStart(2, "0")}` }
    : { name: `Apr/May ${y} Semester End Examination`, academicYear: `${y - 1}-${String(y % 100).padStart(2, "0")}` };
}

// GET /api/mark-cards/exams
export const earlierExams = async (req, res) => {
  const rows = await CourseResult.aggregate([
    { $match: { source: "IMPORT", examCode: { $ne: "" } } },
    { $group: { _id: "$examCode", students: { $addToSet: "$student" }, declaredAt: { $max: "$declaredAt" } } },
    { $project: { students: { $size: "$students" }, declaredAt: 1 } },
    { $sort: { declaredAt: -1 } },
  ]);
  res.json({ data: rows.map((r) => ({ code: r._id, ...examLabel(r._id), students: r.students })) });
};

// SGPA / CGPA over credit courses (no bridge, no audit); a course not passed counts 0
function gpa(list) {
  const counted = list.filter((c) => Number(c.credit) > 0 && c.kind !== "BRIDGE" && c.kind !== "AUDIT");
  const reg = counted.reduce((a, c) => a + Number(c.credit), 0);
  if (!reg) return { value: null, registered: 0, earned: 0 };
  const pts = counted.reduce((a, c) => a + Number(c.credit) * (c.status === "PASS" ? Number(c.points) || 0 : 0), 0);
  const earned = counted.filter((c) => c.status === "PASS").reduce((a, c) => a + Number(c.credit), 0);
  return { value: r2(pts / reg), registered: reg, earned };
}

// GET /api/mark-cards
export const earlierMarkCards = async (req, res) => {
  const examCode = String(req.query.examCode || "").trim().toUpperCase();
  if (!/^\d{2}[AS]$/.test(examCode)) return fail(res, 400, "Choose the exam (e.g. 25S or 26A).");

  // students: filters on the student record
  const sFilter = { ...collegeFilter(req.query) };
  if (req.query.department) sFilter.department = String(req.query.department).toLowerCase();
  if (req.query.q) {
    const rx = new RegExp(String(req.query.q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    sFilter.$or = [{ registerNumber: rx }, { name: rx }];
  }
  const inExam = await CourseResult.distinct("student", { source: "IMPORT", examCode });
  const students = await Student.find({ _id: { $in: inExam }, ...sFilter })
    .select("registerNumber name fatherName imageUrl department semester batch admissionType rollNumber")
    .sort({ department: 1, registerNumber: 1 })
    .collation({ locale: "en", numericOrdering: true })
    .limit(600)
    .lean();
  if (!students.length) return res.json({ exam: { _id: `old-${examCode}`, code: examCode, ...examLabel(examCode), publishedAt: null }, data: [] });

  const ids = students.map((s) => s._id);
  const rows = await CourseResult.find({ student: { $in: ids } }).lean();
  const subjects = new Map(
    (await Subject.find({ _id: { $in: [...new Set(rows.map((r) => String(r.subject)))] } }).select("name subjectCategory sequence iaMax theoryExamMax practicalExamMax credit").lean()).map((s) => [
      String(s._id),
      s,
    ])
  );
  const byStudent = new Map();
  for (const r of rows) {
    const k = String(r.student);
    if (!byStudent.has(k)) byStudent.set(k, []);
    byStudent.get(k).push(r);
  }

  const wantSem = Number(req.query.semester) || null;
  let declaredAt = null;
  const cards = [];
  for (const st of students) {
    const all = byStudent.get(String(st._id)) || [];
    const mine = all.filter((r) => r.source === "IMPORT" && r.examCode === examCode);
    if (!mine.length) continue;
    const at = new Date(Math.max(...mine.map((r) => new Date(r.declaredAt).getTime())));
    declaredAt = declaredAt && declaredAt > at ? declaredAt : at;
    const semester = Math.max(...mine.map((r) => Number(r.semester) || 0)) || null;
    if (wantSem && semester !== wantSem) continue;

    const course = (r) => {
      const sub = subjects.get(String(r.subject)) || {};
      const cat = String(sub.subjectCategory || "REGULAR").toUpperCase();
      const kind = ["BRIDGE", "AUDIT"].includes(cat) ? cat : Number(r.semester) < semester ? "BACKLOG" : cat === "ELECTIVE" ? "ELECTIVE" : "REGULAR";
      return {
        subject: r.subject,
        code: r.code,
        name: sub.name || r.code,
        semester: r.semester,
        sequence: sub.sequence ?? "",
        kind,
        credit: Number(r.credit ?? sub.credit) || 0,
        cie: r.cie,
        cieMax: Number(sub.iaMax) || 0,
        theory: r.see,
        theoryMax: Number(sub.theoryExamMax) || 0,
        practical: r.practical,
        practicalMax: Number(sub.practicalExamMax) || 0,
        total: r.total,
        max: r.max,
        grade: r.grade || (r.status === "PASS" ? "" : r.status === "WITHHELD" ? "" : "F"),
        points: r.status === "PASS" ? Number(r.gradePoint) || 0 : 0,
        status: r.status,
        marksText: r.marksText || "",
        rejected: Boolean(r.rejected),
      };
    };
    const courses = bySyllabus(mine.map(course));
    const sgpa = gpa(courses.filter((c) => c.kind !== "BACKLOG" && !c.rejected));

    // CGPA up to this exam: latest attempt of every course declared by then
    const latest = new Map();
    for (const r of all) {
      if (r.rejected || new Date(r.declaredAt) > at) continue;
      const k = String(r.subject);
      const prev = latest.get(k);
      if (!prev || new Date(r.declaredAt) > new Date(prev.declaredAt)) latest.set(k, r);
    }
    const cgpa = gpa([...latest.values()].map(course));

    cards.push({
      _id: `${st._id}-${examCode}`,
      registerNumber: st.registerNumber,
      name: st.name,
      fatherName: st.fatherName || "",
      imageUrl: st.imageUrl || "",
      department: st.department,
      semester,
      batch: st.batch,
      admissionType: st.admissionType,
      backPapersOnly: courses.every((c) => c.kind === "BACKLOG"),
      rejection: null,
      result: {
        courses,
        sgpa: sgpa.value,
        cgpa: cgpa.value,
        credits: { registered: sgpa.registered, earned: sgpa.earned },
        outcome: courses.some((c) => c.status === "WITHHELD") ? "WITHHELD" : courses.every((c) => c.status === "PASS") ? "PASS" : "FAIL",
        progression: null,
      },
    });
  }

  await audit(req, "EARLIER_MARK_CARDS_PRINTED", null, { examCode, count: cards.length, department: req.query.department || "", q: req.query.q || "" });
  res.json({ exam: { _id: `old-${examCode}`, code: examCode, ...examLabel(examCode), publishedAt: declaredAt, earlier: true }, data: cards });
};
