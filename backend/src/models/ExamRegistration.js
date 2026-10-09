// src/models/ExamRegistration.js
//
// One student in one exam, with every subject he is registered for and
// whether he may write it.
//
//   status     – worked out by the software from IA + attendance
//   override   – set by the COE (e.g. after condonation), wins over status
//   effective  – override.status if set, else status (kept in sync, used for filters)

import mongoose from "mongoose";

export const ELIGIBILITY = ["ELIGIBLE", "ANS", "NE", "PENDING"];
export const SUBJECT_KINDS = ["REGULAR", "ELECTIVE", "BRIDGE", "BACKLOG"];

const feeSchema = new mongoose.Schema(
  {
    paid: { type: Boolean, default: false },
    receiptNo: { type: String, default: "" },
    paidOn: { type: Date, default: null },
    by: { type: String, default: "" },
    at: { type: Date, default: null },
  },
  { _id: false }
);

const regSubjectSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    code: { type: String, required: true },
    name: { type: String, default: "" },
    semester: { type: Number, default: null },
    kind: { type: String, enum: SUBJECT_KINDS, default: "REGULAR" },
    credit: { type: Number, default: 0 },
    hasTheory: { type: Boolean, default: true },
    hasPractical: { type: Boolean, default: false },

    // AUTO = added by registration; MANUAL = added by the COE (kept on refresh)
    source: { type: String, enum: ["AUTO", "MANUAL"], default: "AUTO" },

    status: { type: String, enum: ELIGIBILITY, default: "PENDING" },
    reasons: { type: [String], default: [] },
    iaMarks: { type: Number, default: null },
    iaMax: { type: Number, default: null },
    attendancePct: { type: Number, default: null },

    override: {
      status: { type: String, enum: ELIGIBILITY, default: null },
      reason: { type: String, default: "" },
      by: { type: String, default: "" },
      at: { type: Date, default: null },
    },
    effective: { type: String, enum: ELIGIBILITY, default: "PENDING" },

    // Back papers are paid for one by one (used by fee verification)
    fee: { type: feeSchema, default: () => ({}) },
  },
  { _id: false }
);

const examRegistrationSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },

    // Copied from the student so lists and hall tickets need no join
    registerNumber: { type: String, default: "" },
    rollNumber: { type: String, default: "" },
    name: { type: String, default: "" },
    department: { type: String, default: "" },
    semester: { type: Number, default: null },
    batch: { type: String, default: "" },
    admissionType: { type: String, default: "regular" },
    imageUrl: { type: String, default: "" },

    // Which generation group created it ("cs-3", "backlog", "manual")
    group: { type: String, default: "" },

    subjects: { type: [regSubjectSchema], default: [] },

    // Fee for the current-semester subjects (one payment)
    regularFee: { type: feeSchema, default: () => ({}) },

    warnings: { type: [String], default: [] },

    counts: {
      total: { type: Number, default: 0 },
      eligible: { type: Number, default: 0 },
      ans: { type: Number, default: 0 },
      ne: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
    },

    // ALL_CLEAR – every subject eligible
    // PARTIAL   – some subjects not permitted
    // BLOCKED   – no subject permitted
    // PENDING   – waiting for IA/attendance
    overall: { type: String, enum: ["ALL_CLEAR", "PARTIAL", "BLOCKED", "PENDING"], default: "PENDING", index: true },

    // Fee verification by the office
    //   PAID    – regular fee and every back paper paid
    //   PARTIAL – something still unpaid
    //   UNPAID  – nothing paid yet
    //   NONE    – nothing to pay
    feeStatus: { type: String, enum: ["PAID", "PARTIAL", "UNPAID", "NONE"], default: "UNPAID", index: true },
  },
  { timestamps: true }
);

examRegistrationSchema.index({ exam: 1, student: 1 }, { unique: true });
examRegistrationSchema.index({ exam: 1, department: 1, semester: 1 });
examRegistrationSchema.index({ exam: 1, registerNumber: 1 });

const ExamRegistration =
  mongoose.models.ExamRegistration || mongoose.model("ExamRegistration", examRegistrationSchema);
export default ExamRegistration;
