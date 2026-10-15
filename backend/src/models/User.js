// src/models/User.js

import mongoose from "mongoose";

import { ROLES } from "../config/roles.js";

const userSchema = new mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      trim: true,
      required: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },

    phone: {
      type: String,
      trim: true,
      default: "",
    },

    role: {
      type: String,
      // See config/roles.js. "exam_officer" and "student" are old values
      // kept only so existing records still load.
      enum: [...ROLES, "exam_officer", "student"],
      required: true,
    },

    department: {
      type: String,
      enum: [
        "at",
        "ch",
        "ce",
        "cs",
        "ec",
        "ee",
        "me",
        "ps",
        "sc",
        "ot",
        "",
      ],
      default: "",
    },

    // Lecturer / Senior Grade Lecturer / Selection Grade Lecturer (see DESIGNATIONS)
    designation: { type: String, trim: true, default: "" },

    // The examiner's institution. Empty = our own college (see collegeOf)
    collegeCode: { type: String, trim: true, default: "" },
    collegeName: { type: String, trim: true, default: "" },

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

export const DESIGNATIONS = ["Lecturer", "Senior Grade Lecturer", "Selection Grade Lecturer"];

// "SELECTION GRADE LECTURER" / "selection grade" -> "Selection Grade Lecturer";
// "" stays ""; anything else -> null (invalid)
export function normalizeDesignation(value) {
  const v = String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!v) return "";
  if (v.startsWith("selection")) return DESIGNATIONS[2];
  if (v.startsWith("senior")) return DESIGNATIONS[1];
  if (v === "lecturer") return DESIGNATIONS[0];
  return null;
}

// Everyone already in the database is from our college
export const HOME_COLLEGE = { code: "103", name: "Karnataka (Govt.) Polytechnic, Mangaluru" };
export const collegeOf = (u) =>
  !u?.collegeCode || u.collegeCode === HOME_COLLEGE.code
    ? { ...HOME_COLLEGE, external: false }
    : { code: u.collegeCode, name: u.collegeName || "", external: true };

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

export default User;