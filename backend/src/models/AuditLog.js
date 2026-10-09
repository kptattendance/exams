// src/models/AuditLog.js
//
// Append-only log of every sensitive action on question papers.
// Nothing in the app updates or deletes these documents.

import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    entity: { type: String, default: "PaperSetting" },
    entityId: { type: mongoose.Schema.Types.ObjectId, index: true },

    actorClerkId: { type: String, required: true },
    actorEmail: { type: String, default: "" },
    actorRole: { type: String, default: "" },

    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Block updates/deletes through Mongoose
for (const op of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
]) {
  auditLogSchema.pre(op, function () {
    throw new Error("AuditLog is append-only");
  });
}

const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;

export const audit = (req, action, entityId, details = {}) =>
  AuditLog.create({
    action,
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip:
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log write failed:", e.message));
