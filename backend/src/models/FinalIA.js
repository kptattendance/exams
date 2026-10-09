import mongoose from "mongoose";

// =====================================================
// FINAL IA - SUBJECT
// =====================================================

const finalIASubjectSchema = new mongoose.Schema(
  {
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // HOD enters maximum IA marks
    maxMarks: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

// =====================================================
// FINAL IA - STUDENT
// =====================================================

const finalIAStudentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },

    registerNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    studentName: {
      type: String,
      required: true,
      trim: true,
    },

    // Marks entered for each subject
    marks: [
      {
        subjectId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Subject",
          required: true,
        },

        marks: {
          type: Number,
          min: 0,
          default: null,
        },
      },
    ],
  },
  { _id: false }
);

// =====================================================
// FINAL IA
// =====================================================

const finalIASchema = new mongoose.Schema(
  {
    academicYear: {
      type: String,
      required: true,
      trim: true,
    },

    department: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },

    batch: {
      type: String,
      required: true,
      trim: true,
    },

    // All subjects for the selected semester
    subjects: {
      type: [finalIASubjectSchema],
      default: [],
    },

    // Students belonging to HOD department
    students: {
      type: [finalIAStudentSchema],
      default: [],
    },

    // =================================================
    // WORKFLOW
    // =================================================

    status: {
      type: String,
      enum: ["draft", "submitted", "confirmed"],
      default: "draft",
    },

    submittedBy: {
      type: String,
      default: null,
    },

    submittedAt: {
      type: Date,
      default: null,
    },

    confirmedBy: {
      type: String,
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    // Set when the Exam Officer sends the sheet back to the HOD
    returnedReason: { type: String, default: "" },
    returnedAt: { type: Date, default: null },
    returnedBy: { type: String, default: "" },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// ONLY ONE RECORD FOR:
// Academic Year + Department + Semester + Batch
// =====================================================

finalIASchema.index(
  {
    academicYear: 1,
    department: 1,
    semester: 1,
    batch: 1,
  },
  {
    unique: true,
  }
);

const FinalIA = mongoose.model("FinalIA", finalIASchema);

export default FinalIA;