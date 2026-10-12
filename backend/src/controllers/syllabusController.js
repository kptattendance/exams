// src/controllers/syllabusController.js
//
// Syllabus / scheme PDFs that are attached to the paper-setting email.
// The COE uploads them once. The file name must start with the subject code
// ("25CS31T0.pdf", "25CS31T0 scheme.pdf"); every file of a code is attached.

import mongoose from "mongoose";
import multer from "multer";

import Subject from "../models/Subject.js";
import SyllabusFile from "../models/SyllabusFile.js";
import { audit } from "../models/AuditLog.js";
import { uploadSyllabus, downloadFile, deleteFile } from "../services/driveStorage.js";

const MAX_MB = Number(process.env.MAX_PAPER_MB || 4);
// Gmail refuses mails above 25 MB
const MAX_MAIL_BYTES = 15 * 1024 * 1024;

const fail = (res, status, error) => res.status(status).json({ error });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    /\.pdf$/i.test(file.originalname) ? cb(null, true) : cb(Object.assign(new Error("Only PDF files are allowed."), { status: 400 })),
}).single("file");

export const uploadPdf = (req, res, next) =>
  upload(req, res, (err) => {
    if (!err) return next();
    fail(res, err.status || 400, err.code === "LIMIT_FILE_SIZE" ? `File is larger than ${MAX_MB} MB.` : err.message);
  });

// "25cs31t0 scheme.pdf" -> "25CS31T0" (the longest subject code the name starts with)
export function codeFromName(fileName, codes) {
  const name = String(fileName || "").trim().toUpperCase();
  return codes.filter((c) => name.startsWith(c)).sort((a, b) => b.length - a.length)[0] || null;
}

// GET /api/paper-setting/syllabus
export const listSyllabus = async (req, res) => {
  const files = await SyllabusFile.find().select("code name size createdAt").sort({ code: 1, name: 1 }).lean();
  res.json({ data: files });
};

// POST /api/paper-setting/syllabus   (multipart: file)
export const addSyllabus = async (req, res) => {
  if (!req.file) return fail(res, 400, "Choose a PDF file.");
  if (req.file.buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return fail(res, 400, "This is not a PDF file.");
  const name = req.file.originalname.trim();
  const code = codeFromName(name, await Subject.distinct("code"));
  if (!code) return fail(res, 400, "The file name must start with the subject code, e.g. 25CS31T0.pdf");

  const old = await SyllabusFile.findOne({ code, name });
  const driveFileId = await uploadSyllabus(req.file.buffer, name);
  const file = await SyllabusFile.findOneAndUpdate(
    { code, name },
    { $set: { driveFileId, size: req.file.size, uploadedBy: req.user?.email || req.user?.id || "" } },
    { upsert: true, returnDocument: "after" }
  );
  if (old) await deleteFile(old.driveFileId);
  await audit(req, "SYLLABUS_UPLOADED", file._id, { code, name });
  res.status(201).json({ data: { _id: file._id, code, name, size: file.size }, replaced: Boolean(old) });
};

// DELETE /api/paper-setting/syllabus/:id
export const removeSyllabus = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return fail(res, 400, "Invalid id.");
  const file = await SyllabusFile.findByIdAndDelete(req.params.id);
  if (!file) return fail(res, 404, "Not found.");
  await deleteFile(file.driveFileId);
  await audit(req, "SYLLABUS_REMOVED", file._id, { code: file.code, name: file.name });
  res.json({ ok: true });
};

// The files to attach to a subject's email. A file that cannot be fetched is
// left out, so a Drive problem never stops the email itself.
export async function syllabusAttachments(code) {
  const files = await SyllabusFile.find({ code: String(code || "").toUpperCase() }).sort({ name: 1 }).lean();
  const out = [];
  let bytes = 0;
  for (const f of files) {
    if (bytes + f.size > MAX_MAIL_BYTES) continue;
    try {
      out.push({ filename: f.name, content: await downloadFile(f.driveFileId), contentType: "application/pdf" });
      bytes += f.size;
    } catch (e) {
      console.error("Syllabus file could not be read:", f.name, e.message);
    }
  }
  return out;
}
