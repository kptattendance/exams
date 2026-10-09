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

import mongoose from "mongoose";

import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import Subject from "../models/Subject.js";
import AuditLog from "../models/AuditLog.js";

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
      if (value === null || value === undefined) n++;
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
    status: doc.status,
    students: (doc.students || []).length,
    subjects: (doc.subjects || []).length,
    empty: emptyCount(doc, type),
    submittedAt: doc.submittedAt,
    confirmedAt: doc.confirmedAt,
    updatedAt: doc.updatedAt,
    returnedReason: doc.returnedReason || "",
  };
}

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
        .select("iaMax iaMin")
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
      if (value === null) flag = "empty";
      else if (type === "attendance" && sub.max > 0) {
        pct = Math.round((value / sub.max) * 1000) / 10;
        if (pct < MIN_ATTENDANCE) flag = "low";
        if (value > sub.max) flag = "over";
      } else if (type === "ia") {
        const scaled = sub.max && sub.iaMax && sub.max !== sub.iaMax ? (value / sub.max) * sub.iaMax : value;
        if (sub.iaMin && scaled < sub.iaMin) flag = "low";
        if (sub.max && value > sub.max) flag = "over";
      }
      if (flag === "low") low++;
      return { value, pct, flag };
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
    },
  });
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
  res.json({
    data: summary(doc.toObject(), req.params.type),
    message: `${LABEL[req.params.type]} for ${doc.department.toUpperCase()} semester ${doc.semester} is frozen.`,
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
  res.json({
    data: summary(doc.toObject(), req.params.type),
    message: `Sent back to the ${doc.department.toUpperCase()} HOD for correction.`,
  });
};
