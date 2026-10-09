import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    // =====================================================
    // AUTHENTICATION
    // =====================================================

    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // =====================================================
    // BASIC STUDENT DETAILS
    // =====================================================

    registerNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },

    // Roll Number
    rollNumber: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    fatherName: {
      type: String,
      required: true,
      trim: true,
    },

    motherName: {
      type: String,
      required: true,
      trim: true,
    },

    dob: {
      type: Date,
      required: true,
    },

    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "other"],
      lowercase: true,
      trim: true,
    },

    // =====================================================
    // CONTACT DETAILS
    // =====================================================

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    // Optional parent/guardian contact
    parentPhone: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // SOCIAL / RESERVATION DETAILS
    // =====================================================

    caste: {
      type: String,
      trim: true,
      default: "",
    },

    category: {
      type: String,
      trim: true,
      default: "",
    },

    // =====================================================
    // GOVERNMENT / STUDENT IDENTIFICATION
    // =====================================================

    aadhaarNumber: {
      type: String,
      trim: true,
      default: "",
    },

    satsNumber: {
      type: String,
      trim: true,
      default: "",
    },

    // Encrypted Aadhaar (new imports). aadhaarNumber above then holds only
    // the masked value, e.g. XXXXXXXX1234. See services/studentCrypto.js
    aadhaarEncrypted: {
      type: String,
      default: "",
      select: false,
    },

    aadhaarHash: {
      type: String,
      default: "",
      index: true,
    },

    // regular | lateral-puc | lateral-iti | lateral-iti-cross
    // Decides the register-number series and the bridge courses.
    admissionType: {
      type: String,
      enum: ["regular", "lateral-puc", "lateral-iti", "lateral-iti-cross"],
      default: "regular",
    },

    // Which Excel import created this student (if any)
    importBatch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentImport",
      default: null,
    },

    // =====================================================
    // ACADEMIC DETAILS
    // =====================================================

    department: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    admissionYear: {
      type: Number,
      required: true,
    },

    batch: {
      type: String,
      required: true,
      trim: true,
    },

    // Example: 1 or 2
    batchNumber: {
      type: Number,
      required: true,
      enum: [1, 2],
    },

    // Current semester
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },

    // =====================================================
    // STUDENT STATUS
    // =====================================================

    status: {
      type: String,
      enum: [
        "active",
        "inactive",
        "passed",
        "detained",
        "discontinued",
        "transferred",
      ],
      default: "active",
      index: true,
    },

    // =====================================================
    // ROLE
    // =====================================================

    role: {
      type: String,
      default: "student",
      enum: ["student"],
    },

    // =====================================================
    // PHOTO
    // =====================================================

    imageUrl: {
      type: String,
      default: "",
    },

    imagePublicId: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const Student =
  mongoose.models.Student ||
  mongoose.model("Student", studentSchema);

export default Student;