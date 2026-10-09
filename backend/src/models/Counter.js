// src/models/Counter.js
// Atomic counters, e.g. the last register-number serial issued per series:
//   _id: "regno:AT:26:regular"  seq: 64

import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.models.Counter || mongoose.model("Counter", counterSchema);
