// src/models/ValuationPaper.js
//
// One written paper (subject code) of one exam, and how far its
// valuation has gone:  candidates → attendance → coding → valuation → decoded

import mongoose from "mongoose";

const valuationPaperSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    code: { type: String, required: true },
    name: { type: String, default: "" },

    // Paper is set and valued out of rawMax (100) and reduced to the
    // subject's theory maximum (e.g. 50) when decoded
    rawMax: { type: Number, default: 100, min: 1 },
    seeMax: { type: Number, default: 0 },
    seeMin: { type: Number, default: 0 },

    attendanceLocked: { type: Boolean, default: false },
    coded: { type: Boolean, default: false },
    codedAt: { type: Date, default: null },
    packetSize: { type: Number, default: 30 },

    decoded: { type: Boolean, default: false },
    decodedAt: { type: Date, default: null },
    decodedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

valuationPaperSchema.index({ exam: 1, code: 1 }, { unique: true });

export default mongoose.models.ValuationPaper || mongoose.model("ValuationPaper", valuationPaperSchema);
