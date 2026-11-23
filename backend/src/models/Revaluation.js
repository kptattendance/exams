import mongoose from "mongoose";

// One application after the results of an exam are published (KPT 9.8):
//   COPY        – a copy of the answer script
//   VIEW        – in-person viewing of the answer script
//   REVALUATION – revaluation by a different examiner (9.8.2)
// Marks are the paper's raw marks (out of rawMax, like valuation); the
// subject's theory marks (out of seeMax) follow from them.

const evaluationSchema = new mongoose.Schema(
  {
    marks: { type: Number, required: true },
    valuer: { type: String, required: true },
    at: { type: Date, default: Date.now },
    by: { type: String, default: "" },
  },
  { _id: false }
);

const revaluationSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: "ExamRegistration", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    registerNumber: { type: String, default: "" },
    name: { type: String, default: "" },
    department: { type: String, default: "" },

    code: { type: String, required: true }, // subject code
    subjectName: { type: String, default: "" },
    subjectSemester: { type: Number, default: null },

    type: { type: String, enum: ["COPY", "VIEW", "REVALUATION"], required: true },
    fee: {
      amount: { type: Number, default: null },
      receiptNo: { type: String, default: "" },
      paidOn: { type: Date, default: null },
    },

    // APPLIED -> ISSUED (copy / viewing given) | NEEDS_THIRD -> DONE (revaluation)
    status: { type: String, enum: ["APPLIED", "ISSUED", "NEEDS_THIRD", "DONE"], default: "APPLIED", index: true },

    rawMax: { type: Number, default: 50 },
    seeMax: { type: Number, default: 0 },
    original: { type: Number, default: null }, // raw marks before revaluation
    reval: { type: evaluationSchema, default: null },
    third: { type: evaluationSchema, default: null },
    final: { type: Number, default: null }, // raw marks after revaluation
    rule: { type: String, default: "" }, // higher | best-two
    changed: { type: Boolean, default: false },
    resultBefore: { type: String, default: "" },
    resultAfter: { type: String, default: "" },

    issuedAt: { type: Date, default: null },
    issuedBy: { type: String, default: "" },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

// one application of each kind per student and subject
revaluationSchema.index({ exam: 1, registration: 1, code: 1, type: 1 }, { unique: true });

export default mongoose.models.Revaluation || mongoose.model("Revaluation", revaluationSchema);
