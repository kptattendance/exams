// src/services/backupJob.js
//
// Making a backup (by hand or every night) and removing old ones.
//
// Nightly (Vercel Cron, about 2 AM India time – see backend/vercel.json):
//   GET /api/backups/auto  →  backup → remove old backups → email if it failed
//
// What is kept (India dates; everything else is removed from Google Drive and the list):
//   - every backup marked "Keep"
//   - the newest backup of each of the last 7 days
//   - the newest backup of each of the last 4 weeks (Monday–Sunday)
//   - the first backup of each of the last 6 months
//   - always the newest backup
// Failed attempts are removed from the list after 30 days.

import mongoose from "mongoose";

import Backup from "../models/Backup.js";
import AuditLog from "../models/AuditLog.js";
import Setting from "../models/Setting.js";
import { makeBackup } from "./backup.js";
import { deleteFile, uploadBackup } from "./driveStorage.js";
import { sendBackupAlertEmail } from "./mailer.js";

export const KEEP = { days: 7, weeks: 4, months: 6 };
const DAY = 86400000;

// India calendar day of a moment, as a UTC-midnight number (for counting days)
const istDay = (d) => {
  const [y, m, dd] = new Date(d).toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" }).split("-").map(Number);
  return Date.UTC(y, m - 1, dd);
};
const weekStart = (day) => day - ((new Date(day).getUTCDay() + 6) % 7) * DAY; // Monday
const monthKey = (day) => new Date(day).toISOString().slice(0, 7);

// Which backups to remove (pure – unit-tested). backups: [{ _id, createdAt, status, keep }]
export function planPrune(backups, now = new Date()) {
  const ok = backups.filter((b) => b.status === "OK").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const keep = new Set();
  if (ok[0]) keep.add(String(ok[0]._id)); // never remove the newest
  const today = istDay(now);
  const thisWeek = weekStart(today);
  const months = [];
  for (let i = 0; i < KEEP.months; i++) {
    const d = new Date(today);
    months.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
  }
  const newestOfDay = new Map();
  const newestOfWeek = new Map();
  const firstOfMonth = new Map();
  for (const b of ok) {
    if (b.keep) keep.add(String(b._id));
    const day = istDay(b.createdAt);
    if (today - day < KEEP.days * DAY && !newestOfDay.has(day)) newestOfDay.set(day, b);
    const wk = weekStart(day);
    if (thisWeek - wk < KEEP.weeks * 7 * DAY && !newestOfWeek.has(wk)) newestOfWeek.set(wk, b);
    const mk = monthKey(day);
    if (months.includes(mk)) firstOfMonth.set(mk, b); // ok is newest first, so the last one set is the month's first backup
  }
  for (const m of [newestOfDay, newestOfWeek, firstOfMonth]) for (const b of m.values()) keep.add(String(b._id));
  const remove = ok.filter((b) => !keep.has(String(b._id)));
  const oldFailed = backups.filter((b) => b.status !== "OK" && now - new Date(b.createdAt) > 30 * DAY);
  return { remove, oldFailed };
}

const audit = (action, details) => AuditLog.create({ action, entity: "Backup", actorClerkId: "system", actorEmail: "", actorRole: "system", details }).catch(() => {});

// Make one backup → its record. On failure a FAILED record is kept and the error is thrown.
export async function runBackup({ by = "", reason = "", auto = false } = {}) {
  const started = Date.now();
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(/[-: ]/g, "").slice(0, 12); // 202610292015
  const name = `kpt-backup-${stamp.slice(0, 8)}-${stamp.slice(8)}.kptbak`;
  try {
    const { file, meta } = await makeBackup(mongoose.connection.db, { by, reason });
    const drive = await uploadBackup(file, name);
    const records = Object.values(meta.counts).reduce((a, b) => a + b, 0);
    return await Backup.create({
      name,
      driveFileId: drive.id,
      driveLink: drive.link,
      size: file.length,
      records,
      counts: meta.counts,
      reason,
      by,
      auto,
      seconds: Math.round((Date.now() - started) / 100) / 10,
    });
  } catch (e) {
    console.error("[backup] failed:", e);
    await Backup.create({ name, status: "FAILED", error: String(e.message || e).slice(0, 300), reason, by, auto, seconds: Math.round((Date.now() - started) / 100) / 10 }).catch(() => {});
    e.backupName = name;
    throw e;
  }
}

// Remove old backups (Drive file and list entry) by the rule above → names removed
export async function pruneBackups(now = new Date()) {
  const all = await Backup.find().select("name createdAt status keep driveFileId").lean();
  const { remove, oldFailed } = planPrune(all, now);
  const removed = [];
  for (const b of remove) {
    try {
      if (b.driveFileId) await deleteFile(b.driveFileId);
    } catch (e) {
      // already gone from Drive, or Drive refused: the list entry is still removed only if the file is gone
      if (!/not ?found|404/i.test(String(e.message || e))) {
        console.error("[backup] could not remove", b.name, e.message);
        continue;
      }
    }
    await Backup.deleteOne({ _id: b._id });
    removed.push(b.name);
  }
  if (oldFailed.length) await Backup.deleteMany({ _id: { $in: oldFailed.map((b) => b._id) } });
  if (removed.length) await audit("DATABASE_BACKUPS_REMOVED", { removed });
  return removed;
}

// Where the "backup failed" email goes (Admin → Backups); kept in the database, not in the code
export async function alertEmail() {
  return (await Setting.findById("backupAlerts").lean())?.value?.email || "";
}
export async function setAlertEmail(email, by) {
  await Setting.updateOne({ _id: "backupAlerts" }, { $set: { value: { email }, updatedBy: by } }, { upsert: true });
}

// The nightly job: backup, then tidy up; an email when the backup fails
export async function nightly() {
  try {
    const doc = await runBackup({ by: "automatic (nightly)", reason: "Nightly backup", auto: true });
    await audit("DATABASE_BACKUP_CREATED", { name: doc.name, records: doc.records, size: doc.size, auto: true });
    const removed = await pruneBackups();
    return { ok: true, name: doc.name, removed };
  } catch (e) {
    await audit("DATABASE_BACKUP_FAILED", { name: e.backupName || "", error: String(e.message || e).slice(0, 300), auto: true });
    const to = await alertEmail();
    if (to) await sendBackupAlertEmail({ to, error: String(e.message || e), name: e.backupName || "" }).catch((m) => console.error("[backup] alert email failed:", m.message));
    return { ok: false, error: String(e.message || e) };
  }
}
