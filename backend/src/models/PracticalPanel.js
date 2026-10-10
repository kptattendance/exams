// src/models/PracticalPanel.js
//
// One set of practical examiners of a department for one exam:
// an internal examiner (a login) and an external examiner (no login – he
// gets a secret code). The COE allots one or two sets per department; a set
// handles every practical exam the department's HOD gives it.

import mongoose from "mongoose";

const practicalPanelSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    department: { type: String, required: true, lowercase: true }, // the conducting department
    number: { type: Number, required: true }, // Set 1, Set 2 …

    internal: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      clerkId: { type: String, default: "" },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
    },
    external: {
      name: { type: String, default: "" },
      college: { type: String, default: "" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },

    // The external examiner's secret code (only its hash is kept).
    // One code works for every batch of this set.
    access: {
      salt: { type: String, default: "" },
      hash: { type: String, default: "" },
      fails: { type: Number, default: 0 },
      issuedAt: { type: Date, default: null },
      issuedBy: { type: String, default: "" },
      sentTo: { type: String, default: "" },
    },

    allottedAt: { type: Date, default: null },
    allottedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

practicalPanelSchema.index({ exam: 1, department: 1, number: 1 }, { unique: true });
practicalPanelSchema.index({ "internal.clerkId": 1 });

const PracticalPanel = mongoose.models.PracticalPanel || mongoose.model("PracticalPanel", practicalPanelSchema);
export default PracticalPanel;
