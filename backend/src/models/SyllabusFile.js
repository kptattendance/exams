// src/models/SyllabusFile.js
//
// A PDF (syllabus, scheme of question paper setting) that goes with every
// paper-setting email of a subject. The COE uploads it once; the file itself
// is kept in Google Drive. A subject code may have more than one file.

import mongoose from "mongoose";

const syllabusFileSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true }, // subject code
    name: { type: String, required: true, trim: true }, // file name, e.g. "25CS31T0.pdf"
    driveFileId: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

syllabusFileSchema.index({ code: 1, name: 1 }, { unique: true });

export default mongoose.models.SyllabusFile || mongoose.model("SyllabusFile", syllabusFileSchema);
