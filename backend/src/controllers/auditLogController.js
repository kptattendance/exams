// src/controllers/auditLogController.js
//
// Admin: the activity log – everything recorded in AuditLog (who did what,
// when, from where). Search / filter, download as Excel, and every 2 years
// the old entries are archived to Google Drive (Excel) and then removed.

import XLSX from "xlsx";

import AuditLog from "../models/AuditLog.js";
import { uploadLogArchive } from "../services/driveStorage.js";

const KEEP_YEARS = 2;
const fail = (res, status, error) => res.status(status).json({ error });
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// "STUDENT_IMPORT_STARTED" -> "Student import started"
export const actionLabel = (a) => {
  const t = String(a || "").toLowerCase().replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

// details object -> one short readable line
export function summarise(details) {
  if (!details || typeof details !== "object") return "";
  const part = (v) => (Array.isArray(v) ? (v.length > 6 ? `${v.slice(0, 6).join(", ")} … (+${v.length - 6})` : v.join(", ")) : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${part(v)}`)
    .join(" · ")
    .slice(0, 500);
}

function filterOf(q) {
  const f = {};
  if (q.action) f.action = String(q.action);
  if (q.role) f.actorRole = String(q.role);
  if (q.entity) f.entity = String(q.entity);
  const from = q.from && new Date(`${q.from}T00:00:00+05:30`);
  const to = q.to && new Date(`${q.to}T23:59:59.999+05:30`);
  if ((from && !isNaN(from)) || (to && !isNaN(to))) {
    f.createdAt = {};
    if (from && !isNaN(from)) f.createdAt.$gte = from;
    if (to && !isNaN(to)) f.createdAt.$lte = to;
  }
  if (q.q) {
    const rx = new RegExp(esc(String(q.q).trim()), "i");
    f.$or = [{ actorEmail: rx }, { action: rx }, { entity: rx }, { ip: rx }, { "details.code": rx }, { "details.registerNumber": rx }, { "details.fileName": rx }, { "details.to": rx }];
  }
  return f;
}

const view = (l) => ({
  _id: l._id,
  at: l.createdAt,
  action: l.action,
  label: actionLabel(l.action),
  entity: l.entity,
  entityId: l.entityId,
  email: l.actorEmail,
  role: l.actorRole,
  ip: l.ip,
  summary: summarise(l.details),
  details: l.details,
});

// GET /api/audit-logs?q=&action=&role=&entity=&from=&to=&page=&limit=
export const listLogs = async (req, res) => {
  const filter = filterOf(req.query);
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ data: items.map(view), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
};

// GET /api/audit-logs/meta – choices for the filters and the archive count
export const logsMeta = async (req, res) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - KEEP_YEARS);
  const [actions, roles, entities, total, old, today] = await Promise.all([
    AuditLog.distinct("action"),
    AuditLog.distinct("actorRole"),
    AuditLog.distinct("entity"),
    AuditLog.estimatedDocumentCount(),
    AuditLog.countDocuments({ createdAt: { $lt: cutoff } }),
    AuditLog.countDocuments({ createdAt: { $gte: new Date(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00+05:30") } }),
  ]);
  res.json({
    actions: actions.sort().map((a) => ({ value: a, label: actionLabel(a) })),
    roles: roles.filter(Boolean).sort(),
    entities: entities.filter(Boolean).sort(),
    total,
    today,
    olderThanKeep: old,
    keepYears: KEEP_YEARS,
  });
};

const sheetOf = (logs) => {
  const ws = XLSX.utils.json_to_sheet(
    logs.map((l, i) => ({
      "Sl No": i + 1,
      "Date & time (IST)": new Date(l.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
      Action: actionLabel(l.action),
      "Action code": l.action,
      By: l.actorEmail,
      Role: l.actorRole,
      About: l.entity,
      Details: summarise(l.details),
      IP: l.ip,
      Browser: l.userAgent || "",
    }))
  );
  ws["!cols"] = [{ wch: 7 }, { wch: 22 }, { wch: 34 }, { wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 16 }, { wch: 80 }, { wch: 16 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activity log");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
};

// GET /api/audit-logs/export?…filters – Excel (newest first, at most 50 000 rows)
export const exportLogs = async (req, res) => {
  const logs = await AuditLog.find(filterOf(req.query)).sort({ createdAt: -1 }).limit(50000).lean();
  const buf = sheetOf(logs);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="activity_log_${new Date().toISOString().slice(0, 10)}.xlsx"`);
  res.send(buf);
};

// POST /api/audit-logs/archive – entries older than 2 years: saved to Google
// Drive as Excel, and removed only after the upload succeeded.
export const archiveOldLogs = async (req, res) => {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - KEEP_YEARS);
  const old = await AuditLog.find({ createdAt: { $lt: cutoff } }).sort({ createdAt: 1 }).lean();
  if (!old.length) return res.json({ message: `Nothing to archive – no entries older than ${KEEP_YEARS} years.` });
  const first = new Date(old[0].createdAt).toISOString().slice(0, 10);
  const last = new Date(old.at(-1).createdAt).toISOString().slice(0, 10);
  let fileId;
  try {
    fileId = await uploadLogArchive(sheetOf(old), `activity_log_${first}_to_${last}.xlsx`);
  } catch (e) {
    return fail(res, 502, `Could not save the archive to Google Drive (${e.message}). Nothing was removed.`);
  }
  // The model blocks deletes (the log is append-only); archiving is the one
  // deliberate exception, done directly on the collection after the Drive copy.
  const { deletedCount } = await AuditLog.collection.deleteMany({ _id: { $in: old.map((l) => l._id) } });
  await AuditLog.create({
    action: "ACTIVITY_LOG_ARCHIVED",
    entity: "AuditLog",
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    details: { entries: deletedCount, from: first, to: last, driveFileId: fileId },
  });
  res.json({ message: `${deletedCount} entries from ${first} to ${last} saved to Google Drive ("Activity logs" folder) and removed.` });
};
