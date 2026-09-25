// src/models/User.js

import mongoose from "mongoose";

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
      enum: [
        "admin",
        "principal",
        "coe",
        "exam_officer",
        "hod",
        "staff",
        "student",
      ],
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

const User =
  mongoose.models.User ||
  mongoose.model(
    "User",
    userSchema
  );

export default User;