// src/services/recycleBin.js
//
// Soft delete. A deleted student (with all his records), subject or IA /
// attendance sheet goes to the Recycle bin for 30 days instead of being gone
// at once. The Admin can restore it, or delete it for good. A student's
// login and photo are removed only then, so a restore brings everything back.
// Expired entries are deleted for good whenever the bin is used (there is no
// background job on the server).

import mongoose from "mongoose";
import { clerkClient } from "@clerk/express";

import cloudinary from "../config/cloudinary.js";
import RecycleBin, { BIN_DAYS } from "../models/RecycleBin.js";
import Student from "../models/Student.js";
import ExamRegistration from "../models/ExamRegistration.js";
import AnswerScript from "../models/AnswerScript.js";
import CourseResult from "../models/CourseResult.js";
import StudentElective from "../models/StudentElective.js";
import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import PracticalBatch from "../models/PracticalBatch.js";
import Subject from "../models/Subject.js";
import { purgeStudents } from "./studentPurge.js";

const oid = (ids) => ids.map((id) => new mongoose.Types.ObjectId(String(id)));
const expiry = () => new Date(Date.now() + BIN_DAYS * 864e5);
const SHEETS = { FinalIA, FinalAttendance };

// ------------------------------------------------------------------ students

// Moves students with everything that refers to them into the bin (one entry
// per student). Returns the purge result (counts, warnings, students).
export async function binStudents(ids, { by = "", reason = "" } = {}) {
  const _ids = oid(ids);
  const students = await Student.find({ _id: { $in: _ids } }).select("+aadhaarEncrypted").lean();
  if (!students.length) return { counts: {}, warnings: [], students: [] };
  const found = students.map((s) => s._id);

  const [regs, scripts, results, electives, iaSheets, attSheets] = await Promise.all([
    ExamRegistration.find({ student: { $in: found } }).lean(),
    AnswerScript.find({ student: { $in: found } }).lean(),
    CourseResult.find({ student: { $in: found } }).lean(),
    StudentElective.find({ student: { $in: found } }).lean(),
    FinalIA.find({ "students.studentId": { $in: found } }).select("students").lean(),
    FinalAttendance.find({ "students.studentId": { $in: found } }).select("students").lean(),
  ]);
  const regIds = regs.map((r) => r._id);
  const batches = regIds.length ? await PracticalBatch.find({ "students.registration": { $in: regIds } }).select("students").lean() : [];

  const same = (a, b) => String(a) === String(b);
  const entries = students.map((st) => {
    const myRegs = regs.filter((r) => same(r.student, st._id));
    const myRegIds = new Set(myRegs.map((r) => String(r._id)));
    const rows = (sheets, model) =>
      sheets.flatMap((sh) => sh.students.filter((x) => same(x.studentId, st._id)).map((row) => ({ model, sheet: sh._id, row })));
    return {
      kind: "STUDENT",
      label: `${st.registerNumber} – ${st.name || ""}`,
      department: String(st.department || "").toLowerCase(),
      semester: st.semester ?? null,
      reason,
      deletedBy: by,
      expiresAt: expiry(),
      data: {
        students: [st],
        examregistrations: myRegs,
        answerscripts: scripts.filter((x) => same(x.student, st._id)),
        courseresults: results.filter((x) => same(x.student, st._id)),
        studentelectives: electives.filter((x) => same(x.student, st._id)),
        sheetRows: [...rows(iaSheets, "FinalIA"), ...rows(attSheets, "FinalAttendance")],
        practicalRows: batches.flatMap((b) => b.students.filter((x) => myRegIds.has(String(x.registration))).map((row) => ({ batch: b._id, row }))),
      },
      extra: { clerkId: st.clerkId || "", imagePublicId: st.imagePublicId || "" },
    };
  });
  // first the copy, then the delete (login and photo stay until "delete for good")
  await RecycleBin.insertMany(entries);
  return purgeStudents(found, { keepLoginAndPhoto: true });
}

// Inserts documents back, skipping any that are already there
async function putBack(Model, docs) {
  if (!docs?.length) return 0;
  try {
    const r = await Model.collection.insertMany(docs, { ordered: false });
    return r.insertedCount;
  } catch (e) {
    if (e?.code === 11000 || e?.writeErrors) return e.result?.insertedCount ?? e.insertedCount ?? 0;
    throw e;
  }
}

async function restoreStudent(entry) {
  const st = entry.data.students?.[0];
  if (!st) throw Object.assign(new Error("Nothing to restore."), { status: 400 });
  const clash = await Student.findOne({ $or: [{ _id: st._id }, { registerNumber: st.registerNumber }] }).select("registerNumber name").lean();
  if (clash) throw Object.assign(new Error(`Register number ${st.registerNumber} now belongs to another student (${clash.name}). Delete or change that student first.`), { status: 409 });

  await Student.collection.insertOne(st);
  const counts = {
    registrations: await putBack(ExamRegistration, entry.data.examregistrations),
    answerScripts: await putBack(AnswerScript, entry.data.answerscripts),
    results: await putBack(CourseResult, entry.data.courseresults),
    electives: await putBack(StudentElective, entry.data.studentelectives),
    sheetRows: 0,
    practicalPlaces: 0,
  };
  for (const { model, sheet, row } of entry.data.sheetRows || []) {
    const r = await SHEETS[model].updateOne({ _id: sheet, "students.studentId": { $ne: row.studentId } }, { $push: { students: row } });
    counts.sheetRows += r.modifiedCount;
  }
  for (const { batch, row } of entry.data.practicalRows || []) {
    const r = await PracticalBatch.updateOne({ _id: batch, "students.registration": { $ne: row.registration } }, { $push: { students: row } });
    counts.practicalPlaces += r.modifiedCount;
  }
  return { counts, classes: [{ department: st.department, semester: st.semester }] };
}

// ------------------------------------------------------------------ subjects and sheets

export async function binSubject(subject, { by = "", reason = "" } = {}) {
  const doc = subject.toObject ? subject.toObject() : subject;
  await RecycleBin.create({
    kind: "SUBJECT",
    label: `${doc.code} – ${doc.name || ""}`,
    department: String(doc.department || "").toLowerCase(),
    semester: doc.semester ?? null,
    reason,
    deletedBy: by,
    expiresAt: expiry(),
    data: { subjects: [doc] },
  });
  await Subject.deleteOne({ _id: doc._id });
}

export async function binSheet(type, doc, { by = "", reason = "" } = {}) {
  const Model = type === "ia" ? FinalIA : FinalAttendance;
  await RecycleBin.create({
    kind: type === "ia" ? "IA_SHEET" : "ATTENDANCE_SHEET",
    label: `${String(doc.department).toUpperCase()} sem ${doc.semester} · ${doc.batch} · ${doc.academicYear}${doc.shift === "EVENING" ? " · evening" : ""}`,
    department: String(doc.department || "").toLowerCase(),
    semester: doc.semester ?? null,
    reason,
    deletedBy: by,
    expiresAt: expiry(),
    data: { sheets: [doc] },
  });
  await Model.deleteOne({ _id: doc._id });
}

async function restoreSubject(entry) {
  const s = entry.data.subjects?.[0];
  const clash = await Subject.findOne({
    $or: [{ _id: s._id }, { department: s.department, code: s.code, semester: s.semester, schemeYear: s.schemeYear }],
  }).lean();
  if (clash) throw Object.assign(new Error(`${s.code} (${s.department}, semester ${s.semester}) exists again. Delete that subject first.`), { status: 409 });
  await Subject.collection.insertOne(s);
  return { counts: { subjects: 1 }, classes: [{ department: s.department, semester: s.semester }] };
}

async function restoreSheet(entry) {
  const sh = entry.data.sheets?.[0];
  const Model = entry.kind === "IA_SHEET" ? FinalIA : FinalAttendance;
  const clash = await Model.findOne({
    $or: [
      { _id: sh._id },
      { academicYear: sh.academicYear, department: sh.department, semester: sh.semester, batch: sh.batch, ...(sh.shift === "EVENING" ? { shift: "EVENING" } : { shift: { $ne: "EVENING" } }) },
    ],
  }).lean();
  if (clash) throw Object.assign(new Error("The HOD has made a new sheet for this class since. Delete that sheet first, then restore."), { status: 409 });
  await Model.collection.insertOne(sh);
  return { counts: { sheets: 1 }, classes: [{ department: sh.department, semester: sh.semester }] };
}

// ------------------------------------------------------------------ restore / delete for good

export async function restoreEntry(entry) {
  const fn = { STUDENT: restoreStudent, SUBJECT: restoreSubject, IA_SHEET: restoreSheet, ATTENDANCE_SHEET: restoreSheet }[entry.kind];
  const out = await fn(entry);
  await RecycleBin.deleteOne({ _id: entry._id });
  return out;
}

// The login and photo of a student go only now
export async function deleteForGood(entry) {
  const warnings = [];
  if (entry.kind === "STUDENT") {
    const { clerkId, imagePublicId } = entry.extra || {};
    if (imagePublicId) await cloudinary.uploader.destroy(imagePublicId).catch((e) => warnings.push(`photo: ${e.message}`));
    if (clerkId) await clerkClient.users.deleteUser(clerkId).catch((e) => e?.status !== 404 && warnings.push(`login: ${e.message}`));
  }
  await RecycleBin.deleteOne({ _id: entry._id });
  return warnings;
}

// Entries older than 30 days are deleted for good (a few at a time)
export async function cleanupExpired(limit = 20) {
  const old = await RecycleBin.find({ expiresAt: { $lt: new Date() } }).limit(limit).lean();
  for (const e of old) await deleteForGood(e).catch((err) => console.error("Recycle bin cleanup:", err.message));
  return old.length;
}

// A login that belongs to a student in the bin (re-importing the same email)
export async function binnedEmails(emails) {
  if (!emails.length) return new Map();
  const list = await RecycleBin.find({ kind: "STUDENT", "data.students.email": { $in: emails } }).select("label data.students.email").lean();
  return new Map(list.map((e) => [e.data.students[0].email, e.label]));
}
