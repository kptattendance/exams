// src/models/Exam.js
//
// One examination, e.g. "Nov/Dec 2026 Semester End Examination".
// Students are registered for it automatically (see ExamRegistration).

import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    // "cs-3" for a class, "backlog" for students who only write back papers
    key: { type: String, required: true },
    department: { type: String, default: "" },
    semester: { type: Number, default: null },
    state: { type: String, enum: ["PENDING", "DONE", "FAILED"], default: "PENDING" },
    students: { type: Number, default: 0 },
    error: { type: String, default: "" },
    doneAt: { type: Date, default: null },
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // e.g. "2026-27" – used to pick the right Final IA / attendance sheets
    academicYear: { type: String, required: true, trim: true, match: [/^\d{4}-\d{2}$/, "Academic year must look like 2026-27"] },

    // Current semesters written in this exam, e.g. [1, 3, 5]
    semesters: {
      type: [Number],
      validate: [(v) => v.length > 0 && v.every((s) => s >= 1 && s <= 6), "Choose at least one semester (1–6)."],
    },

    // Which back papers are offered:
    //   SAME_PARITY – odd-semester backs in an odd exam, even in an even exam
    //   ALL         – back papers of every semester
    //   NONE        – no back papers
    backPapers: { type: String, enum: ["SAME_PARITY", "ALL", "NONE"], default: "SAME_PARITY" },

    settings: {
      minAttendance: { type: Number, default: 75, min: 0, max: 100 },
    },

    status: { type: String, enum: ["DRAFT", "PUBLISHED", "COMPLETED"], default: "DRAFT" },

    // Automatic registration runs in small steps (Vercel time limit)
    generation: {
      groups: { type: [groupSchema], default: [] },
      lockedUntil: { type: Date, default: null },
      startedAt: { type: Date, default: null },
      finishedAt: { type: Date, default: null },
      startedBy: { type: String, default: "" },
    },

    // Written-exam timetable. One entry per subject code: every department
    // writing that code sits the same paper at the same time.
    timetable: {
      sessions: {
        FN: { start: { type: String, default: "10:00" }, end: { type: String, default: "13:00" } },
        AN: { start: { type: String, default: "14:00" }, end: { type: String, default: "17:00" } },
      },
      entries: {
        type: [
          new mongoose.Schema(
            {
              code: { type: String, required: true },
              date: { type: String, required: true }, // "2026-11-16"
              session: { type: String, enum: ["FN", "AN"], required: true },
            },
            { _id: false }
          ),
        ],
        default: [],
      },
      published: { type: Boolean, default: false },
      publishedAt: { type: Date, default: null },
      updatedBy: { type: String, default: "" },
    },

    createdBy: { type: String, required: true },
    createdByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

examSchema.index({ name: 1, academicYear: 1 }, { unique: true });

const Exam = mongoose.models.Exam || mongoose.model("Exam", examSchema);
export default Exam;
