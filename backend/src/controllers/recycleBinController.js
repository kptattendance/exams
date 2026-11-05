// src/controllers/recycleBinController.js
//
// Admin: the Recycle bin – deleted students, subjects and IA / attendance
// sheets, kept 30 days.
//
//   GET    /api/recycle-bin?kind=STUDENT        list (expired entries are cleared first)
//   POST   /api/recycle-bin/:id/restore         put it back
//   DELETE /api/recycle-bin/:id                 delete for good (type DELETE + code)

import mongoose from "mongoose";

import RecycleBin from "../models/RecycleBin.js";
import { audit } from "../models/AuditLog.js";
import { cleanupExpired, deleteForGood, restoreEntry } from "../services/recycleBin.js";
import { refreshAfterChange, refreshNote } from "../services/exams/autoRefresh.js";

const fail = (res, status, error) => res.status(status).json({ error });
const isId = (id) => mongoose.Types.ObjectId.isValid(id);

const view = (e) => ({
  _id: e._id,
  kind: e.kind,
  label: e.label,
  department: e.department,
  semester: e.semester,
  reason: e.reason,
  deletedBy: e.deletedBy,
  deletedAt: e.deletedAt,
  expiresAt: e.expiresAt,
  // what comes back with it
  records:
    e.kind === "STUDENT"
      ? {
          registrations: e.data?.examregistrations?.length || 0,
          results: e.data?.courseresults?.length || 0,
          electives: e.data?.studentelectives?.length || 0,
          sheetRows: e.data?.sheetRows?.length || 0,
        }
      : e.kind === "SUBJECT"
        ? {}
        : { students: e.data?.sheets?.[0]?.students?.length || 0, status: e.data?.sheets?.[0]?.status || "" },
});

export const listBin = async (req, res) => {
  await cleanupExpired();
  const filter = {};
  if (req.query.kind) filter.kind = String(req.query.kind).toUpperCase();
  const list = await RecycleBin.find(filter).select("-data.students.aadhaarEncrypted").sort({ deletedAt: -1 }).limit(1000).lean();
  const counts = await RecycleBin.aggregate([{ $group: { _id: "$kind", n: { $sum: 1 } } }]);
  res.json({ data: list.map(view), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
};

export const restoreFromBin = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const entry = await RecycleBin.findById(req.params.id).lean();
  if (!entry) return fail(res, 404, "Not in the Recycle bin any more.");
  try {
    const out = await restoreEntry(entry);
    await audit(req, "RECYCLE_BIN_RESTORED", entry._id, { kind: entry.kind, label: entry.label, ...out.counts });
    const auto = await refreshAfterChange(out.classes, "restored from the Recycle bin");
    res.json({ message: `${entry.label} restored.${refreshNote(auto)}` });
  } catch (e) {
    if (e.status) return fail(res, e.status, e.message);
    console.error("Restore error:", e);
    fail(res, 500, "Could not restore. Nothing was changed.");
  }
};

export const deleteFromBin = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
  const entry = await RecycleBin.findById(req.params.id).lean();
  if (!entry) return fail(res, 404, "Not in the Recycle bin any more.");
  const warnings = await deleteForGood(entry);
  await audit(req, "RECYCLE_BIN_DELETED_FOR_GOOD", entry._id, { kind: entry.kind, label: entry.label, warnings });
  res.json({ message: `${entry.label} deleted for good.${warnings.length ? ` (${warnings.join("; ")})` : ""}` });
};
