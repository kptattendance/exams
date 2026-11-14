import mongoose from "mongoose";

// A student recommended for / awarded the Diploma (KPT 11, 12, 14.8).
// Recorded by the COE with the Academic Council's approval; the student
// becomes "passed". The final Diploma Certificate comes from the DTE / BTE.

const diplomaAwardSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, unique: true },
    registerNumber: { type: String, default: "" },
    name: { type: String, default: "" },
    fatherName: { type: String, default: "" },
    department: { type: String, default: "" },
    admissionType: { type: String, default: "" },
    batch: { type: String, default: "" },
    startYear: { type: Number, default: null },

    credits: { type: Number, default: 0 },
    cgpa: { type: Number, default: null },
    percentage: { type: Number, default: null },
    class: { type: String, default: "" }, // FIRST_CLASS_DISTINCTION | FIRST_CLASS | SECOND_CLASS | PASS_CLASS
    rank: { type: Number, default: null },
    completedOn: { type: Date, default: null }, // results of his last semester
    awardedOn: { type: Date, default: Date.now },
    reference: { type: String, default: "" }, // Academic Council resolution
    previousStatus: { type: String, default: "active" },
    by: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.models.DiplomaAward || mongoose.model("DiplomaAward", diplomaAwardSchema);
