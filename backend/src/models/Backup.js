// src/models/Backup.js
//
// One full database backup: where the encrypted file is (Google Drive) and
// what is in it. The file itself is never stored in the database.

import mongoose from "mongoose";

const backupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // kpt-backup-2026-10-29-2015.kptbak
    driveFileId: { type: String, default: "" },
    driveLink: { type: String, default: "" },
    size: { type: Number, default: 0 }, // bytes (encrypted file)
    records: { type: Number, default: 0 },
    counts: { type: mongoose.Schema.Types.Mixed, default: {} }, // collection -> records
    status: { type: String, enum: ["OK", "FAILED"], default: "OK" },
    error: { type: String, default: "" },
    reason: { type: String, default: "" },
    by: { type: String, default: "" },
    seconds: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

backupSchema.index({ createdAt: -1 });

export default mongoose.models.Backup || mongoose.model("Backup", backupSchema);
