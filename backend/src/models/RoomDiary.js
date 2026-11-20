// src/models/RoomDiary.js
//
// One room diary = one paper in one room of one session = one packet.
// Made automatically when the Chief Examiner saves the rooms:
//   base    – random 6-digit number, the first part of every ATS in this diary
//   serials – each student's 2-digit serial (shuffled), so ATS = base + serial
//   number  – the packet number, P-0001, P-0002 … (one running number per exam)
// The ATS ↔ register-number link is seen only by the COE / ACOE / Admin (and the
// Chief Examiner on the exam day, to print the diary).

import mongoose from "mongoose";

const roomDiarySchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    date: { type: String, required: true }, // "2026-11-16"
    session: { type: String, enum: ["FN", "AN"], required: true },
    room: { type: String, required: true },
    code: { type: String, required: true }, // subject code
    base: { type: String, required: true }, // "482715"
    number: { type: String, required: true }, // "P-0007"
    serials: { type: Map, of: String, default: {} }, // register number -> "07"
    // changed after it was first made: print it again
    reprint: { type: Boolean, default: false },
  },
  { timestamps: true }
);

roomDiarySchema.index({ exam: 1, date: 1, session: 1, room: 1, code: 1 }, { unique: true });
roomDiarySchema.index({ exam: 1, base: 1 }, { unique: true });
roomDiarySchema.index({ exam: 1, number: 1 }, { unique: true });

export default mongoose.models.RoomDiary || mongoose.model("RoomDiary", roomDiarySchema);
