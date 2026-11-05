// src/models/RecycleBin.js
//
// Deleted students, subjects and IA / attendance sheets are kept here for 30
// days (services/recycleBin.js). The Admin can restore them, or delete them
// for good; after 30 days they are deleted for good by themselves.
//
//   data : the deleted records exactly as they were, per collection
//          { students: [...], examregistrations: [...], ... } and, for a
//          student, the rows he had in sheets / practical batches
//   extra: what is removed only when the entry is deleted for good
//          (the student's login and photo)

import mongoose from "mongoose";

export const BIN_DAYS = 30;
export const BIN_KINDS = ["STUDENT", "SUBJECT", "IA_SHEET", "ATTENDANCE_SHEET"];

const recycleBinSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: BIN_KINDS, required: true, index: true },
    label: { type: String, default: "" }, // "103CS25001 – ANANYA K" / "25CS31T0 – …" / "CS sem 3 2025-2028"
    department: { type: String, default: "" },
    semester: { type: Number, default: null },
    reason: { type: String, default: "" },
    deletedBy: { type: String, default: "" },
    deletedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    extra: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { minimize: false }
);

const RecycleBin = mongoose.models.RecycleBin || mongoose.model("RecycleBin", recycleBinSchema);
export default RecycleBin;
