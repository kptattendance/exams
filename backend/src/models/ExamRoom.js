// src/models/ExamRoom.js
//
// One examination room (hall) of one session of a written exam: which
// register numbers sit there. The Chief Examiner allots the rooms on the
// exam day and prints a room diary for each (students write their answer
// script number and sign; the invigilator writes "Absent").

import mongoose from "mongoose";

const examRoomSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    date: { type: String, required: true }, // "2026-11-16"
    session: { type: String, enum: ["FN", "AN"], required: true },
    name: { type: String, required: true, trim: true }, // "Room 12" / "Drawing Hall"
    order: { type: Number, default: 0 },
    invigilator: { type: String, default: "", trim: true },
    students: { type: [String], default: [] }, // register numbers
    savedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

examRoomSchema.index({ exam: 1, date: 1, session: 1, name: 1 }, { unique: true });

export default mongoose.models.ExamRoom || mongoose.model("ExamRoom", examRoomSchema);
