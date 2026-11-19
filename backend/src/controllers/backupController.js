// src/controllers/backupController.js
//
// Admin only: full database backups.
//   POST /api/backups              "Back up now" – every collection, encrypted,
//                                  checked, saved to Google Drive ("Backups")
//   GET  /api/backups              the backups made so far (newest first)
//   GET  /api/backups/:id/download the encrypted file (for an offline copy)
// Restoring is done with backend/scripts/restoreBackup.js, never from the website.

import mongoose from "mongoose";

import Backup from "../models/Backup.js";
import AuditLog from "../models/AuditLog.js";
import { downloadFile } from "../services/driveStorage.js";
import { KEEP, alertEmail, nightly, runBackup, setAlertEmail } from "../services/backupJob.js";

const fail = (res, status, error) => res.status(status).json({ error });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const log = (req, action, details) =>
  AuditLog.create({
    action,
    entity: "Backup",
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    details,
  }).catch(() => {});

const view = (b) => ({
  _id: b._id,
  name: b.name,
  at: b.createdAt,
  size: b.size,
  records: b.records,
  counts: b.counts,
  status: b.status,
  error: b.error,
  reason: b.reason,
  by: b.by,
  seconds: b.seconds,
  driveLink: b.driveLink,
  auto: Boolean(b.auto),
  keep: Boolean(b.keep),
});

// GET /api/backups
export const listBackups = async (req, res) => {
  const items = await Backup.find().sort({ createdAt: -1 }).limit(100).lean();
  const lastOk = items.find((b) => b.status === "OK");
  res.json({
    data: items.map(view),
    lastOk: lastOk ? view(lastOk) : null,
    keyFromBackupKey: Boolean(process.env.BACKUP_KEY),
    nightly: { on: Boolean(process.env.CRON_SECRET), alertEmail: await alertEmail(), keep: KEEP },
  });
};

// GET /api/backups/auto – called by Vercel Cron every night (Authorization: Bearer CRON_SECRET)
export const autoBackup = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return fail(res, 401, "Not allowed.");
  const r = await nightly();
  res.status(r.ok ? 200 : 500).json(r);
};

// PATCH /api/backups/:id  { keep } – a backup marked "Keep" is never removed automatically
export const setKeep = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid backup.");
  const b = await Backup.findByIdAndUpdate(req.params.id, { $set: { keep: Boolean(req.body?.keep) } }, { returnDocument: "after" }).lean();
  if (!b) return fail(res, 404, "Backup not found.");
  await log(req, b.keep ? "DATABASE_BACKUP_KEPT" : "DATABASE_BACKUP_UNKEPT", { name: b.name });
  res.json({ data: view(b), message: b.keep ? "This backup will be kept." : "This backup follows the normal rule again." });
};

// PUT /api/backups/alert-email  { email } – where the "nightly backup failed" email goes
export const saveAlertEmail = async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, "Write a valid email address.");
  await setAlertEmail(email, who(req));
  await log(req, "DATABASE_BACKUP_ALERT_EMAIL", { email });
  res.json({ message: email ? `Failure emails go to ${email}.` : "No failure email will be sent." });
};

// POST /api/backups  { reason? }
export const createBackup = async (req, res) => {
  const reason = String(req.body?.reason || "").trim().slice(0, 120);
  try {
    const doc = await runBackup({ by: who(req), reason });
    await log(req, "DATABASE_BACKUP_CREATED", { name: doc.name, records: doc.records, size: doc.size, driveFileId: doc.driveFileId });
    res.status(201).json({
      data: view(doc),
      message: `Backup saved: ${doc.records.toLocaleString("en-IN")} records in ${Object.keys(doc.counts || {}).length} collections (${(doc.size / 1024).toFixed(0)} KB).`,
    });
  } catch (e) {
    await log(req, "DATABASE_BACKUP_FAILED", { name: e.backupName || "", error: String(e.message || e).slice(0, 300) });
    fail(res, 500, `The backup could not be made: ${e.message}`);
  }
};

// GET /api/backups/:id/download – the encrypted file as it is in Drive
export const downloadBackup = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid backup.");
  const b = await Backup.findById(req.params.id).lean();
  if (!b?.driveFileId) return fail(res, 404, "Backup not found.");
  try {
    const file = await downloadFile(b.driveFileId);
    await log(req, "DATABASE_BACKUP_DOWNLOADED", { name: b.name });
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${b.name}"`);
    res.send(file);
  } catch (e) {
    fail(res, 502, `Could not get the file from Google Drive: ${e.message}. Open it in Drive instead.`);
  }
};
