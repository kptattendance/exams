// src/models/CourseResult.js
//
// The outcome of one attempt at one subject. The results module will write
// these after every exam. Exam registration reads the latest attempt per
// subject: anything other than PASS becomes a back paper.
//
//   FAIL / ABSENT – IA is carried forward, the student writes the exam again
//   NE / ANS      – the student must re-register for the course

import mongoose from "mongoose";

export const RESULT_STATUS = ["PASS", "FAIL", "ABSENT", "NE", "ANS", "WITHHELD"];

const courseResultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    code: { type: String, default: "" },
    semester: { type: Number, default: null },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", default: null },

    status: { type: String, enum: RESULT_STATUS, required: true },
    cie: { type: Number, default: null },
    see: { type: Number, default: null },
    total: { type: Number, default: null },
    grade: { type: String, default: "" },

    // When the result was declared; the latest one per subject counts
    declaredAt: { type: Date, default: Date.now },
    source: { type: String, enum: ["RESULT", "MANUAL", "IMPORT"], default: "RESULT" },
  },
  { timestamps: true }
);

courseResultSchema.index({ student: 1, subject: 1, declaredAt: -1 });
courseResultSchema.index({ status: 1 });

const CourseResult = mongoose.models.CourseResult || mongoose.model("CourseResult", courseResultSchema);
export default CourseResult;
