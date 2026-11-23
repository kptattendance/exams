// src/models/ExamComputer.js
//
// The computers of the exam section that may print question papers. A computer
// is known by a security key made once in its browser: the secret half never
// leaves that browser, only the public half is stored here.
//   ACTIVE     registered by the COE / Admin
//   REQUESTED  asked for emergency access; works only while unlockedUntil is ahead
//   REMOVED    taken off the list

import mongoose from "mongoose";

const examComputerSchema = new mongoose.Schema(
  {
    keyId: { type: String, required: true, unique: true },
    publicKey: {
      type: new mongoose.Schema({ kty: String, crv: String, x: String, y: String }, { _id: false }),
      required: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    // private: only the Admin who registered it sees it; it is in nobody else's list or count
    hidden: { type: Boolean, default: false },
    status: { type: String, enum: ["ACTIVE", "REQUESTED", "REMOVED"], default: "REQUESTED" },
    registeredBy: { type: String, default: "" },
    registeredAt: { type: Date, default: null },
    requestedBy: { type: String, default: "" },
    requestedAt: { type: Date, default: null },
    // emergency access for a short time
    unlockedUntil: { type: Date, default: null },
    unlockReason: { type: String, default: "" },
    unlockedBy: { type: String, default: "" },
    lastUsedAt: { type: Date, default: null },
    lastUsedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

const ExamComputer = mongoose.models.ExamComputer || mongoose.model("ExamComputer", examComputerSchema);

// One-time question the computer answers with its key before a print
const challengeSchema = new mongoose.Schema({
  user: { type: String, required: true },
  paper: { type: String, required: true },
  nonce: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const ExamComputerChallenge = mongoose.models.ExamComputerChallenge || mongoose.model("ExamComputerChallenge", challengeSchema);

export default ExamComputer;
