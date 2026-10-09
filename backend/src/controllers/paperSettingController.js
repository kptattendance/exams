// src/controllers/paperSettingController.js
//
// QUESTION PAPER SETTING — secure Word upload
//
//  COE / Exam Officer                       Faculty (examiner)
//  ------------------                       ------------------
//  create assignment  ── email link ──▶     sign in (Clerk)
//                                           upload .docx  (validated, encrypted,
//                                                          stored in Google Drive)
//                                           preview, replace, final submit
//  view status        ◀── SUBMITTED ──      (faculty loses access after submit)
//  download (COE only, logged) / return for correction / cancel

import mongoose from "mongoose";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";

import PaperSetting from "../models/PaperSetting.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import AuditLog, { audit } from "../models/AuditLog.js";

import { encryptPaper, decryptPaper } from "../services/paperCrypto.js";
import { validateDocx, DocxError } from "../services/docxValidator.js";
import {
  uploadEncrypted,
  downloadEncrypted,
  deleteEncrypted,
} from "../services/driveStorage.js";
import { sendPaperSettingEmail } from "../services/mailer.js";

const isId = (id) => mongoose.Types.ObjectId.isValid(id);

const fail = (res, status, error) => res.status(status).json({ error });

const handleError = (res, err, where) => {
  if (err instanceof DocxError) return fail(res, 400, err.message);
  if (err?.code === 11000) {
    return fail(res, 409, "This set is already assigned for this subject and session.");
  }
  console.error(`[paperSetting] ${where}:`, err);
  return fail(res, 500, "Something went wrong. Please try again.");
};

const POPULATE = [
  { path: "subject", select: "code subjectId name semester department" },
  { path: "examiner", select: "name email department phone" },
];

// ======================================================================
// COE / EXAM OFFICER
// ======================================================================

// GET /api/paper-setting/examiners?department=cs
export const listExaminers = async (req, res) => {
  try {
    const filter = { role: { $in: ["staff", "hod"] } };
    if (req.query.department) filter.department = String(req.query.department).toLowerCase();
    const users = await User.find(filter)
      .select("name email department role clerkId")
      .sort({ department: 1, name: 1 })
      .lean();
    res.json({ data: users });
  } catch (err) {
    handleError(res, err, "listExaminers");
  }
};

// POST /api/paper-setting
export const createAssignment = async (req, res) => {
  try {
    const {
      subjectId,
      examSession,
      setNo,
      paperType = "THEORY",
      examinerId,
      examinerType = "INTERNAL",
      deadline,
      instructions = "",
      sendEmail = true,
    } = req.body;

    if (!isId(subjectId) || !isId(examinerId)) return fail(res, 400, "Subject and examiner are required.");
    if (!examSession?.trim()) return fail(res, 400, "Exam session is required (e.g. NOV-2026).");

    const due = new Date(deadline);
    if (Number.isNaN(due.getTime()) || due <= new Date()) {
      return fail(res, 400, "Deadline must be a future date.");
    }

    const [subject, examiner] = await Promise.all([
      Subject.findById(subjectId).lean(),
      User.findById(examinerId).lean(),
    ]);
    if (!subject) return fail(res, 404, "Subject not found.");
    if (!examiner) return fail(res, 404, "Examiner not found.");

    const paper = await PaperSetting.create({
      subject: subject._id,
      examSession: examSession.trim(),
      setNo: Number(setNo) || 1,
      paperType,
      examiner: examiner._id,
      examinerClerkId: examiner.clerkId,
      examinerType,
      deadline: due,
      instructions,
      assignedBy: req.user.id,
    });

    await audit(req, "PAPER_ASSIGNED", paper._id, {
      subject: subject.code,
      examSession: paper.examSession,
      setNo: paper.setNo,
      examiner: examiner.email,
    });

    let emailSent = false;
    if (sendEmail) {
      emailSent = await trySendEmail(req, paper, subject, examiner, false);
    }

    const populated = await PaperSetting.findById(paper._id).populate(POPULATE);
    res.status(201).json({ data: populated, emailSent });
  } catch (err) {
    handleError(res, err, "createAssignment");
  }
};

async function trySendEmail(req, paper, subject, examiner, isReminder) {
  try {
    const sent = await sendPaperSettingEmail({
      to: examiner.email,
      name: examiner.name,
      subject,
      paper,
      isReminder,
    });
    if (sent) {
      await PaperSetting.updateOne(
        { _id: paper._id },
        { $set: { emailSentAt: new Date() }, $inc: { emailCount: 1 } }
      );
      await audit(req, isReminder ? "EMAIL_REMINDER_SENT" : "EMAIL_SENT", paper._id, { to: examiner.email });
    }
    return sent;
  } catch (e) {
    console.error("Email failed:", e.message);
    return false;
  }
}

// GET /api/paper-setting?examSession=NOV-2026&status=SUBMITTED
export const listAssignments = async (req, res) => {
  try {
    const filter = {};
    if (req.query.examSession) filter.examSession = String(req.query.examSession).toUpperCase();
    if (req.query.status) filter.status = String(req.query.status).toUpperCase();

    const papers = await PaperSetting.find(filter).populate(POPULATE).sort({ createdAt: -1 });

    let data = papers.map((p) => p.toJSON());
    if (req.query.department) {
      const d = String(req.query.department).toUpperCase();
      data = data.filter((p) => p.subject?.department === d);
    }
    res.json({ data });
  } catch (err) {
    handleError(res, err, "listAssignments");
  }
};

// POST /api/paper-setting/:id/send-email
export const resendEmail = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findById(req.params.id);
    if (!paper) return fail(res, 404, "Not found.");
    if (["SUBMITTED", "CANCELLED"].includes(paper.status)) {
      return fail(res, 400, `Paper is ${paper.status.toLowerCase()}; no email needed.`);
    }
    const [subject, examiner] = await Promise.all([
      Subject.findById(paper.subject).lean(),
      User.findById(paper.examiner).lean(),
    ]);
    const sent = await trySendEmail(req, paper, subject, examiner, paper.emailCount > 0);
    if (!sent) return fail(res, 502, "Email could not be sent. Check SMTP settings.");
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, "resendEmail");
  }
};

// PATCH /api/paper-setting/:id   { deadline?, instructions?, examinerId? }
export const updateAssignment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findById(req.params.id);
    if (!paper) return fail(res, 404, "Not found.");
    if (["SUBMITTED", "CANCELLED"].includes(paper.status)) {
      return fail(res, 400, "A submitted or cancelled paper cannot be edited.");
    }

    const changes = {};
    if (req.body.deadline) {
      const due = new Date(req.body.deadline);
      if (Number.isNaN(due.getTime())) return fail(res, 400, "Invalid deadline.");
      changes.deadline = { from: paper.deadline, to: due };
      paper.deadline = due;
    }
    if (typeof req.body.instructions === "string") {
      paper.instructions = req.body.instructions;
      changes.instructions = true;
    }
    if (req.body.examinerId) {
      // Re-assigning is allowed only before anything is uploaded
      if (paper.status !== "ASSIGNED") {
        return fail(res, 400, "Examiner can be changed only before an upload. Cancel and create a new assignment instead.");
      }
      const ex = await User.findById(req.body.examinerId).lean();
      if (!ex) return fail(res, 404, "Examiner not found.");
      changes.examiner = { from: String(paper.examiner), to: String(ex._id) };
      paper.examiner = ex._id;
      paper.examinerClerkId = ex.clerkId;
      paper.emailSentAt = null;
      paper.emailCount = 0;
    }
    await paper.save();
    await audit(req, "PAPER_UPDATED", paper._id, changes);
    res.json({ data: await PaperSetting.findById(paper._id).populate(POPULATE) });
  } catch (err) {
    handleError(res, err, "updateAssignment");
  }
};

// POST /api/paper-setting/:id/return   { remarks }
export const returnForCorrection = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const remarks = String(req.body.remarks || "").trim();
    if (!remarks) return fail(res, 400, "Please enter remarks for the examiner.");

    const paper = await PaperSetting.findOneAndUpdate(
      { _id: req.params.id, status: "SUBMITTED" },
      { $set: { status: "RETURNED", returnedAt: new Date(), returnRemarks: remarks } },
      { returnDocument: "after" }
    );
    if (!paper) return fail(res, 400, "Only a submitted paper can be returned.");
    await audit(req, "PAPER_RETURNED", paper._id, { remarks });
    res.json({ data: paper });
  } catch (err) {
    handleError(res, err, "returnForCorrection");
  }
};

// POST /api/paper-setting/:id/cancel
export const cancelAssignment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "CANCELLED" } },
      { $set: { status: "CANCELLED" } },
      { returnDocument: "after" }
    );
    if (!paper) return fail(res, 404, "Not found or already cancelled.");
    await audit(req, "PAPER_CANCELLED", paper._id, { reason: req.body?.reason || "" });
    res.json({ data: paper });
  } catch (err) {
    handleError(res, err, "cancelAssignment");
  }
};

// GET /api/paper-setting/:id/download   (COE only, every download logged)
export const downloadPaper = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findById(req.params.id).populate(POPULATE[0]);
    if (!paper?.currentFile) return fail(res, 404, "No file uploaded.");
    if (paper.status !== "SUBMITTED") {
      return fail(res, 400, "The paper can be downloaded only after the examiner submits it.");
    }

    const plain = await getDecryptedFile(paper);
    await audit(req, "PAPER_DOWNLOADED", paper._id, { sha256: paper.currentFile.sha256 });

    // Neutral file name: no examiner name
    const name = `${paper.subject.code}_${paper.examSession}_SET${paper.setNo}.docx`.replace(/[^\w.-]/g, "_");
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.send(plain);
  } catch (err) {
    handleError(res, err, "downloadPaper");
  }
};

// GET /api/paper-setting/:id/audit   (COE only)
export const getAuditTrail = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const logs = await AuditLog.find({ entityId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    res.json({ data: logs });
  } catch (err) {
    handleError(res, err, "getAuditTrail");
  }
};

// ======================================================================
// FACULTY (examiner) — can only ever touch papers assigned to them
// ======================================================================

const FACULTY_EDITABLE = ["ASSIGNED", "UPLOADED", "RETURNED"];

async function loadOwnPaper(req, res) {
  if (!isId(req.params.id)) {
    fail(res, 400, "Invalid id.");
    return null;
  }
  const paper = await PaperSetting.findOne({
    _id: req.params.id,
    examinerClerkId: req.user.id, // ownership check
    status: { $ne: "CANCELLED" },
  }).populate(POPULATE[0]);

  if (!paper) {
    // Same message whether it doesn't exist or belongs to someone else
    fail(res, 404, "Paper setting request not found.");
    return null;
  }
  return paper;
}

const facultyView = (p) => {
  const j = p.toJSON();
  return {
    _id: j._id,
    subject: j.subject,
    examSession: j.examSession,
    setNo: j.setNo,
    paperType: j.paperType,
    instructions: j.instructions,
    deadline: j.deadline,
    status: j.status,
    returnRemarks: j.status === "RETURNED" ? j.returnRemarks : "",
    submittedAt: j.submittedAt,
    // After submission the examiner sees only that a file was submitted
    currentFile: j.currentFile
      ? { originalName: j.currentFile.originalName, size: j.currentFile.size, uploadedAt: j.currentFile.uploadedAt }
      : null,
    isPastDeadline: new Date() > new Date(j.deadline),
  };
};

// GET /api/paper-setting/my
export const myAssignments = async (req, res) => {
  try {
    const papers = await PaperSetting.find({
      examinerClerkId: req.user.id,
      status: { $ne: "CANCELLED" },
    })
      .populate(POPULATE[0])
      .sort({ deadline: 1 });
    res.json({ data: papers.map(facultyView) });
  } catch (err) {
    handleError(res, err, "myAssignments");
  }
};

// GET /api/paper-setting/my/:id
export const myAssignment = async (req, res) => {
  try {
    const paper = await loadOwnPaper(req, res);
    if (!paper) return;
    await audit(req, "PAPER_VIEWED_BY_EXAMINER", paper._id);
    res.json({ data: facultyView(paper) });
  } catch (err) {
    handleError(res, err, "myAssignment");
  }
};

// POST /api/paper-setting/my/:id/upload   (multipart, field "file")
export const uploadPaper = async (req, res) => {
  let driveFileId = null;
  try {
    const paper = await loadOwnPaper(req, res);
    if (!paper) return;

    if (!FACULTY_EDITABLE.includes(paper.status)) {
      return fail(res, 400, "This paper is already submitted and locked.");
    }
    if (new Date() > paper.deadline) {
      return fail(res, 400, "The deadline has passed. Please contact the COE office to extend it.");
    }
    if (!req.file) return fail(res, 400, "Please choose a .docx file.");

    const buf = req.file.buffer;
    const { warnings } = validateDocx(buf, req.file.originalname);

    // Make sure Word can actually be read, and build the preview
    const preview = await buildPreview(buf);

    const { ciphertext, meta } = encryptPaper(buf, paper._id);
    buf.fill(0); // wipe plaintext from memory as soon as possible
    driveFileId = await uploadEncrypted(ciphertext);

    const fileRecord = {
      driveFileId,
      ...meta,
      originalName: req.file.originalname.slice(0, 200),
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
    };

    // Conditional update: status must still be editable (prevents races
    // with a submit happening in another tab)
    const update = { $set: { currentFile: fileRecord, status: "UPLOADED" } };
    if (paper.currentFile) update.$push = { fileHistory: paper.currentFile.toObject() };

    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, examinerClerkId: req.user.id, status: { $in: FACULTY_EDITABLE } },
      update,
      { returnDocument: "after" }
    ).populate(POPULATE[0]);

    if (!saved) {
      await deleteEncrypted(driveFileId);
      return fail(res, 409, "Paper status changed. Please refresh the page.");
    }

    await audit(req, "PAPER_UPLOADED", paper._id, {
      sha256: meta.sha256,
      size: meta.size,
      replaced: Boolean(paper.currentFile),
    });

    res.json({ data: facultyView(saved), preview, warnings: [...warnings, ...preview.warnings] });
  } catch (err) {
    if (driveFileId && !(err instanceof DocxError)) await deleteEncrypted(driveFileId);
    handleError(res, err, "uploadPaper");
  }
};

// GET /api/paper-setting/my/:id/preview   (only before final submit)
export const previewMyPaper = async (req, res) => {
  try {
    const paper = await loadOwnPaper(req, res);
    if (!paper) return;
    if (!paper.currentFile) return fail(res, 404, "Nothing uploaded yet.");
    if (!["UPLOADED", "RETURNED"].includes(paper.status)) {
      return fail(res, 403, "Preview is not available after submission.");
    }
    const plain = await getDecryptedFile(paper);
    const preview = await buildPreview(plain);
    plain.fill(0);
    res.set("Cache-Control", "no-store");
    res.json({ preview });
  } catch (err) {
    handleError(res, err, "previewMyPaper");
  }
};

// POST /api/paper-setting/my/:id/submit   { confirm: true }
export const submitMyPaper = async (req, res) => {
  try {
    if (req.body?.confirm !== true) {
      return fail(res, 400, "Please confirm that this is the final paper.");
    }
    const paper = await loadOwnPaper(req, res);
    if (!paper) return;
    if (!paper.currentFile) return fail(res, 400, "Upload the paper before submitting.");
    if (new Date() > paper.deadline) {
      return fail(res, 400, "The deadline has passed. Please contact the COE office.");
    }

    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, examinerClerkId: req.user.id, status: { $in: ["UPLOADED", "RETURNED"] } },
      { $set: { status: "SUBMITTED", submittedAt: new Date() } },
      { returnDocument: "after" }
    ).populate(POPULATE[0]);

    if (!saved) return fail(res, 400, "This paper cannot be submitted in its current state.");
    await audit(req, "PAPER_SUBMITTED", paper._id, { sha256: paper.currentFile.sha256 });
    res.json({ data: facultyView(saved) });
  } catch (err) {
    handleError(res, err, "submitMyPaper");
  }
};

// ======================================================================
// helpers
// ======================================================================

async function getDecryptedFile(paper) {
  const f = paper.currentFile;
  const encrypted = await downloadEncrypted(f.driveFileId);
  return decryptPaper(encrypted, f, paper._id); // throws if tampered
}

async function buildPreview(buffer) {
  let result;
  try {
    result = await mammoth.convertToHtml({ buffer });
  } catch {
    throw new DocxError("Word file could not be read. Open it in Word, save again as .docx and retry.");
  }

  const html = sanitizeHtml(result.value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "sub", "sup", "u", "s"]),
    allowedAttributes: { img: ["src", "alt"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: [],
    allowedSchemesByTag: { img: ["data"] },
  });

  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const warnings = [];
  if (text.length < 50) warnings.push("Very little text was found. Is this the correct file?");
  if (/<img/i.test(html) === false && /figure|diagram|sketch/i.test(text)) {
    warnings.push("Questions mention a figure/diagram but no image was found in the file.");
  }

  return {
    html,
    wordCount: text ? text.split(" ").length : 0,
    imageCount: (html.match(/<img/gi) || []).length,
    warnings,
  };
}
