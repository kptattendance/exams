// src/controllers/sheetReviewController.js
//
// Exam Officer's inbox for the HOD's Final IA and Final attendance sheets.
// No need to pick year / department / semester / batch: every sheet is
// listed, and the Exam Officer opens it, then freezes it or sends it back.
//
//   GET  /api/sheet-review?type=ia|attendance&status=submitted|confirmed|draft
//   GET  /api/sheet-review/:type/:id
//   POST /api/sheet-review/:type/:id/freeze
//   POST /api/sheet-review/:type/:id/return     { reason }
//   DELETE /api/sheet-review/:type/:id          { reason }  Admin only, running year only
// Verification (COE only), after the freeze:
//   POST /api/sheet-review/:type/:id/corrections { changes: [{ studentId, subjectId, value }] }
//   POST /api/sheet-review/:type/:id/verify      the FINAL freeze: nobody can change it after this

import mongoose from "mongoose";

import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import Subject from "../models/Subject.js";
import AuditLog from "../models/AuditLog.js";
import { refreshAfterChange, refreshNote } from "../services/exams/autoRefresh.js";
import { getAcademicYear } from "../services/academicYear.js";
import { binSheet } from "../services/recycleBin.js";
import Exam from "../models/Exam.js";
import { applyCorrections, verificationView } from "../services/exams/sheetVerification.js";

const MODELS = { ia: FinalIA, attendance: FinalAttendance };
const LABEL = { ia: "Final IA", attendance: "Final attendance" };
const MIN_ATTENDANCE = 75;

const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";

const log = (req, action, id, details) =>
  AuditLog.create({
    action,
    entity: "FinalSheet",
    entityId: id,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    details,
  }).catch(() => {});

function pickModel(req, res) {
  const Model = MODELS[req.params.type];
  if (!Model) return fail(res, 400, "Type must be ia or attendance."), null;
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid sheet id."), null;
  return Model;
}

// How many values are still empty in a sheet
function emptyCount(doc, type) {
  let n = 0;
  for (const st of doc.students || []) {
    const vals = type === "ia" ? st.marks : st.attendance;
    for (const sub of doc.subjects || []) {
      const v = (vals || []).find((x) => String(x.subjectId) === String(sub.subjectId));
      const value = type === "ia" ? v?.marks : v?.classesAttended;
      if ((value === null || value === undefined) && !v?.notRequired) n++;
    }
  }
  return n;
}

function summary(doc, type) {
  return {
    _id: doc._id,
    type,
    academicYear: doc.academicYear,
    department: doc.department,
    semester: doc.semester,
    batch: doc.batch,
    shift: doc.shift === "EVENING" ? "EVENING" : "DAY",
    status: doc.status,
    students: (doc.students || []).length,
    subjects: (doc.subjects || []).length,
    empty: emptyCount(doc, type),
    submittedAt: doc.submittedAt,
    confirmedAt: doc.confirmedAt,
    updatedAt: doc.updatedAt,
    returnedReason: doc.returnedReason || "",
    verified: doc.verification?.state === "verified",
    verifiedAt: doc.verification?.verifiedAt || null,
    corrections: (doc.verification?.corrections || []).length,
  };
}

const isVerified = (doc) => doc.verification?.state === "verified";
const FINAL = "This sheet is verified and finally frozen. It cannot be changed by anyone.";
const IN_VERIFICATION = "The COE has already made corrections on this sheet after verification, so it can no longer be sent back or deleted.";
const hasCorrections = (doc) => (doc.verification?.corrections || []).length > 0;

// Corrections are possible until the results of the exam of this class are published
const resultsOut = (doc) =>
  Exam.exists({ academicYear: doc.academicYear, semesters: doc.semester, "results.publishedAt": { $type: "date" } });

// GET /api/sheet-review?type=&status=
export const listSheets = async (req, res) => {
  const types = req.query.type && MODELS[req.query.type] ? [req.query.type] : ["ia", "attendance"];
  const filter = {};
  if (["draft", "submitted", "confirmed"].includes(req.query.status)) filter.status = req.query.status;

  const out = [];
  const counts = { draft: 0, submitted: 0, confirmed: 0 };
  for (const t of types) {
    const docs = await MODELS[t].find(filter).sort({ academicYear: -1, semester: 1, department: 1 }).lean();
    out.push(...docs.map((d) => summary(d, t)));
    for (const c of await MODELS[t].aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }])) {
      if (c._id in counts) counts[c._id] += c.n;
    }
  }
  // waiting sheets first, oldest submission first
  out.sort(
    (a, b) =>
      (a.status === "submitted" ? 0 : 1) - (b.status === "submitted" ? 0 : 1) ||
      new Date(a.submittedAt || a.updatedAt) - new Date(b.submittedAt || b.updatedAt)
  );
  res.json({ data: out, counts });
};

// GET /api/sheet-review/:type/:id  – the full sheet, with problems marked
export const getSheet = async (req, res) => {
  const Model = pickModel(req, res);
  if (!Model) return;
  const type = req.params.type;
  const doc = await Model.findById(req.params.id).lean();
  if (!doc) return fail(res, 404, "Sheet not found. It may have been deleted.");

  const subjectInfo = new Map(
    (
      await Subject.find({ _id: { $in: (doc.subjects || []).map((s) => s.subjectId) } })
        .select("iaMax iaMin subjectCategory")
        .lean()
    ).map((s) => [String(s._id), s])
  );

  const subjects = (doc.subjects || []).map((s) => {
    const info = subjectInfo.get(String(s.subjectId)) || {};
    return {
      subjectId: s.subjectId,
      code: s.code,
      name: s.name,
      max: type === "ia" ? s.maxMarks ?? info.iaMax ?? null : s.maxClasses ?? null,
      iaMax: info.iaMax ?? null,
      iaMin: info.iaMin ?? null,
      subjectCategory: info.subjectCategory || "", // bridge courses print in their own table
    };
  });

  let low = 0;
  const students = (doc.students || []).map((st) => {
    const vals = type === "ia" ? st.marks : st.attendance;
    const cells = subjects.map((sub) => {
      const v = (vals || []).find((x) => String(x.subjectId) === String(sub.subjectId));
      const value = type === "ia" ? v?.marks ?? null : v?.classesAttended ?? null;
      let flag = "";
      let pct = null;
      if (v?.notRequired) flag = "na"; // a bridge course this student does not take
      else if (value === null) flag = "empty";
      else if (type === "attendance" && sub.max > 0) {
        pct = (value / sub.max) * 100; // shown to 2 decimals; the same check as exam eligibility
        if (pct + 1e-9 < MIN_ATTENDANCE) flag = "low";
        if (value > sub.max) flag = "over";
      } else if (type === "ia") {
        const scaled = sub.max && sub.iaMax && sub.max !== sub.iaMax ? (value / sub.max) * sub.iaMax : value;
        if (sub.iaMin && scaled < sub.iaMin) flag = "low";
        if (sub.max && value > sub.max) flag = "over";
      }
      if (flag === "low") low++;
      const corrected = (doc.verification?.corrections || []).some((c) => String(c.studentId) === String(st.studentId) && String(c.subjectId) === String(sub.subjectId));
      return { value, pct, flag, corrected };
    });
    return { studentId: st.studentId, registerNumber: st.registerNumber, name: st.studentName, cells };
  });

  res.json({
    data: {
      ...summary(doc, type),
      label: LABEL[type],
      minAttendance: MIN_ATTENDANCE,
      lowCount: low,
      subjects,
      students,
      verification: verificationView(doc),
      resultsPublished: Boolean(await resultsOut(doc)),
    },
  });
};

// POST /api/sheet-review/:type/:id/corrections  (COE only)
// The changes the verifier marked on the "before verification" copy
export const correctSheet = async (req, res) => {
  const Model = pickModel(req, res);
  if (!Model) return;
  const type = req.params.type;
  const changes = Array.isArray(req.body?.changes) ? req.body.changes.slice(0, 5000) : [];
  if (!changes.length) return fail(res, 400, "Nothing to save.");
  const doc = await Model.findById(req.params.id);
  if (!doc) return fail(res, 404, "Sheet not found.");
  if (isVerified(doc)) return fail(res, 423, FINAL);
  if (doc.status !== "confirmed") return fail(res, 409, "Only a frozen sheet can be corrected after verification.");
  if (await resultsOut(doc)) return fail(res, 423, "The results of this class are published. Marks and attendance can no longer be corrected.");
  const info = new Map(
    (await Subject.find({ _id: { $in: (doc.subjects || []).map((s) => s.subjectId) } }).select("iaMax iaMin").lean()).map((s) => [String(s._id), s])
  );
  const r = applyCorrections(doc, type, changes, info, who(req));
  if (r.error) return fail(res, 400, r.error);
  if (!r.changed) return res.json({ message: "Nothing changed.", data: { changed: 0, crossed: [] } });
  doc.markModified("students");
  doc.markModified("verification");
  await doc.save();
  await log(req, `${type.toUpperCase()}_SHEET_CORRECTED`, doc._id, {
    department: doc.department,
    semester: doc.semester,
    batch: doc.batch,
    changed: r.changed,
    changes: changes.slice(0, 200),
  });
  const auto = await refreshAfterChange([{ department: doc.department, semester: doc.semester }], `${LABEL[type]} corrected after verification`);
  const crossing = r.crossed.length
    ? ` Crossed the minimum: ${r.crossed.map((x) => `${x.registerNumber} (${x.code}: ${x.nowLow ? "now below" : "now above"})`).join(", ")} – check their eligibility and hall tickets.`
    : "";
  res.json({ message: `${r.changed} correction${r.changed === 1 ? "" : "s"} saved.${refreshNote(auto)}${crossing}`, data: { changed: r.changed, crossed: r.crossed } });
};

// POST /api/sheet-review/:type/:id/verify  (COE only) – the FINAL freeze
export const verifySheet = async (req, res) => {
  const Model = pickModel(req, res);
  if (!Model) return;
  const type = req.params.type;
  const doc = await Model.findById(req.params.id);
  if (!doc) return fail(res, 404, "Sheet not found.");
  if (isVerified(doc)) return fail(res, 409, "Already verified and finally frozen.");
  if (doc.status !== "confirmed") return fail(res, 409, "Only a frozen sheet can be finally frozen.");
  const empty = emptyCount(doc, type);
  if (empty) return fail(res, 409, `${empty} entr${empty === 1 ? "y is" : "ies are"} still empty. Fill them first – nothing can be changed after the final freeze.`);
  doc.verification.state = "verified";
  doc.verification.verifiedAt = new Date();
  doc.verification.verifiedBy = who(req);
  await doc.save();
  await log(req, `${type.toUpperCase()}_SHEET_VERIFIED`, doc._id, {
    academicYear: doc.academicYear,
    department: doc.department,
    semester: doc.semester,
    batch: doc.batch,
    corrections: doc.verification.corrections.length,
  });
  res.json({ message: `${LABEL[type]} of ${doc.department.toUpperCase()} semester ${doc.semester} is verified and finally frozen. The HOD can now print the after-verification copy.` });
};

// POST /api/sheet-review/:type/:id/freeze
export const freezeSheet = async (req, res) => {
  const Model = pickModel(req, res);
  if (!Model) return;
  const doc = await Model.findById(req.params.id);
  if (!doc) return fail(res, 404, "Sheet not found.");
  if (doc.status === "draft") return fail(res, 409, "The HOD has not submitted this sheet yet.");
  if (doc.status === "confirmed") return fail(res, 409, "Already frozen.");
  doc.status = "confirmed";
  doc.confirmedBy = who(req);
  doc.confirmedAt = new Date();
  await doc.save();
  await log(req, `${req.params.type.toUpperCase()}_SHEET_FROZEN`, doc._id, {
    academicYear: doc.academicYear,
    department: doc.department,
    semester: doc.semester,
    batch: doc.batch,
  });
  const auto = await refreshAfterChange([{ department: doc.department, semester: doc.semester }], `${LABEL[req.params.type]} frozen`);
  res.json({
    data: summary(doc.toObject(), req.params.type),
    message: `${LABEL[req.params.type]} for ${doc.department.toUpperCase()} semester ${doc.semester} is frozen.${refreshNote(auto)}`,
  });
};

// POST /api/sheet-review/:type/:id/return  { reason }
// Sends a submitted (or frozen, if a mistake is found) sheet back to the HOD.
export const returnSheet = async (req, res) => {
  const Model = pickModel(req, res);
  if (!Model) return;
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 3) return fail(res, 400, "Write what the HOD must correct.");
  const doc = await Model.findById(req.params.id);
  if (!doc) return fail(res, 404, "Sheet not found.");
  if (isVerified(doc)) return fail(res, 423, FINAL);
  if (hasCorrections(doc)) return fail(res, 423, IN_VERIFICATION);
  if (doc.status === "draft") return fail(res, 409, "This sheet is already with the HOD.");
  const wasFrozen = doc.status === "confirmed";
  doc.status = "draft";
  doc.confirmedBy = null;
  doc.confirmedAt = null;
  doc.returnedReason = reason;
  doc.returnedAt = new Date();
  doc.returnedBy = who(req);
  await doc.save();
  await log(req, `${req.params.type.toUpperCase()}_SHEET_RETURNED`, doc._id, {
    department: doc.department,
    semester: doc.semester,
    batch: doc.batch,
    reason,
    wasFrozen,
  });
  const auto = wasFrozen ? await refreshAfterChange([{ department: doc.department, semester: doc.semester }], `${LABEL[req.params.type]} sent back`) : null;
  res.json({
    data: summary(doc.toObject(), req.params.type),
    message: `Sent back to the ${doc.department.toUpperCase()} HOD for correction.${refreshNote(auto)}`,
  });
};

// DELETE /api/sheet-review/:type/:id  { reason }
// Admin only: removes a sheet of the RUNNING academic year (even a frozen one)
// so that the HOD enters it again from the start. Usually "Send back to HOD"
// is enough – it keeps the marks. A full copy of the deleted sheet is kept in
// the audit log.
export const deleteSheet = async (req, res) => {
  const Model = pickModel(req, res);
  if (!Model) return;
  const reason = String(req.body?.reason || "").trim();
  if (reason.length < 5) return fail(res, 400, "Write why the sheet is deleted.");
  const doc = await Model.findById(req.params.id).lean();
  if (!doc) return fail(res, 404, "Sheet not found. It may have been deleted already.");
  if (isVerified(doc)) return fail(res, 423, FINAL);
  if (hasCorrections(doc)) return fail(res, 423, IN_VERIFICATION);
  const year = await getAcademicYear();
  if (doc.academicYear !== year)
    return fail(res, 409, `Only sheets of the running academic year (${year}) can be deleted. This sheet is of ${doc.academicYear}.`);
  // to the Recycle bin (restorable for 30 days)
  await binSheet(req.params.type, doc, { by: who(req), reason });
  await log(req, `${req.params.type.toUpperCase()}_SHEET_DELETED`, doc._id, {
    academicYear: doc.academicYear,
    department: doc.department,
    semester: doc.semester,
    batch: doc.batch,
    shift: doc.shift || "DAY",
    status: doc.status,
    reason,
    sheet: doc, // the full sheet, to restore it by hand if ever needed
  });
  const auto = doc.status === "confirmed" ? await refreshAfterChange([{ department: doc.department, semester: doc.semester }], `${LABEL[req.params.type]} deleted`) : null;
  res.json({
    message: `${LABEL[req.params.type]} of ${doc.department.toUpperCase()} semester ${doc.semester} (batch ${doc.batch}) moved to the Recycle bin (restorable for 30 days). The HOD can enter it again.${refreshNote(auto)}`,
  });
};
