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