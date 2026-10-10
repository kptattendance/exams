// src/models/PracticalBatch.js
//
// One batch of a practical exam: one subject, one lab session. Students of
// any branch can sit in the same batch (common subjects, back papers).
//
//   COE       – allots the examiner sets of each department (PracticalPanel)
//   HOD       – the HOD of the subject's board forms the batches (any size),
//               fixes date / session / lab with the examiners, picks the set
//   Examiners – the internal examiner signs in, the external examiner types his
//               code, they enter one agreed mark per student and submit.
//               Submitting is final; only the Admin can correct a mark afterwards.

import mongoose from "mongoose";

const batchStudentSchema = new mongoose.Schema(
  {
    registration: { type: mongoose.Schema.Types.ObjectId, ref: "ExamRegistration", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
    registerNumber: { type: String, required: true },
    name: { type: String, default: "" },
    department: { type: String, default: "" }, // the student's branch
    kind: { type: String, default: "REGULAR" },
    attendance: { type: String, enum: ["PRESENT", "ABSENT", "MALPRACTICE", null], default: null },
    marks: { type: Number, default: null },
  },
  { _id: false }
);

const practicalBatchSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    code: { type: String, required: true },
    name: { type: String, default: "" },
    board: { type: String, default: "" },
    department: { type: String, required: true, lowercase: true }, // the conducting department (from the board)
    semester: { type: Number, default: null },
    number: { type: Number, required: true }, // 1, 2, 3 … within the subject
    label: { type: String, required: true }, // "25CS31P-B1"

    date: { type: String, default: "" }, // "2026-11-20"
    session: { type: String, enum: ["FN", "AN", ""], default: "" },
    lab: { type: String, default: "" },

    max: { type: Number, default: 0 }, // subject's practical maximum
    min: { type: Number, default: 0 },

    // The examiner set that conducts this batch
    panel: { type: mongoose.Schema.Types.ObjectId, ref: "PracticalPanel", default: null },
    // Set when the external examiner types his code; the marks sheet stays open until then
    unlockedUntil: { type: Date, default: null },

    students: { type: [batchStudentSchema], default: [] },

    status: { type: String, enum: ["OPEN", "SUBMITTED"], default: "OPEN", index: true },
    // Who submitted – kept here so a later change of examiners never rewrites it
    submitted: {
      at: { type: Date, default: null },
      by: { type: String, default: "" }, // internal examiner (email)
      internal: { type: String, default: "" },
      external: { type: String, default: "" },
      college: { type: String, default: "" },
    },

    // Admin corrections after submission
    corrections: {
      type: [
        new mongoose.Schema(
          {
            registerNumber: String,
            from: { attendance: String, marks: Number },
            to: { attendance: String, marks: Number },
            reason: String,
            by: String,
            at: Date,
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

practicalBatchSchema.index({ exam: 1, code: 1, number: 1 }, { unique: true });
practicalBatchSchema.index({ panel: 1, status: 1 });

const PracticalBatch = mongoose.models.PracticalBatch || mongoose.model("PracticalBatch", practicalBatchSchema);
export default PracticalBatch;
