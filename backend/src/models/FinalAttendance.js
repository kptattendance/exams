import mongoose from "mongoose";

// =====================================================
// SUBJECT ATTENDANCE
// =====================================================

const attendanceSubjectSchema =
  new mongoose.Schema(
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

      // HOD enters this
      // Example: 40, 45, 50
      maxClasses: {
        type: Number,
        default: null,
        min: 0,
      },
    },
    {
      _id: false,
    }
  );

// =====================================================
// STUDENT ATTENDANCE
// =====================================================

const attendanceStudentSchema =
  new mongoose.Schema(
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

      attendance: [
        {
          subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subject",
            required: true,
          },

          // Classes actually attended
          classesAttended: {
            type: Number,
            default: null,
            min: 0,
          },
        },
      ],
    },
    {
      _id: false,
    }
  );

// =====================================================
// FINAL ATTENDANCE
// =====================================================

const finalAttendanceSchema =
  new mongoose.Schema(
    {
      // Example: 2025-26
      academicYear: {
        type: String,
        required: true,
        trim: true,
      },

      // HOD department
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

      // Example: 2024-2027
      batch: {
        type: String,
        required: true,
        trim: true,
      },

      // Subjects for this semester/department
      subjects: {
        type: [attendanceSubjectSchema],
        default: [],
      },

      // Students and attendance
      students: {
        type: [attendanceStudentSchema],
        default: [],
      },

      // Workflow
      status: {
        type: String,
        enum: [
          "draft",
          "submitted",
          "confirmed",
        ],
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
// ONE ATTENDANCE RECORD PER:
// Academic Year + Department + Semester + Batch
// =====================================================

finalAttendanceSchema.index(
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

const FinalAttendance =
  mongoose.models.FinalAttendance ||
  mongoose.model(
    "FinalAttendance",
    finalAttendanceSchema
  );

export default FinalAttendance;