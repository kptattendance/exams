import mongoose from "mongoose";

// Supplementary semester – CIE make-up (KPT 5.5, 9.1.3).
// After the even-semester results, students with an NE grade (CIE below the
// minimum) register, pay the exam fee, attend the make-up and get new CIE
// marks. When the new CIE reaches the minimum, the course comes back in the
// next examination as an eligible back paper carrying the new CIE.

const roundSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Supplementary semester June 2027"
    academicYear: { type: String, default: "" },
    lastDate: { type: Date, default: null }, // last date to register (KPT 5.5.1 b)
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

const entrySchema = new mongoose.Schema(
  {
    round: { type: mongoose.Schema.Types.ObjectId, ref: "CieMakeupRound", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    registerNumber: { type: String, default: "" },
    name: { type: String, default: "" },
    department: { type: String, default: "" },
    code: { type: String, default: "" },
    subjectName: { type: String, default: "" },
    subjectSemester: { type: Number, default: null },

    originalCie: { type: Number, default: null }, // CIE that gave the NE
    cieMax: { type: Number, default: 0 },
    cieMin: { type: Number, default: 0 },

    fee: {
      amount: { type: Number, default: null },
      receiptNo: { type: String, default: "" },
      paidOn: { type: Date, default: null },
    },

    marks: { type: Number, default: null }, // make-up CIE (out of cieMax)
    passed: { type: Boolean, default: false }, // marks >= cieMin
    enteredBy: { type: String, default: "" },
    enteredAt: { type: Date, default: null },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

entrySchema.index({ round: 1, student: 1, subject: 1 }, { unique: true });

export const CieMakeupRound = mongoose.models.CieMakeupRound || mongoose.model("CieMakeupRound", roundSchema);
export const CieMakeup = mongoose.models.CieMakeup || mongoose.model("CieMakeup", entrySchema);
