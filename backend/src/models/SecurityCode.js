// src/models/SecurityCode.js
//
// A one-time code emailed to an admin before a dangerous action (e.g. deleting
// students with all their records). Only a hash of the code is kept; it expires
// after 10 minutes and locks after 5 wrong tries. Expired documents are removed
// by MongoDB automatically.

import mongoose from "mongoose";

const securityCodeSchema = new mongoose.Schema(
  {
    purpose: { type: String, required: true }, // "STUDENT_PURGE"
    payload: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { ids: [...] }
    salt: { type: String, required: true },
    hash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    requestedBy: { type: String, required: true }, // clerk id
    sentTo: { type: String, default: "" },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

securityCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SecurityCode || mongoose.model("SecurityCode", securityCodeSchema);
