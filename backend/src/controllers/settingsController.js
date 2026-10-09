// src/controllers/settingsController.js
//
//   GET  /api/settings/academic-year            everyone signed in
//   PUT  /api/settings/academic-year  { value }  Admin only
//   GET  /api/settings/stray-sheets             Admin: IA / attendance sheets saved under another year
//   POST /api/settings/stray-sheets/move        Admin: { type, id } -> move to the running year

import mongoose from "mongoose";

import FinalIA from "../models/FinalIA.js";
import FinalAttendance from "../models/FinalAttendance.js";
import AuditLog from "../models/AuditLog.js";
import { getAcademicYear, setAcademicYear } from "../services/academicYear.js";

const MODELS = { ia: FinalIA, attendance: FinalAttendance };
const fail = (res, status, error) => res.status(status).json({ error });

export const readAcademicYear = async (req, res) => {
  res.json({ data: { academicYear: await getAcademicYear() } });
};

export const writeAcademicYear = async (req, res) => {
  try {
    const before = await getAcademicYear();
    const value = await setAcademicYear(String(req.body?.value || "").trim(), req.user?.email || req.user?.id);
    AuditLog.create({
      action: "ACADEMIC_YEAR_CHANGED",
      entity: "Setting",
      actorClerkId: req.user?.id || "unknown",
      actorEmail: req.user?.email || "",
      actorRole: req.user?.role || "",
      details: { from: before, to: value },
    }).catch(() => {});
    res.json({ data: { academicYear: value }, message: `Running academic year is now ${value}.` });
  } catch (e) {
    fail(res, 400, e.message);
  }
};

export const listStraySheets = async (req, res) => {
  const year = await getAcademicYear();
  const out = [];
  for (const [type, Model] of Object.entries(MODELS)) {
    const docs = await Model.find({ academicYear: { $ne: year } })
      .select("academicYear department semester batch status updatedAt")
      .sort({ academicYear: -1, department: 1, semester: 1 })
      .lean();
    out.push(...docs.map((d) => ({ ...d, type, students: undefined })));
  }
  res.json({ data: { academicYear: year, sheets: out } });
};

export const moveStraySheet = async (req, res) => {
  const { type, id } = req.body || {};
  const Model = MODELS[type];
  if (!Model || !mongoose.Types.ObjectId.isValid(id)) return fail(res, 400, "Invalid sheet.");
  const year = await getAcademicYear();
  const doc = await Model.findById(id);
  if (!doc) return fail(res, 404, "Sheet not found.");
  if (doc.academicYear === year) return fail(res, 409, `Already in ${year}.`);
  const clash = await Model.exists({ academicYear: year, department: doc.department, semester: doc.semester, batch: doc.batch });
  if (clash) {
    return fail(res, 409, `${year} already has a sheet for ${doc.department.toUpperCase()} sem ${doc.semester} batch ${doc.batch}. Delete one of them first.`);
  }
  const from = doc.academicYear;
  doc.academicYear = year;
  await doc.save();
  AuditLog.create({
    action: "SHEET_MOVED_TO_RUNNING_YEAR",
    entity: "FinalSheet",
    entityId: doc._id,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    details: { type, from, to: year, department: doc.department, semester: doc.semester, batch: doc.batch },
  }).catch(() => {});
  res.json({ message: `Moved to ${year}.` });
};
