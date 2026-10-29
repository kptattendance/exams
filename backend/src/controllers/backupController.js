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
import { makeBackup } from "../services/backup.js";
import { downloadFile, uploadBackup } from "../services/driveStorage.js";

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
});

// GET /api/backups
export const listBackups = async (req, res) => {
  const items = await Backup.find().sort({ createdAt: -1 }).limit(100).lean();
  const lastOk = items.find((b) => b.status === "OK");
  res.json({ data: items.map(view), lastOk: lastOk ? view(lastOk) : null, keyFromBackupKey: Boolean(process.env.BACKUP_KEY) });
};

// POST /api/backups  { reason? }
export const createBackup = async (req, res) => {
  const started = Date.now();
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(/[-: ]/g, "").slice(0, 12); // 202610292015
  const name = `kpt-backup-${stamp.slice(0, 8)}-${stamp.slice(8)}.kptbak`;
  const reason = String(req.body?.reason || "").trim().slice(0, 120);
  try {
    const { file, meta } = await makeBackup(mongoose.connection.db, { by: who(req), reason });
    const drive = await uploadBackup(file, name);
    const records = Object.values(meta.counts).reduce((a, b) => a + b, 0);
    const doc = await Backup.create({
      name,
      driveFileId: drive.id,
      driveLink: drive.link,
      size: file.length,
      records,
      counts: meta.counts,
      reason,
      by: who(req),
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
    await log(req, "DATABASE_BACKUP_CREATED", { name, records, size: file.length, driveFileId: drive.id });
    res.status(201).json({ data: view(doc), message: `Backup saved: ${records.toLocaleString("en-IN")} records in ${Object.keys(meta.counts).length} collections (${(file.length / 1024).toFixed(0)} KB).` });
  } catch (e) {
    console.error("[backup] failed:", e);
    await Backup.create({ name, status: "FAILED", error: String(e.message || e).slice(0, 300), reason, by: who(req), seconds: Math.round((Date.now() - started) / 100) / 10 }).catch(() => {});
    await log(req, "DATABASE_BACKUP_FAILED", { name, error: String(e.message || e).slice(0, 300) });
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
