// src/controllers/timetableController.js
//
// Written-exam timetable of an examination.
//   GET  /api/exams/:id/timetable           papers to schedule, saved dates, clashes
//   PUT  /api/exams/:id/timetable           save dates / session times (draft)
//   POST /api/exams/:id/timetable/suggest   fill empty papers automatically (not saved)
//   POST /api/exams/:id/timetable/publish   { publish: true|false }

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import ExamRegistration from "../models/ExamRegistration.js";
import AuditLog from "../models/AuditLog.js";
import { buildPapers, checkTimetable, suggestTimetable } from "../services/exams/timetable.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const logAction = (req, action, entityId, details = {}) =>
  AuditLog.create({
    action,
    entity: "ExamTimetable",
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

async function load(examId) {
  const exam = await Exam.findById(examId).lean();
  if (!exam) return {};
  const regs = await ExamRegistration.find({ exam: exam._id })
    .select("department subjects.code subjects.name subjects.semester subjects.kind subjects.hasTheory")
    .lean();
  return { exam, ...buildPapers(regs) };
}

function view(exam, papers, studentCodes, entries) {
  const tt = exam.timetable || {};
  const sessions = {
    FN: { start: tt.sessions?.FN?.start || "10:00", end: tt.sessions?.FN?.end || "13:00" },
    AN: { start: tt.sessions?.AN?.start || "14:00", end: tt.sessions?.AN?.end || "17:00" },
  };
  return {
    exam: { _id: exam._id, name: exam.name, academicYear: exam.academicYear, semesters: exam.semesters },
    sessions,
    entries,
    published: Boolean(tt.published),
    publishedAt: tt.publishedAt || null,
    papers,
    // which papers each student writes (indexes into papers) – lets the page
    // check clashes instantly while dates are being changed
    studentCodes,
    check: checkTimetable(entries, papers, studentCodes),
  };
}

// GET /api/exams/:id/timetable
export const getTimetable = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const { exam, papers, studentCodes } = await load(req.params.id);
  if (!exam) return fail(res, 404, "Exam not found.");
  // drop dates of papers that no longer exist (e.g. registration refreshed)
  const codes = new Set(papers.map((p) => p.code));
  const entries = (exam.timetable?.entries || []).filter((e) => codes.has(e.code));
  res.json({ data: view(exam, papers, studentCodes, entries) });
};

function readEntries(body, papers) {
  const codes = new Set(papers.map((p) => p.code));
  const out = [];
  const seen = new Set();
  for (const e of Array.isArray(body.entries) ? body.entries : []) {
    const code = String(e.code || "").toUpperCase();
    if (!code || !e.date) continue; // empty row = not scheduled yet
    if (!codes.has(code)) throw new Error(`${code} is not a written paper in this exam.`);
    if (!DATE.test(e.date)) throw new Error(`Date for ${code} is not valid.`);
    if (!["FN", "AN"].includes(e.session)) throw new Error(`Choose morning or afternoon for ${code}.`);
    if (seen.has(code)) throw new Error(`${code} appears twice.`);
    seen.add(code);
    out.push({ code, date: e.date, session: e.session });
  }
  return out;
}

// PUT /api/exams/:id/timetable  { entries: [{code,date,session}], sessions: {FN:{start,end}, AN:{start,end}} }
export const saveTimetable = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const { exam, papers, studentCodes } = await load(req.params.id);
  if (!exam) return fail(res, 404, "Exam not found.");

  let entries;
  try {
    entries = readEntries(req.body || {}, papers);
  } catch (e) {
    return fail(res, 400, e.message);
  }
  const set = { "timetable.entries": entries, "timetable.updatedBy": req.user?.email || req.user?.id || "" };
  const s = req.body?.sessions;
  if (s) {
    for (const k of ["FN", "AN"]) {
      for (const t of ["start", "end"]) {
        if (!TIME.test(s[k]?.[t] || "")) return fail(res, 400, "Session times must look like 10:00.");
        set[`timetable.sessions.${k}.${t}`] = s[k][t];
      }
    }
    if (s.FN.start >= s.FN.end || s.AN.start >= s.AN.end) return fail(res, 400, "A session must end after it starts.");
    if (s.FN.end > s.AN.start) return fail(res, 400, "The morning session must end before the afternoon one starts.");
  }

  const check = checkTimetable(entries, papers, studentCodes);
  // a published timetable must stay clash-free
  if (exam.timetable?.published && (check.clashes.length || check.unscheduled.length)) {
    return fail(res, 409, "This timetable is published. Fix clashes and give every paper a date, or unpublish it first.");
  }
  const updated = await Exam.findByIdAndUpdate(exam._id, { $set: set }, { returnDocument: "after" }).lean();
  await logAction(req, "TIMETABLE_SAVED", exam._id, { papers: entries.length, clashes: check.clashes.length });
  res.json({ data: view(updated, papers, studentCodes, entries), message: "Timetable saved." });
};

// POST /api/exams/:id/timetable/suggest  { startDate, holidays: ["2026-11-20"], entries (current, kept) }
export const suggest = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const { exam, papers, studentCodes } = await load(req.params.id);
  if (!exam) return fail(res, 404, "Exam not found.");
  let keep;
  try {
    keep = req.body?.keepExisting === false ? [] : readEntries(req.body || {}, papers);
    const holidays = (req.body?.holidays || []).filter((d) => DATE.test(d));
    const { entries, unplaced } = suggestTimetable(papers, studentCodes, { startDate: req.body?.startDate, holidays, keep });
    res.json({ data: { entries, unplaced, check: checkTimetable(entries, papers, studentCodes) } });
  } catch (e) {
    return fail(res, 400, e.message);
  }
};

// POST /api/exams/:id/timetable/publish  { publish: true|false }
export const publishTimetable = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid exam id.");
  const { exam, papers, studentCodes } = await load(req.params.id);
  if (!exam) return fail(res, 404, "Exam not found.");
  const publish = req.body?.publish !== false;
  const entries = exam.timetable?.entries || [];
  if (publish) {
    if (!papers.length) return fail(res, 400, "No written papers yet. Register students first.");
    const check = checkTimetable(entries, papers, studentCodes);
    if (check.unscheduled.length) return fail(res, 409, `${check.unscheduled.length} papers have no date yet: ${check.unscheduled.slice(0, 5).join(", ")}${check.unscheduled.length > 5 ? "…" : ""}`);
    if (check.clashes.length) return fail(res, 409, `${check.clashes.length} clashes must be fixed before publishing.`);
  }
  const updated = await Exam.findByIdAndUpdate(
    exam._id,
    { $set: { "timetable.published": publish, "timetable.publishedAt": publish ? new Date() : null } },
    { returnDocument: "after" }
  ).lean();
  await logAction(req, publish ? "TIMETABLE_PUBLISHED" : "TIMETABLE_UNPUBLISHED", exam._id);
  res.json({
    data: view(updated, papers, studentCodes, entries.filter((e) => papers.some((p) => p.code === e.code))),
    message: publish ? "Timetable published." : "Timetable moved back to draft.",
  });
};
