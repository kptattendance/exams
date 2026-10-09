import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC SUBJECT INFORMATION
    // =====================================================

    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // Actual unique subject identifier
    // Example:
    // 25AT340PA
    // 25AT340PB
    subjectId: {
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

    // =====================================================
    // SYLLABUS SEQUENCE
    // Example:
    // 1AT01
    // 1AT02
    // 3AT01
    // 3AT02
    // =====================================================

    sequence: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: /^[1-8][A-Z]{2}\d{2}$/,
    },

    // =====================================================
    // ACADEMIC INFORMATION
    // =====================================================

    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },

    department: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // =====================================================
    // SUBJECT CATEGORY
    //
    // REGULAR  = Normal subject
    // ELECTIVE = Elective subject
    // BRIDGE   = Bridge course
    // =====================================================

    subjectCategory: {
      type: String,
      enum: ["REGULAR", "ELECTIVE", "BRIDGE"],
      default: "REGULAR",
      uppercase: true,
      trim: true,
    },

    // =====================================================
    // ELECTIVE GROUP
    //
    // Used only for elective subjects.
    // =====================================================

    electiveGroup: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },

    // =====================================================
    // WHO TAKES A BRIDGE COURSE
    //
    // Only used when subjectCategory = BRIDGE.
    // Lists the lateral admission types that must study it, e.g.
    //   ["lateral-puc"]                       PUC laterals only
    //   ["lateral-iti", "lateral-iti-cross"]  both ITI types
    // Empty = not decided yet (exam registration then gives it to every
    // lateral student and shows a warning to the COE).
    // A branch-changed student automatically gets the bridge courses of
    // his new department, because the department is read from the student.
    // =====================================================

    forAdmissionTypes: {
      type: [
        {
          type: String,
          enum: ["lateral-puc", "lateral-iti", "lateral-iti-cross"],
        },
      ],
      default: [],
    },

    // =====================================================
    // SUBJECT TYPE / BOARD
    // =====================================================

    subjectType: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    board: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    // =====================================================
    // INTERNAL ASSESSMENT
    // =====================================================

    iaMax: {
      type: Number,
      default: 0,
      min: 0,
    },

    iaMin: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // THEORY EXAM
    // =====================================================

    theoryExamMax: {
      type: Number,
      default: 0,
      min: 0,
    },

    theoryExamMin: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // PRACTICAL EXAM
    // =====================================================

    practicalExamMax: {
      type: Number,
      default: 0,
      min: 0,
    },

    practicalExamMin: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =====================================================
    // TOTAL MARKS
    // =====================================================

    totalMax: {
      type: Number,
      required: true,
      min: 0,
    },

    totalMin: {
      type: Number,
      required: true,
      min: 0,
    },

    // =====================================================
    // CREDITS / SCHEME
    // =====================================================

    credit: {
      type: Number,
      required: true,
      min: 0,
    },

    schemeYear: {
      type: Number,
      default: 2025,
      min: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// =========================================================
// UNIQUE SUBJECT OFFERING
//
// Same code + subjectId can be used for another semester
// or another subject category.
//
// Example:
//
// 25AT340PA + AT + Sem 1 + REGULAR   ✅
// 25AT340PA + AT + Sem 3 + BRIDGE    ✅
// 25AT340PA + AT + Sem 4 + BRIDGE    ✅
//
// But:
//
// 25AT340PA + AT + Sem 3 + BRIDGE    ❌
// 25AT340PA + AT + Sem 3 + BRIDGE    ❌
//
// The exact same combination cannot be duplicated.
// =========================================================

subjectSchema.index(
  {
    code: 1,
    department: 1,
    subjectId: 1,
    semester: 1,
    subjectCategory: 1,
  },
  {
    unique: true,
  }
);

// =========================================================
// SEQUENCE
//
// Sequence identifies the syllabus position.
//
// Example:
// 1AT01
// 1AT02
// 3AT01
// 3AT02
//
// Sequence remains unique.
// =========================================================

subjectSchema.index(
  {
    sequence: 1,
  },
  {
    unique: true,
  }
);

// =========================================================
// ELECTIVE GROUP
// =========================================================

subjectSchema.index({
  department: 1,
  semester: 1,
  electiveGroup: 1,
});

// =========================================================
// SUBJECT LOOKUP
// =========================================================

subjectSchema.index({
  department: 1,
  semester: 1,
});

export default mongoose.model("Subject", subjectSchema);