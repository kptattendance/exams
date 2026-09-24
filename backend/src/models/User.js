// src/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Clerk ID (link to Clerk user)
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Basic profile
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
    },

role: {
  type: String,
  enum: ["admin", "principal", "hod", "staff", "student"],
  required: true,
},

    // Department (short codes from form)
    department: {
      type: String,
      enum: [
        "at", // Automobile Engineering
        "ch", // Chemical Engineering
        "ce", // Civil Engineering
        "cs", // Computer Science Engineering
        "ec", // Electronics & Communication
        "ee", // Electrical & Electronics
        "me", // Mechanical
        "ps", // Polymer
        "sc", // Science & English
        "", // allow empty (e.g. for Admins with no dept)
      ],
      default: "",
    },

    // Profile image (stored in Cloudinary)
    imageUrl: {
      type: String,
    },

    // Optional: store Cloudinary public_id for easy image replacement
    imagePublicId: {
      type: String,
    },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

export default User;
