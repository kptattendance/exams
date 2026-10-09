// src/models/PaperSetting.js
//
// One document = one question-paper SET that one examiner must prepare.
// e.g. Subject 25CS31P, Nov-2026 exam, Set 1 -> Faculty A
//                                       Set 2 -> Faculty B
//
// The Word file itself is NEVER stored here. Only:
//   - where the encrypted blob lives in Google Drive (driveFileId)
//   - the wrapped (encrypted) per-file key needed to decrypt it
//   - a SHA-256 hash of the original file for tamper detection

import mongoose from "mongoose";

export const PAPER_STATUS = [
  "ASSIGNED",   // created by COE, email sent, nothing uploaded yet
  "UPLOADED",   // faculty uploaded a draft (can still replace it)
  "SUBMITTED",  // faculty final-submitted: locked, faculty loses access
  "RETURNED",   // COE sent it back for correction (faculty can re-upload)
  "CANCELLED",  // assignment withdrawn by COE
];

const fileSchema = new mongoose.Schema(
  {
    driveFileId: { type: String, required: true },

    // Envelope encryption (see services/paperCrypto.js)
    wrappedKey: { type: String, required: true }, // base64
    keyIv: { type: String, required: true },
    keyTag: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
    keyVersion: { type: Number, default: 1 },

    sha256: { type: String, required: true },   // hash of ORIGINAL docx
    size: { type: Number, required: true },
    originalName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String, required: true }, // clerkId
  },
  { _id: true }
);

const paperSettingSchema = new mongoose.Schema(
  {
    // ---------- WHAT ----------
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    examSession: {
      // e.g. "NOV-2026" / "MAY-2027"
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    setNo: { type: Number, required: true, min: 1, max: 9 },

    paperType: {
      type: String,
      enum: ["THEORY", "PRACTICAL"],
      default: "THEORY",
    },

    instructions: { type: String, trim: true, default: "" },
    deadline: { type: Date, required: true },

    // ---------- WHO ----------
    examiner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    examinerClerkId: { type: String, required: true, index: true },
    examinerType: {
      type: String,
      enum: ["INTERNAL", "EXTERNAL"],
      default: "INTERNAL",
    },

    assignedBy: { type: String, required: true }, // clerkId of COE

    // ---------- STATE ----------
    status: {
      type: String,
      enum: PAPER_STATUS,
      default: "ASSIGNED",
      index: true,
    },

    currentFile: { type: fileSchema, default: null },

    // Older uploads are kept (still encrypted) for traceability.
    fileHistory: { type: [fileSchema], default: [] },

    emailSentAt: { type: Date, default: null },
    emailCount: { type: Number, default: 0 },

    submittedAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
    returnRemarks: { type: String, default: "" },
  },
  { timestamps: true }
);

// Same subject + session + set can be assigned only once
paperSettingSchema.index(
  { subject: 1, examSession: 1, paperType: 1, setNo: 1 },
  { unique: true }
);

paperSettingSchema.index({ examSession: 1, status: 1 });

// Never leak key material through toJSON by accident
paperSettingSchema.set("toJSON", {
  transform(_doc, ret) {
    const strip = (f) =>
      f && {
        _id: f._id,
        originalName: f.originalName,
        size: f.size,
        sha256: f.sha256,
        uploadedAt: f.uploadedAt,
      };
    ret.currentFile = strip(ret.currentFile);
    ret.fileHistory = (ret.fileHistory || []).map(strip);
    return ret;
  },
});

export default mongoose.models.PaperSetting ||
  mongoose.model("PaperSetting", paperSettingSchema);
