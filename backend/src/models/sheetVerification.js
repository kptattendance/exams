// src/models/sheetVerification.js
//
// Verification of a frozen Final IA / Final attendance sheet (shared by both models).
//   The verifier compares the "before verification" copy with the records; the COE
//   types his corrections here (each one kept: old -> new), then gives the FINAL
//   freeze. A verified sheet can never be changed again, by anyone.
//   from / to: IA marks, or attendance in %.

import mongoose from "mongoose";

const correctionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    registerNumber: { type: String, default: "" },
    studentName: { type: String, default: "" },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    code: { type: String, default: "" },
    from: { type: Number, default: null }, // as frozen, before verification
    to: { type: Number, default: null },
    at: { type: Date, default: null },
    by: { type: String, default: "" },
  },
  { _id: false }
);

export const verificationField = {
  state: { type: String, enum: ["", "verified"], default: "" },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: String, default: "" },
  corrections: { type: [correctionSchema], default: [] },
};

// A sheet that was already verified when it was loaded cannot be saved again
export function lockVerified(schema) {
  schema.post("init", function () {
    this.$locals.wasVerified = this.verification?.state === "verified";
  });
  schema.pre("save", async function () {
    if (this.$locals.wasVerified) throw Object.assign(new Error("This sheet is verified and finally frozen. It cannot be changed."), { status: 423 });
  });
}
