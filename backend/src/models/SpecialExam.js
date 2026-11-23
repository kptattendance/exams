import mongoose from "mongoose";

// KPT 6.2.5 – special examination for a student on official NCC / NSS /
// Red Cross / sports / cultural duty during the regular examination: he
// writes the paper(s) on another date (not a re-examination, no adverse
// record), and attendance below 60 % because of the duty does not stop him.

const paperSchema = new mongoose.Schema(
  {
    code: { type: String, required: true },
    name: { type: String, default: "" },
    semester: { type: Number, default: null },
    condoned: { type: Boolean, default: false }, // ANS lifted because of the duty
    raw: { type: Number, default: null }, // marks of the special exam (out of rawMax)
    rawMax: { type: Number, default: 50 },
    marks: { type: Number, default: null }, // out of the subject's theory maximum
    enteredBy: { type: String, default: "" },
    enteredAt: { type: Date, default: null },
  },
  { _id: false }
);

const specialExamSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: "ExamRegistration", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    registerNumber: { type: String, default: "" },
    name: { type: String, default: "" },
    department: { type: String, default: "" },
    activity: { type: String, enum: ["NCC", "NSS", "RED_CROSS", "SPORTS", "CULTURAL"], required: true },
    orderRef: { type: String, default: "" }, // official participation order
    event: { type: String, default: "" }, // camp / competition and dates
    papers: { type: [paperSchema], default: [] },
    note: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

specialExamSchema.index({ exam: 1, registration: 1 }, { unique: true });

export default mongoose.models.SpecialExam || mongoose.model("SpecialExam", specialExamSchema);
