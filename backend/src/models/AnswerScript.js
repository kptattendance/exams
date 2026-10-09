// src/models/AnswerScript.js
//
// One student's answer script for one written paper.
// Valuers and the exam clerk only ever see the dummy number; the link to the
// register number is used again only when the COE decodes the paper.

import mongoose from "mongoose";

const valuationSchema = new mongoose.Schema(
  {
    round: { type: Number, required: true }, // 1, 2 or 3
    marks: { type: Number, required: true },
    packet: { type: mongoose.Schema.Types.ObjectId, ref: "ValuationPacket" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const answerScriptSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    code: { type: String, required: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: "ExamRegistration", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    registerNumber: { type: String, default: "" },
    name: { type: String, default: "" },
    department: { type: String, default: "" },
    semester: { type: Number, default: null },
    kind: { type: String, default: "REGULAR" },

    attendance: { type: String, enum: ["PRESENT", "ABSENT", "MALPRACTICE"], default: "PRESENT" },

    dummy: { type: String, default: null }, // e.g. "KQ4821"
    valuations: { type: [valuationSchema], default: [] },
  },
  { timestamps: true }
);

answerScriptSchema.index({ exam: 1, code: 1, registration: 1 }, { unique: true });
answerScriptSchema.index({ exam: 1, dummy: 1 }, { unique: true, partialFilterExpression: { dummy: { $type: "string" } } });

export default mongoose.models.AnswerScript || mongoose.model("AnswerScript", answerScriptSchema);
