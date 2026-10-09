// src/models/Setting.js
//
// College-wide settings, one document per key, e.g.
//   { _id: "academicYear", value: "2026-27" }
// Only the Admin can change them.

import mongoose from "mongoose";

const settingSchema = new mongoose.Schema(
  {
    _id: { type: String },
    value: { type: mongoose.Schema.Types.Mixed },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

const Setting = mongoose.models.Setting || mongoose.model("Setting", settingSchema);
export default Setting;
