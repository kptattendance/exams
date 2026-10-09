// src/models/ValuationPacket.js
//
// A bundle of answer scripts (about 30) given to one valuer for one round.
// The exam clerk types the valuer's award list into it, twice when double
// entry is on, and the two entries must match.

import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    by: { type: String, default: "" },
    at: { type: Date, default: null },
    marks: { type: Map, of: Number, default: {} }, // dummy -> marks out of rawMax
  },
  { _id: false }
);

const valuationPacketSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    code: { type: String, required: true },
    round: { type: Number, enum: [1, 2, 3], default: 1 },
    number: { type: String, required: true }, // "25CS31T0-P03" or "25CS31T0-P03-V2"
    scripts: [{ type: mongoose.Schema.Types.ObjectId, ref: "AnswerScript" }],
    dummies: { type: [String], default: [] },
    rawMax: { type: Number, default: 100 },
    valuer: { type: String, default: "" },

    status: { type: String, enum: ["PENDING", "FIRST_DONE", "MISMATCH", "VERIFIED"], default: "PENDING", index: true },
    first: { type: entrySchema, default: () => ({}) },
    second: { type: entrySchema, default: () => ({}) },
    mismatches: { type: [String], default: [] }, // dummies
    final: { type: Map, of: Number, default: {} },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

valuationPacketSchema.index({ exam: 1, number: 1 }, { unique: true });
valuationPacketSchema.index({ exam: 1, code: 1, round: 1 });

export default mongoose.models.ValuationPacket || mongoose.model("ValuationPacket", valuationPacketSchema);
