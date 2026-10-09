// src/models/StudentElective.js
//
// Which elective a student studies in one elective group of a semester.
// Set by the HOD. Exam registration reads it, so a student is registered
// only for the elective he chose.

import mongoose from "mongoose";

const studentElectiveSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    department: { type: String, required: true, lowercase: true, trim: true },
    semester: { type: Number, required: true, min: 1, max: 6 },
    electiveGroup: { type: String, required: true, uppercase: true, trim: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    setBy: { type: String, default: "" },
    setByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

studentElectiveSchema.index({ student: 1, semester: 1, electiveGroup: 1 }, { unique: true });
studentElectiveSchema.index({ department: 1, semester: 1 });

const StudentElective =
  mongoose.models.StudentElective || mongoose.model("StudentElective", studentElectiveSchema);
export default StudentElective;
