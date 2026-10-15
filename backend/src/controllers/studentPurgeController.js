// src/controllers/studentPurgeController.js
//
// Admin only: delete students together with ALL their records (exam
// registrations, scripts, results, sheets, photo, login …).
//
//   1. POST /api/students/purge/request  { ids }        → shows what will go,
//      emails a 6-digit code to the signed-in admin
//   2. POST /api/students/purge/confirm  { requestId, code } → deletes
//   3. GET  /api/students/purge/log                      → who deleted what, when
//
// Every request and every deletion is written to the audit log.

import crypto from "node:crypto";
import mongoose from "mongoose";

import SecurityCode from "../models/SecurityCode.js";
import AuditLog from "../models/AuditLog.js";
import { purgeSummary, purgeStudents } from "../services/studentPurge.js";
import { sendSecurityCodeEmail } from "../services/mailer.js";

const CODE_MINUTES = 10;
const MAX_TRIES = 5;
const MAX_STUDENTS = 500;

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const hashOf = (code, salt) => crypto.scryptSync(String(code).replace(/\s+/g, ""), salt, 32).toString("hex");
const mask = (email = "") => email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");

const log = (req, action, details) =>
  AuditLog.create({
    action,
    entity: "Student",
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

// POST /api/students/purge/request  { ids: [...] }
export const requestPurge = async (req, res) => {
  const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(String))].filter((id) =>
    mongoose.Types.ObjectId.isValid(id)
  );
  if (!ids.length) return fail(res, 400, "No students selected.");
  if (ids.length > MAX_STUDENTS) return fail(res, 400, `Select at most ${MAX_STUDENTS} students at a time.`);
  if (!req.user?.email) return fail(res, 400, "Your account has no email address to send the code to.");

  const summary = await purgeSummary(ids);
  if (!summary.students.length) return fail(res, 404, "These students no longer exist.");

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const salt = crypto.randomBytes(16).toString("hex");
  const doc = await SecurityCode.create({
    purpose: "STUDENT_PURGE",
    payload: { ids: summary.students.map((s) => s._id) },
    salt,
    hash: hashOf(code, salt),
    requestedBy: req.user.id,
    sentTo: req.user.email,
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  });

  const n = summary.students.length;
  let sent = false;
  try {
    sent = await sendSecurityCodeEmail({
      to: req.user.email,
      code,
      action: `delete ${n} student${n > 1 ? "s" : ""} with all their records`,
      details: [
        ...summary.students.slice(0, 10).map((s) => `${s.registerNumber} – ${s.name}`),
        ...(n > 10 ? [`… and ${n - 10} more`] : []),
      ],
    });
  } catch (e) {
    console.error("Security code email failed:", e.message);
  }
  if (!sent) {
    await SecurityCode.deleteOne({ _id: doc._id });
    return fail(res, 502, "The code email could not be sent. Check the email (SMTP) settings.");
  }

  await log(req, "STUDENT_PURGE_REQUESTED", {
    count: n,
    registerNumbers: summary.students.map((s) => s.registerNumber),
  });
  res.json({ success: true, requestId: doc._id, sentTo: mask(req.user.email), minutes: CODE_MINUTES, summary });
};

// POST /api/students/purge/confirm  { requestId, code }
export const confirmPurge = async (req, res) => {
  const { requestId, code } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(requestId)) return fail(res, 400, "Invalid request.");
  const doc = await SecurityCode.findOne({ _id: requestId, purpose: "STUDENT_PURGE", requestedBy: req.user.id });
  if (!doc || doc.expiresAt < new Date()) return fail(res, 410, "The code has expired. Start again.");
  if (doc.attempts >= MAX_TRIES) return fail(res, 429, "Too many wrong codes. Start again.");

  const a = Buffer.from(hashOf(code, doc.salt), "hex");
  const b = Buffer.from(doc.hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    doc.attempts += 1;
    await doc.save();
    return fail(res, 400, `Wrong code. ${Math.max(0, MAX_TRIES - doc.attempts)} tries left.`);
  }
  // One use only
  await SecurityCode.deleteOne({ _id: doc._id });

  const result = await purgeStudents(doc.payload?.ids || []);
  await log(req, "STUDENTS_PURGED", {
    count: result.students.length,
    students: result.students,
    removed: result.counts,
    warnings: result.warnings,
  });
  res.json({
    success: true,
    message: `${result.counts.students} student${result.counts.students === 1 ? "" : "s"} deleted with all their records.`,
    deletedIds: doc.payload?.ids || [],
    ...result,
  });
};

// GET /api/students/purge/log
export const purgeLog = async (req, res) => {
  const items = await AuditLog.find({ entity: "Student", action: { $in: ["STUDENT_PURGE_REQUESTED", "STUDENTS_PURGED"] } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    success: true,
    data: items.map((l) => ({
      _id: l._id,
      action: l.action,
      at: l.createdAt,
      by: l.actorEmail,
      ip: l.ip,
      count: l.details?.count || 0,
      students: l.details?.students || (l.details?.registerNumbers || []).map((r) => ({ registerNumber: r })),
      removed: l.details?.removed || null,
      warnings: l.details?.warnings || [],
    })),
  });
};
