// src/controllers/studentImportController.js
//
// 1st-YEAR STUDENT IMPORT (Admin + COE)
//
//  1. POST /preview        Excel -> every row checked, register numbers shown.
//                          Nothing is saved.
//  2. POST /               Same Excel again. If there are no errors, register
//                          numbers are RESERVED for all rows at once (in roll
//                          number order) and an import record is created.
//  3. POST /:id/process    Called repeatedly by the page: creates a few
//                          students at a time (login + record), then copies
//                          their Google Drive photos into Cloudinary.
//  4. GET  /:id/export     Excel of the result with the register numbers.
//
//  POST /photo             Upload one photo named by roll / register number
//                          (e.g. AT26001.jpg) to set or replace a photo.

import { Readable } from "stream";
import mongoose from "mongoose";
import XLSX from "xlsx";
import axios from "axios";
import { clerkClient } from "@clerk/express";

import cloudinary from "../config/cloudinary.js";
import Student from "../models/Student.js";
import Counter from "../models/Counter.js";
import StudentImport from "../models/StudentImport.js";
import AuditLog from "../models/AuditLog.js";
import { encryptAadhaar, hashAadhaar } from "../services/studentCrypto.js";
import {
  ADMISSION_TYPES,
  mapHeaders,
  cleanRow,
  findDuplicatesInFile,
  groupBySeries,
  assignRegisterNumbers,
  highestExistingSerial,
  formatRegisterNumber,
  getDriveFileId,
  hasErrors,
} from "../services/studentImport/rules.js";

const PHOTO_FOLDER = "kpt-examination/students";
const isId = (id) => mongoose.Types.ObjectId.isValid(id);

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });

const logAction = (req, action, entityId, details = {}) =>
  AuditLog.create({
    action,
    entity: "StudentImport",
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

// ====================================================================
// Reading and checking the Excel
// ====================================================================

function readWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw Object.assign(new Error("The Excel file has no sheets."), { status: 400 });
  const headerRow = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, blankrows: false })[0] || [];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true, blankrows: false });
  return { headers: headerRow.map((h) => String(h ?? "").trim()), rows };
}

/** Existing register numbers for the given prefixes, e.g. 103AT26 */
async function existingStudents(prefixes) {
  if (!prefixes.length) return [];
  const regex = new RegExp(`^(${prefixes.join("|")})\\d{3}$`);
  return Student.find({ registerNumber: regex }).select("registerNumber rollNumber name").lean();
}

async function existingNumbers(prefixes) {
  return (await existingStudents(prefixes)).map((d) => d.registerNumber);
}

async function clerkEmailsInUse(emails) {
  const inUse = new Set();
  try {
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const res = await clerkClient.users.getUserList({ emailAddress: chunk, limit: 100 });
      for (const u of res.data || res || []) {
        for (const e of u.emailAddresses || []) inUse.add(String(e.emailAddress).toLowerCase());
      }
    }
  } catch (e) {
    console.error("Clerk email check failed (continuing):", e.message);
  }
  return inUse;
}

/**
 * Full check of an uploaded Excel. Returns cleaned rows with problems and
 * TENTATIVE register numbers (based on numbers already used).
 */
async function analyse(buffer) {
  const { headers, rows } = readWorkbook(buffer);
  const { map, missing } = mapHeaders(headers);
  if (missing.length) {
    throw Object.assign(new Error(`These columns are missing in the Excel: ${missing.join(", ")}.`), {
      status: 400,
      missingColumns: missing,
    });
  }

  const cleaned = rows
    .map((raw, i) => ({ raw, rowNumber: i + 2 }))
    .filter(({ raw }) => Object.values(raw).some((v) => String(v ?? "").trim() !== ""))
    .map(({ raw, rowNumber }) => cleanRow(raw, map, rowNumber));

  if (!cleaned.length) throw Object.assign(new Error("No student rows found in the Excel."), { status: 400 });
  if (cleaned.length > 600) throw Object.assign(new Error("Please import at most 600 students at a time."), { status: 400 });

  findDuplicatesInFile(cleaned);

  // ---- already in the database?
  const emails = [...new Set(cleaned.map((r) => r.student.email).filter(Boolean))];
  const hashes = cleaned.map((r) => r.student.aadhaar).filter(Boolean).map(hashAadhaar);
  const plainAadhaar = cleaned.map((r) => r.student.aadhaar).filter(Boolean);
  const rollKeys = cleaned.filter((r) => r.student.rollNumber).map((r) => r.student.rollNumber);

  const [byEmail, byAadhaar, byRoll, clerkInUse] = await Promise.all([
    Student.find({ email: { $in: emails } }).select("email registerNumber").lean(),
    Student.find({ $or: [{ aadhaarHash: { $in: hashes } }, { aadhaarNumber: { $in: plainAadhaar } }] })
      .select("aadhaarHash aadhaarNumber registerNumber")
      .lean(),
    Student.find({ rollNumber: { $in: rollKeys } }).select("rollNumber department admissionYear registerNumber").lean(),
    clerkEmailsInUse(emails),
  ]);
  const emailTaken = new Map(byEmail.map((s) => [s.email, s.registerNumber]));
  const aadhaarTaken = new Set([...byAadhaar.map((s) => s.aadhaarHash), ...byAadhaar.map((s) => s.aadhaarNumber)]);
  const rollTaken = new Map(byRoll.map((s) => [`${s.rollNumber}|${s.department}|${s.admissionYear}`, s.registerNumber]));

  for (const row of cleaned) {
    const s = row.student;
    if (s.email && emailTaken.has(s.email))
      row.problems.push({ level: "error", field: "email", message: `Email already used by student ${emailTaken.get(s.email)}.` });
    else if (s.email && clerkInUse.has(s.email))
      row.problems.push({ level: "error", field: "email", message: "A login account already exists with this email." });
    if (s.aadhaar && (aadhaarTaken.has(hashAadhaar(s.aadhaar)) || aadhaarTaken.has(s.aadhaar)))
      row.problems.push({ level: "error", field: "aadhaar", message: "A student with this Aadhaar number already exists." });
    const rk = `${s.rollNumber}|${s.department}|${s.admissionYear}`;
    if (rollTaken.has(rk))
      row.problems.push({ level: "error", field: "rollNumber", message: `Already imported as ${rollTaken.get(rk)}.` });
  }

  // ---- tentative register numbers for rows without errors
  const groups = groupBySeries(cleaned.filter((r) => !hasErrors(r)));
  const prefixes = [...new Set(groups.map((g) => formatRegisterNumber(g.department, g.yy, 0).slice(0, -3)))];
  const [takenDocs, counters] = await Promise.all([
    existingStudents(prefixes),
    Counter.find({ _id: { $in: groups.map((g) => g.key) } }).lean(),
  ]);
  const taken = takenDocs.map((d) => d.registerNumber);
  const lastUsed = {};
  for (const g of groups) {
    const range = ADMISSION_TYPES[g.type];
    const fromCounter = counters.find((c) => c._id === g.key)?.seq || 0;
    const fromStudents = highestExistingSerial(taken, g.department, g.yy, g.type);
    lastUsed[g.key] = Math.max(fromCounter, fromStudents);

    // Tell the user why a series does not start at 001 / 301 / 401 / 701
    const prefix = formatRegisterNumber(g.department, g.yy, 0).slice(0, -3);
    g.holders = takenDocs
      .filter((d) => {
        const serial = parseInt(d.registerNumber.slice(prefix.length), 10);
        return d.registerNumber.startsWith(prefix) && serial >= range.start && serial <= range.end;
      })
      .sort((x, y) => x.registerNumber.localeCompare(y.registerNumber))
      .map((d) => ({ registerNumber: d.registerNumber, rollNumber: d.rollNumber, name: d.name }));
    g.reservedOnly = fromCounter > fromStudents ? fromCounter - Math.max(fromStudents, range.start - 1) : 0;
  }
  assignRegisterNumbers(groups, lastUsed);

  return { rows: cleaned, groups };
}

function previewPayload(fileName, rows, groups) {
  const errors = rows.filter(hasErrors).length;
  const warnings = rows.filter((r) => !hasErrors(r) && r.problems.length).length;
  return {
    fileName,
    summary: {
      total: rows.length,
      ready: rows.length - errors,
      errors,
      warnings,
      withPhoto: rows.filter((r) => r.student.photoUrl).length,
      series: groups.map((g) => ({
        department: g.department.toUpperCase(),
        year: 2000 + g.yy,
        type: g.type,
        typeLabel: ADMISSION_TYPES[g.type].label,
        count: g.rows.length,
        first: g.rows[0]?.student.registerNumber || "",
        last: g.rows.at(-1)?.student.registerNumber || "",
        startsAt: ADMISSION_TYPES[g.type].start,
        alreadyUsed: (g.holders || []).length,
        holders: (g.holders || []).slice(0, 10),
        reservedOnly: g.reservedOnly || 0,
      })),
    },
    // Only what the preview needs – no Aadhaar, phone or parent details
    rows: rows.map(({ student: s, problems }) => ({
      rowNumber: s.rowNumber,
      rollNumber: s.rollNumber,
      registerNumber: hasErrors({ problems }) ? "" : s.registerNumber,
      name: s.name,
      email: s.email,
      department: s.department.toUpperCase(),
      admissionType: s.admissionType,
      semester: s.semester,
      batchNumber: s.batchNumber,
      hasPhoto: Boolean(s.photoUrl),
      problems,
    })),
  };
}

const excelError = (res, e, where) => {
  if (e.status) return fail(res, e.status, e.message, e.missingColumns ? { missingColumns: e.missingColumns } : {});
  console.error(`[studentImport] ${where}:`, e);
  return fail(res, 500, "Could not read the Excel file. Please check it and try again.");
};

// POST /api/student-import/preview
export const previewImport = async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, "Please choose the Excel file.");
    const { rows, groups } = await analyse(req.file.buffer);
    res.json(previewPayload(req.file.originalname, rows, groups));
  } catch (e) {
    excelError(res, e, "preview");
  }
};

// ====================================================================
// Starting an import: reserve register numbers for every row at once
// ====================================================================

async function reserveSeries(group) {
  const range = ADMISSION_TYPES[group.type];
  const prefix = formatRegisterNumber(group.department, group.yy, 0).slice(0, -3);
  const taken = await existingNumbers([prefix]);
  const floor = Math.max(range.start - 1, highestExistingSerial(taken, group.department, group.yy, group.type));

  // Make sure the counter is never behind numbers already in the database…
  await Counter.updateOne({ _id: group.key }, { $max: { seq: floor } }, { upsert: true });
  // …then take a block of numbers in one atomic step
  const after = await Counter.findOneAndUpdate(
    { _id: group.key },
    { $inc: { seq: group.rows.length } },
    { returnDocument: "after" }
  );
  const first = after.seq - group.rows.length + 1;
  if (after.seq > range.end) {
    await Counter.updateOne({ _id: group.key }, { $inc: { seq: -group.rows.length } });
    throw Object.assign(new Error(`Not enough register numbers left in the ${range.label} series for ${group.department.toUpperCase()}.`), { status: 409 });
  }
  return first;
}

// POST /api/student-import
export const startImport = async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, "Please choose the Excel file.");
    const { rows, groups } = await analyse(req.file.buffer);

    if (rows.some(hasErrors)) {
      return fail(res, 400, "Fix the errors in the Excel and upload it again. Nothing was imported.", {
        preview: previewPayload(req.file.originalname, rows, groups),
      });
    }

    // Reserve real numbers (they may differ from the preview if someone
    // else imported the same department in between)
    const importRows = [];
    const reserved = [];
    for (const g of groups) {
      const first = await reserveSeries(g);
      reserved.push({ key: g.key, first, last: first + g.rows.length - 1 });
      g.rows.forEach((row, i) => {
        const s = row.student;
        const serial = first + i;
        const registerNumber = formatRegisterNumber(g.department, g.yy, serial);
        const aad = encryptAadhaar(s.aadhaar);
        importRows.push({
          rowNumber: s.rowNumber,
          registerNumber,
          rollNumber: s.rollNumber,
          name: s.name,
          department: s.department,
          admissionType: s.admissionType,
          photoUrl: s.photoUrl,
          photoState: s.photoUrl ? "PENDING" : "NONE",
          data: {
            registerNumber,
            rollNumber: s.rollNumber,
            name: s.name,
            fatherName: s.fatherName,
            motherName: s.motherName,
            dob: s.dob,
            gender: s.gender,
            email: s.email,
            phone: s.phone,
            parentPhone: s.parentPhone,
            caste: s.caste,
            category: s.category,
            aadhaarNumber: aad.aadhaarNumber,
            aadhaarEncrypted: aad.aadhaarEncrypted,
            aadhaarHash: aad.aadhaarHash,
            satsNumber: s.satsNumber,
            department: s.department,
            admissionYear: s.admissionYear,
            batch: s.batch,
            batchNumber: s.batchNumber,
            semester: s.semester,
            status: s.status,
            admissionType: s.admissionType,
          },
        });
      });
    }
    importRows.sort((a, b) => a.registerNumber.localeCompare(b.registerNumber));

    const doc = await StudentImport.create({
      fileName: req.file.originalname.slice(0, 200),
      createdBy: req.user.id,
      createdByEmail: req.user.email || "",
      departments: [...new Set(groups.map((g) => g.department))],
      reserved,
      rows: importRows,
    });

    await logAction(req, "STUDENT_IMPORT_STARTED", doc._id, {
      fileName: doc.fileName,
      students: importRows.length,
      series: groups.map((g) => `${g.key} x${g.rows.length}`),
    });

    res.status(201).json({ data: importView(doc) });
  } catch (e) {
    excelError(res, e, "start");
  }
};

// ====================================================================
// Processing: a few students per request
// ====================================================================

function importView(doc, { withRows = true } = {}) {
  return {
    _id: doc._id,
    fileName: doc.fileName,
    status: doc.status,
    createdAt: doc.createdAt,
    createdByEmail: doc.createdByEmail,
    departments: doc.departments,
    summary: doc.summary(),
    rows: withRows
      ? doc.rows.map((r) => ({
          rowNumber: r.rowNumber,
          registerNumber: r.registerNumber,
          rollNumber: r.rollNumber,
          name: r.name,
          department: r.department?.toUpperCase(),
          admissionType: r.admissionType,
          state: r.state,
          error: r.error,
          photoState: r.photoState,
          photoError: r.photoError,
        }))
      : undefined,
  };
}

async function createStudent(row, importId) {
  const d = row.data;
  let clerkUser = null;
  try {
    clerkUser = await clerkClient.users.createUser({
      emailAddress: [d.email],
      firstName: d.name,
      publicMetadata: { role: "student", department: d.department, registerNumber: d.registerNumber },
    });
    const student = await Student.create({ ...d, clerkId: clerkUser.id, role: "student", importBatch: importId });
    return student._id;
  } catch (e) {
    if (clerkUser?.id) await clerkClient.users.deleteUser(clerkUser.id).catch(() => {});
    const msg =
      e?.errors?.[0]?.longMessage ||
      e?.errors?.[0]?.message ||
      (e?.code === 11000 ? "Duplicate value (email or register number) already exists." : e.message);
    throw new Error(msg || "Could not create the student.");
  }
}

async function copyDrivePhoto(url) {
  const id = getDriveFileId(url);
  if (!id) throw new Error("Not a Google Drive file link.");
  const resp = await axios.get(`https://drive.google.com/uc?export=download&id=${id}`, {
    responseType: "arraybuffer",
    timeout: 6000,
    maxContentLength: 12 * 1024 * 1024,
  });
  const type = resp.headers["content-type"] || "";
  if (!type.startsWith("image/")) {
    throw new Error("Photo is not shared publicly (set the Drive folder to 'Anyone with the link').");
  }
  return uploadPhotoBuffer(Buffer.from(resp.data));
}

function uploadPhotoBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: PHOTO_FOLDER,
        resource_type: "image",
        transformation: [{ width: 600, height: 800, crop: "limit", quality: "auto:good" }],
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    Readable.from(buffer).pipe(stream);
  });
}

// POST /api/student-import/:id/process
export const processImport = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid import id.");
  const now = new Date();

  // Lock so two open tabs never process the same import at once
  const doc = await StudentImport.findOneAndUpdate(
    { _id: req.params.id, $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }] },
    { $set: { lockedUntil: new Date(now.getTime() + 25 * 1000) } },
    { returnDocument: "after" }
  );
  if (!doc) {
    const exists = await StudentImport.exists({ _id: req.params.id });
    return exists ? fail(res, 409, "This import is being processed in another window.") : fail(res, 404, "Import not found.");
  }
  if (doc.status === "UNDOING") {
    await StudentImport.updateOne({ _id: doc._id }, { $set: { lockedUntil: new Date(0) } });
    return fail(res, 409, "This import is being undone.");
  }

  const deadline = Date.now() + 7 * 1000; // stay inside even a 10-second server time limit
  try {
    // 1) students
    let created = 0;
    for (const row of doc.rows) {
      if (row.state !== "PENDING" || created >= 4 || Date.now() > deadline) continue;
      row.attempts += 1;
      try {
        row.student = await createStudent(row, doc._id);
        row.state = "CREATED";
        row.error = "";
      } catch (e) {
        row.state = "FAILED";
        row.error = e.message;
      }
      created++;
    }

    // 2) photos (only for students that exist)
    let photos = 0;
    for (const row of doc.rows) {
      if (row.state !== "CREATED" || row.photoState !== "PENDING" || photos >= 2 || Date.now() > deadline) continue;
      try {
        const up = await copyDrivePhoto(row.photoUrl);
        await Student.updateOne({ _id: row.student }, { imageUrl: up.secure_url, imagePublicId: up.public_id });
        row.photoState = "DONE";
        row.photoError = "";
      } catch (e) {
        row.photoState = "FAILED";
        row.photoError = e.message || "Photo could not be copied.";
      }
      photos++;
    }

    const s = doc.summary();
    const stillWorking = s.pending > 0 || doc.rows.some((r) => r.state === "CREATED" && r.photoState === "PENDING");
    if (!stillWorking && doc.status !== "DONE") {
      doc.status = "DONE";
      await logAction(req, "STUDENT_IMPORT_FINISHED", doc._id, s);
    }
    doc.markModified("rows");
    doc.lockedUntil = new Date(0);
    await doc.save();
    res.json({ data: importView(doc), done: !stillWorking });
  } catch (e) {
    console.error("[studentImport] process:", e);
    await StudentImport.updateOne({ _id: doc._id }, { $set: { lockedUntil: new Date(0) } });
    fail(res, 500, "Processing stopped unexpectedly. Click Continue to resume.");
  }
};

// POST /api/student-import/:id/retry   (failed students and failed photos)
export const retryFailed = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid import id.");
  const doc = await StudentImport.findById(req.params.id);
  if (!doc) return fail(res, 404, "Import not found.");
  let n = 0;
  for (const row of doc.rows) {
    if (row.state === "FAILED") (row.state = "PENDING"), (row.error = ""), n++;
    if (row.photoState === "FAILED") (row.photoState = "PENDING"), (row.photoError = ""), n++;
  }
  if (n) doc.status = "PROCESSING";
  doc.markModified("rows");
  await doc.save();
  res.json({ data: importView(doc) });
};

// GET /api/student-import
export const listImports = async (req, res) => {
  const docs = await StudentImport.find().sort({ createdAt: -1 }).limit(20);
  res.json({ data: docs.map((d) => importView(d, { withRows: false })) });
};

// GET /api/student-import/:id
export const getImport = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid import id.");
  const doc = await StudentImport.findById(req.params.id);
  if (!doc) return fail(res, 404, "Import not found.");
  res.json({ data: importView(doc) });
};

// GET /api/student-import/:id/export   -> Excel with register numbers
export const exportImport = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid import id.");
  const doc = await StudentImport.findById(req.params.id);
  if (!doc) return fail(res, 404, "Import not found.");

  const label = (t) => ADMISSION_TYPES[t]?.label || t;
  const data = doc.rows.map((r, i) => ({
    "Sl No": i + 1,
    "Roll Number": r.rollNumber,
    "Register Number": r.registerNumber,
    "Student Name": r.name,
    Department: (r.department || "").toUpperCase(),
    "Admission Type": label(r.admissionType),
    Result: r.state === "CREATED" ? "Imported" : r.state === "FAILED" ? `Failed: ${r.error}` : "Pending",
    Photo: { DONE: "Copied", FAILED: `Failed: ${r.photoError}`, PENDING: "Pending", NONE: "No photo" }[r.photoState],
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 32 }, { wch: 11 }, { wch: 26 }, { wch: 30 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Register numbers");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  await logAction(req, "STUDENT_IMPORT_EXPORTED", doc._id);
  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="register_numbers_${doc._id}.xlsx"`,
    "Cache-Control": "no-store",
  });
  res.send(buf);
};

// ====================================================================
// Bulk photos: one request per photo, file named by roll/register number
// ====================================================================

// POST /api/student-import/photo   (multipart field "photo")
export const uploadStudentPhoto = async (req, res) => {
  try {
    if (!req.file) return fail(res, 400, "Choose a photo.");
    const base = req.file.originalname.replace(/\.[^.]+$/, "").trim().toUpperCase();
    if (!base) return fail(res, 400, "Name the photo by roll number or register number, e.g. AT26001.jpg");

    const matches = await Student.find({ $or: [{ rollNumber: base }, { registerNumber: base }] })
      .select("name rollNumber registerNumber imagePublicId")
      .limit(2);
    if (!matches.length) return fail(res, 404, `No student with roll / register number ${base}.`);
    if (matches.length > 1) return fail(res, 409, `More than one student matches ${base}. Use the register number as the file name.`);

    const student = matches[0];
    const up = await uploadPhotoBuffer(req.file.buffer);
    const old = student.imagePublicId;
    await Student.updateOne({ _id: student._id }, { imageUrl: up.secure_url, imagePublicId: up.public_id });
    if (old) cloudinary.uploader.destroy(old).catch(() => {});

    await StudentImport.updateMany(
      { "rows.student": student._id },
      { $set: { "rows.$[r].photoState": "DONE", "rows.$[r].photoError": "" } },
      { arrayFilters: [{ "r.student": student._id }] }
    );

    res.json({
      data: { name: student.name, registerNumber: student.registerNumber, rollNumber: student.rollNumber, imageUrl: up.secure_url },
    });
  } catch (e) {
    console.error("[studentImport] photo:", e);
    fail(res, 500, "Photo could not be uploaded. Please try again.");
  }
};

// ====================================================================
// Undo an import: delete its students, logins and photos, and give the
// register numbers back (only if nobody has taken later numbers since)
// ====================================================================

// POST /api/student-import/:id/undo   { confirm: "UNDO" }
// Called repeatedly by the page (like processing). Each call removes a few
// students; the last call frees the register numbers and deletes the import.
export const undoImport = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid import id.");
  if (req.body?.confirm !== "UNDO") return fail(res, 400, "Type UNDO to confirm.");

  const now = new Date();
  const doc = await StudentImport.findOneAndUpdate(
    { _id: req.params.id, lockedUntil: { $lt: now } },
    { $set: { lockedUntil: new Date(now.getTime() + 25 * 1000), status: "UNDOING" } },
    { returnDocument: "after" }
  );
  if (!doc) {
    const exists = await StudentImport.exists({ _id: req.params.id });
    return exists
      ? fail(res, 409, "This import is busy in another window. Try again in a few seconds.")
      : fail(res, 404, "Import not found – it may already be undone.");
  }

  const deadline = Date.now() + 7 * 1000; // fits a 10-second server limit
  const problems = [];
  for (const row of doc.rows) {
    if (Date.now() > deadline) break;
    if (row.state === "UNDONE") continue;
    try {
      if (row.student) {
        const st = await Student.findById(row.student).select("clerkId imagePublicId");
        if (st) {
          if (st.clerkId) await clerkClient.users.deleteUser(st.clerkId).catch(() => {});
          if (st.imagePublicId) cloudinary.uploader.destroy(st.imagePublicId).catch(() => {});
          await Student.deleteOne({ _id: st._id });
        }
        row.student = null;
      }
      row.state = "UNDONE";
    } catch (e) {
      problems.push(`${row.registerNumber}: ${e.message}`);
    }
  }

  const total = doc.rows.length;
  const removed = doc.rows.filter((r) => r.state === "UNDONE").length;

  if (removed < total) {
    doc.markModified("rows");
    doc.lockedUntil = new Date(0);
    await doc.save();
    return res.json({ done: false, removed, total, problems: problems.slice(0, 3) });
  }

  // Everything removed: give the register numbers back if nobody took later ones
  const released = [];
  for (const r of doc.reserved || []) {
    const out = await Counter.updateOne({ _id: r.key, seq: r.last }, { $set: { seq: r.first - 1 } });
    if (out.modifiedCount) released.push(r.key);
  }
  await logAction(req, "STUDENT_IMPORT_UNDONE", doc._id, { removed: total, released, fileName: doc.fileName });
  await StudentImport.deleteOne({ _id: doc._id });
  res.json({ done: true, removed, total, numbersReleased: released.length === (doc.reserved || []).length });
};
