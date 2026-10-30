// src/controllers/oldResultController.js
//
// Admin only: bring the semester results of earlier exams (made in the old
// results software) into the website, so back papers and the marks history
// of 2nd / 3rd-year students are known.
//   POST /api/old-results/preview   check the "Results" Excel, nothing saved
//   POST /api/old-results           save it (needs the verification code)
// Importing the same file again only updates – nothing is doubled.
// Rows of students not yet in the website are left out; import those
// students, then upload the same results file again.

import XLSX from "xlsx";

import Student from "../models/Student.js";
import Subject from "../models/Subject.js";
import CourseResult from "../models/CourseResult.js";
import AuditLog from "../models/AuditLog.js";
import { REQUIRED_OLD_COLUMNS, examDate, mapOldColumns, oldRowResult, sdCodeOf } from "../services/exams/oldResults.js";
import { EVENING_CODE } from "../services/studentImport/rules.js";

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const MAX_PROBLEMS = 500;

// the sheet with the result rows (the workbook may hold other sheets too)
function readRows(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: false });
    if (!rows.length) continue;
    const map = mapOldColumns(Object.keys(rows[0]));
    if (map.regNo && map.subId) {
      const missing = REQUIRED_OLD_COLUMNS.filter((f) => !map[f]);
      if (missing.length) throw Object.assign(new Error(`The sheet "${name}" is missing columns: ${missing.join(", ")}.`), { status: 400 });
      return { sheet: name, map, rows };
    }
  }
  throw Object.assign(new Error("No results sheet found. Upload the old software's Results Excel (columns RSLTS_RegNo…, RSLTS_SubID…, RSLTS_IAMarks…)."), { status: 400 });
}

async function analyse(buffer) {
  const { sheet, map, rows } = readRows(buffer);
  const val = (r, f) => (map[f] ? String(r[map[f]] ?? "").trim() : "");

  const regNos = [...new Set(rows.map((r) => val(r, "regNo").toUpperCase()).filter(Boolean))];
  const subIds = [...new Set(rows.map((r) => val(r, "subId").toUpperCase()).filter(Boolean))];
  const [students, subjects] = await Promise.all([
    Student.find({ registerNumber: { $in: regNos } }).select("registerNumber name department semester").lean(),
    Subject.find({ subjectId: { $in: subIds } }).select("subjectId code department semester subjectCategory iaMax theoryExamMax practicalExamMax totalMax credit").lean(),
  ]);
  const studentOf = new Map(students.map((s) => [s.registerNumber, s]));
  const subjectOf = (subId, dept, sem) => {
    const list = subjects.filter((s) => s.subjectId === subId);
    return (
      list.find((s) => s.department === dept && s.semester === sem && s.subjectCategory === "REGULAR") ||
      list.find((s) => s.department === dept && s.semester === sem) ||
      list.find((s) => s.department === dept) ||
      null
    );
  };

  const problems = [];
  const problem = (row, level, message) => problems.push({ row: row.rowNumber, regNo: row.regNo, subId: row.subId, examCode: row.examCode, level, message });
  const ready = []; // rows to save
  const keyed = new Map(); // student|subject|exam -> index in ready (a repeated row: the last one counts)
  const missing = new Map(); // students not in the website
  const exams = new Map();
  let skipped = 0;
  let errors = 0;

  rows.forEach((raw, i) => {
    const row = {
      rowNumber: i + 2,
      regNo: val(raw, "regNo").toUpperCase(),
      subId: val(raw, "subId").toUpperCase(),
      examCode: val(raw, "examId").toUpperCase(),
    };
    if (!row.regNo && !row.subId) return; // empty line
    const err = (m) => {
      errors++;
      problem(row, "error", m);
    };
    if (!row.regNo || !row.subId) return err("Register number or subject code is missing.");
    const when = examDate(row.examCode);
    if (!when) return err(`Exam code "${row.examCode}" is not understood (expected e.g. 25S or 26A).`);

    const sd = sdCodeOf(val(raw, "sdCode"));
    const dept = (val(raw, "course") || sd?.department || row.regNo.slice(3, 5)).toUpperCase();
    const sem = Number(val(raw, "semester")) || sd?.semester || null;
    const subject = subjectOf(row.subId, dept, sem);
    if (!subject) return err(`Subject ${row.subId} (${dept}, semester ${sem ?? "?"}) is not in the website – add it under Subjects first.`);

    const out = oldRowResult(
      { ia: val(raw, "ia"), theory: val(raw, "theory"), practical: val(raw, "practical"), status: val(raw, "status"), gradeId: val(raw, "gradeId") },
      subject
    );
    if (out.skip) {
      skipped++;
      return;
    }
    if (out.error) return err(out.error);
    out.warnings.forEach((w) => problem(row, "warning", w));

    const ex = exams.get(row.examCode) || { code: row.examCode, at: when, rows: 0, pass: 0, notPass: 0 };
    ex.rows++;
    out.result.status === "PASS" ? ex.pass++ : ex.notPass++;
    exams.set(row.examCode, ex);

    const student = studentOf.get(row.regNo);
    if (!student) {
      const m = missing.get(row.regNo) || { regNo: row.regNo, department: dept, rows: 0, evening: row.regNo.startsWith(EVENING_CODE) };
      m.rows++;
      missing.set(row.regNo, m);
      return;
    }
    if (student.department.toUpperCase() !== dept)
      problem(row, "warning", `Student is in ${student.department.toUpperCase()} on the website but this result is for ${dept}.`);

    const key = `${student._id}|${subject._id}|${row.examCode}`;
    const item = { student, subject, examCode: row.examCode, declaredAt: when, result: out.result };
    if (keyed.has(key)) {
      problem(row, "warning", "The same subject and exam appears twice for this student – the later row is used.");
      ready[keyed.get(key)] = item;
    } else {
      keyed.set(key, ready.length);
      ready.push(item);
    }
  });

  // per student: subjects whose latest attempt (in this file) is not a pass
  const perStudent = new Map();
  for (const it of ready) {
    const k = it.student.registerNumber;
    if (!perStudent.has(k)) perStudent.set(k, { student: it.student, latest: new Map() });
    const latest = perStudent.get(k).latest;
    const prev = latest.get(it.subject.subjectId);
    if (!prev || prev.declaredAt <= it.declaredAt) latest.set(it.subject.subjectId, it);
  }
  const studentRows = [...perStudent.values()]
    .map(({ student, latest }) => {
      const list = [...latest.values()];
      return {
        regNo: student.registerNumber,
        name: student.name,
        department: student.department.toUpperCase(),
        semester: student.semester,
        evening: student.registerNumber.startsWith(EVENING_CODE),
        subjects: list.length,
        passed: list.filter((x) => x.result.status === "PASS").length,
        backPapers: list
          .filter((x) => x.result.status !== "PASS")
          .map((x) => ({ subjectId: x.subject.subjectId, semester: x.subject.semester, status: x.result.status, examCode: x.examCode }))
          .sort((a, b) => a.semester - b.semester || a.subjectId.localeCompare(b.subjectId)),
      };
    })
    .sort((a, b) => a.regNo.localeCompare(b.regNo));

  return {
    sheet,
    ready,
    errors,
    summary: {
      sheet,
      totals: {
        rows: rows.length,
        ready: ready.length,
        skipped,
        errors,
        warnings: problems.filter((p) => p.level === "warning").length,
        missingStudentRows: [...missing.values()].reduce((a, m) => a + m.rows, 0),
      },
      exams: [...exams.values()].sort((a, b) => a.at - b.at).map(({ at, ...e }) => e),
      missingStudents: [...missing.values()].sort((a, b) => a.regNo.localeCompare(b.regNo)),
      students: studentRows,
      problems: problems.slice(0, MAX_PROBLEMS),
      moreProblems: Math.max(0, problems.length - MAX_PROBLEMS),
    },
  };
}

const excelError = (res, e) => {
  if (e.status) return fail(res, e.status, e.message);
  console.error("[oldResults]", e);
  return fail(res, 500, "Could not read the Excel file. Please check it and try again.");
};

// POST /api/old-results/preview
export const previewOldResults = async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, "Please choose the Results Excel file.");
    const { summary } = await analyse(req.file.buffer);
    res.json({ fileName: req.file.originalname, ...summary });
  } catch (e) {
    excelError(res, e);
  }
};

// POST /api/old-results
export const importOldResults = async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, "Please choose the Results Excel file.");
    const { ready, errors, summary } = await analyse(req.file.buffer);
    const preview = { fileName: req.file.originalname, ...summary };
    if (errors) return fail(res, 400, "Fix the errors in the Excel and upload it again. Nothing was imported.", { preview });
    if (!ready.length) return fail(res, 400, "Nothing to import – none of these students are in the website yet.", { preview });

    const ops = ready.map((it) => ({
      updateOne: {
        filter: { student: it.student._id, subject: it.subject._id, source: "IMPORT", examCode: it.examCode },
        update: {
          $set: { ...it.result, code: it.subject.code, exam: null, declaredAt: it.declaredAt },
          $setOnInsert: { student: it.student._id, subject: it.subject._id, source: "IMPORT", examCode: it.examCode },
        },
        upsert: true,
      },
    }));
    const r = await CourseResult.bulkWrite(ops, { ordered: false });

    await AuditLog.create({
      action: "OLD_RESULTS_IMPORTED",
      entity: "CourseResult",
      actorClerkId: req.user?.id || "unknown",
      actorEmail: req.user?.email || "",
      actorRole: req.user?.role || "",
      ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
      details: {
        fileName: req.file.originalname.slice(0, 200),
        rows: ready.length,
        added: r.upsertedCount,
        updated: r.modifiedCount,
        exams: summary.exams.map((e) => e.code),
        studentsNotYetInWebsite: summary.missingStudents.length,
      },
    }).catch(() => {});

    res.status(201).json({
      ...preview,
      saved: { added: r.upsertedCount, updated: r.modifiedCount, unchanged: ready.length - r.upsertedCount - r.modifiedCount },
      message: `Results saved: ${r.upsertedCount} added, ${r.modifiedCount} updated${summary.missingStudents.length ? ` – ${summary.missingStudents.length} students are not in the website yet (import them, then upload this file again)` : ""}.`,
    });
  } catch (e) {
    excelError(res, e);
  }
};
