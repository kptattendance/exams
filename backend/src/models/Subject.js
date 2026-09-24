import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },

    department: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },


  },
  {
    timestamps: true,
  }
);

// Same subject code can exist in different departments
subjectSchema.index(
  {
    code: 1,
    department: 1,
  },
  {
    unique: true,
  }
);

export default mongoose.model("Subject", subjectSchema);