// src/models/StudentImport.js
//
// One document per Excel import. Register numbers are reserved for every
// row when the import starts, then rows are processed in small batches
// (create login + student record, copy photo) so no request runs too long.

import mongoose from "mongoose";

const rowSchema = new mongoose.Schema(
  {
    rowNumber: Number,
    registerNumber: { type: String, required: true },
    rollNumber: String,
    name: String,
    department: String,
    admissionType: String,

    // Cleaned student data, ready to save (Aadhaar already encrypted)
    data: { type: mongoose.Schema.Types.Mixed, required: true },

    state: { type: String, enum: ["PENDING", "CREATED", "FAILED"], default: "PENDING" },
    error: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", default: null },

    photoUrl: { type: String, default: "" },
    photoState: { type: String, enum: ["NONE", "PENDING", "DONE", "FAILED"], default: "NONE" },
    photoError: { type: String, default: "" },
  },
  { _id: false }
);

const studentImportSchema = new mongoose.Schema(
  {
    fileName: { type: String, default: "" },
    createdBy: { type: String, required: true }, // clerkId
    createdByEmail: { type: String, default: "" },
    status: { type: String, enum: ["PROCESSING", "DONE"], default: "PROCESSING", index: true },
    departments: [String],
    lockedUntil: { type: Date, default: () => new Date(0) },
    rows: [rowSchema],
  },
  { timestamps: true }
);

studentImportSchema.methods.summary = function () {
  const c = { total: this.rows.length, created: 0, failed: 0, pending: 0, photosDone: 0, photosFailed: 0, photosPending: 0, noPhoto: 0 };
  for (const r of this.rows) {
    if (r.state === "CREATED") c.created++;
    else if (r.state === "FAILED") c.failed++;
    else c.pending++;
    if (r.photoState === "DONE") c.photosDone++;
    else if (r.photoState === "FAILED") c.photosFailed++;
    else if (r.photoState === "PENDING") c.photosPending++;
    else c.noPhoto++;
  }
  return c;
};

export default mongoose.models.StudentImport || mongoose.model("StudentImport", studentImportSchema);
