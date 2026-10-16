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
import { cleanHtml } from "../services/cleanHtml.js";

import PaperSetting from "../models/PaperSetting.js";
import Subject from "../models/Subject.js";
import User, { HOME_COLLEGE, collegeOf } from "../models/User.js";
import AuditLog, { audit } from "../models/AuditLog.js";

import { encryptPaper, decryptPaper } from "../services/paperCrypto.js";
import { validateDocx, DocxError } from "../services/docxValidator.js";
import {
  uploadEncrypted,
  downloadEncrypted,
  deleteEncrypted,
  createScrutinyDoc,
  shareForEditing,
  exportAsDocx,
  scrutinyDocUrl,
} from "../services/driveStorage.js";
import { changeRecord } from "../services/textDiff.js";
import { sendPaperSettingEmail, sendSchemeRequestEmail } from "../services/mailer.js";
import { syllabusAttachments } from "./syllabusController.js";

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
  { path: "examiner", select: "name email department designation phone collegeCode collegeName" },
];

// ======================================================================
// COE / EXAM OFFICER
// ======================================================================

// GET /api/paper-setting/examiners?type=INTERNAL|EXTERNAL&department=cs
//   INTERNAL = our own faculty (college 103), EXTERNAL = any other college
export const listExaminers = async (req, res) => {
  try {
    const filter = { role: { $in: ["staff", "guest_lecturer", "hod"] } };
    if (req.query.department) filter.department = String(req.query.department).toLowerCase();
    const home = { $in: ["", null, HOME_COLLEGE.code] };
    if (req.query.type === "INTERNAL") filter.collegeCode = home;
    else if (req.query.type === "EXTERNAL") filter.collegeCode = { $nin: ["", null, HOME_COLLEGE.code] };
    const users = await User.find(filter)
      .select("name email department designation role clerkId collegeCode collegeName")
      .sort({ department: 1, name: 1 })
      .lean();
    res.json({ data: users.map((u) => ({ ...u, college: collegeOf(u) })) });
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

    // A cancelled assignment must not block the same set from being given again
    const slot = { subject: subject._id, examSession: examSession.trim().toUpperCase(), paperType, setNo: Number(setNo) || 1 };
    for (const old of await PaperSetting.find({ ...slot, status: "CANCELLED" })) {
      await removePaper(old);
      await audit(req, "CANCELLED_REPLACED", old._id, { subject: subject.code, setNo: old.setNo });
    }

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

    let mail = { sent: false, attached: 0 };
    if (sendEmail) {
      mail = await trySendEmail(req, paper, subject, examiner, false);
    }

    const populated = await PaperSetting.findById(paper._id).populate(POPULATE);
    res.status(201).json({ data: populated, emailSent: mail.sent, syllabusAttached: mail.attached });
  } catch (err) {
    handleError(res, err, "createAssignment");
  }
};

// -> { sent, attached }  attached = number of syllabus / scheme PDFs sent along
async function trySendEmail(req, paper, subject, examiner, isReminder) {
  try {
    const attachments = await syllabusAttachments(subject.code).catch(() => []);
    const sent = await sendPaperSettingEmail({
      to: examiner.email,
      name: examiner.name,
      subject,
      paper,
      isReminder,
      attachments,
    });
    if (sent) {
      await PaperSetting.updateOne(
        { _id: paper._id },
        { $set: { emailSentAt: new Date() }, $inc: { emailCount: 1 } }
      );
      await audit(req, isReminder ? "EMAIL_REMINDER_SENT" : "EMAIL_SENT", paper._id, {
        to: examiner.email,
        attached: attachments.map((a) => a.filename),
      });
    }
    return { sent, attached: sent ? attachments.length : 0 };
  } catch (e) {
    console.error("Email failed:", e.message);
    return { sent: false, attached: 0 };
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

// ---------------------------------------------------------------- office orders
//
// The printed appointment order (ಅಧಿಕೃತ ಜ್ಞಾಪನ) that the office posts to the
// paper setter. Only who / which subject / last date – never the paper itself.

const orderView = (p) => ({
  _id: p._id,
  examSession: p.examSession,
  setNo: p.setNo,
  paperType: p.paperType,
  deadline: p.deadline,
  assignedAt: p.createdAt,
  examinerType: p.examinerType,
  subject: p.subject && { code: p.subject.code, name: p.subject.name, semester: p.subject.semester, department: p.subject.department },
  examiner: p.examiner && {
    name: p.examiner.name,
    department: p.examiner.department,
    designation: p.examiner.designation || "",
    email: p.examiner.email,
    phone: p.examiner.phone,
    college: collegeOf(p.examiner),
  },
});

// GET /api/paper-setting/orders?examSession=NOV-2026
export const listOrders = async (req, res) => {
  try {
    const filter = { status: { $ne: "CANCELLED" } };
    if (req.query.examSession) filter.examSession = String(req.query.examSession).toUpperCase();
    const papers = await PaperSetting.find(filter).populate(POPULATE).sort({ createdAt: -1 }).lean();
    res.json({ data: papers.map(orderView) });
  } catch (err) {
    handleError(res, err, "listOrders");
  }
};

// GET /api/paper-setting/:id/order
export const getOrder = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findById(req.params.id).populate(POPULATE).lean();
    if (!paper) return fail(res, 404, "Not found.");
    if (paper.status === "CANCELLED") return fail(res, 400, "This assignment is cancelled.");
    res.json({ data: orderView(paper) });
  } catch (err) {
    handleError(res, err, "getOrder");
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
    const mail = await trySendEmail(req, paper, subject, examiner, paper.emailCount > 0);
    if (!mail.sent) return fail(res, 502, "Email could not be sent. Check SMTP settings.");
    res.json({ ok: true, syllabusAttached: mail.attached });
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

// Deletes the record and its encrypted files in Drive
async function removePaper(paper) {
  for (const f of [paper.currentFile, paper.schemeFile, paper.scrutiny?.file, ...(paper.fileHistory || [])]) {
    if (f?.driveFileId) await deleteEncrypted(f.driveFileId);
  }
  if (paper.scrutiny?.docId) await deleteEncrypted(paper.scrutiny.docId);
  await PaperSetting.deleteOne({ _id: paper._id });
}

// DELETE /api/paper-setting/:id   – any assignment; its files are removed from Drive
export const deleteAssignment = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findById(req.params.id).populate("subject", "code");
    if (!paper) return fail(res, 404, "Not found.");
    await removePaper(paper);
    await audit(req, "PAPER_DELETED", paper._id, {
      subject: paper.subject?.code,
      examSession: paper.examSession,
      setNo: paper.setNo,
      status: paper.status,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err, "deleteAssignment");
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

// GET /api/paper-setting/:id/download[?kind=scheme]   (COE only, every download logged)
export const downloadPaper = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const kind = fileKind(req);
    const scheme = kind === "schemeFile";
    const paper = await PaperSetting.findById(req.params.id).populate(POPULATE[0]);
    if (!paper?.[kind]) return fail(res, 404, "No file uploaded.");
    if (paper.status !== "SUBMITTED") {
      return fail(res, 400, "The paper can be downloaded only after the examiner submits it.");
    }
    // The question paper is released to the COE only after scrutiny, in its scrutinised form
    if (!scheme && paper.scrutiny?.status !== "DONE") {
      return fail(res, 400, "The paper can be downloaded after the scrutiniser finishes scrutiny.");
    }
    if (scheme && !schemeReady(paper)) return fail(res, 400, "The setter has not submitted the scheme yet.");
    const file = scheme ? paper.schemeFile : paper.scrutiny.file;

    const plain = await getDecryptedFile(paper, file);
    await audit(req, scheme ? "SCHEME_DOWNLOADED" : "PAPER_DOWNLOADED", paper._id, { sha256: file.sha256 });

    // Neutral file name: no examiner name
    const name = `${paper.subject.code}_${paper.examSession}_SET${paper.setNo}${scheme ? "_SCHEME" : ""}.docx`.replace(/[^\w.-]/g, "_");
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

const brief = (f) => (f ? { originalName: f.originalName, size: f.size, uploadedAt: f.uploadedAt } : null);

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
    currentFile: brief(j.currentFile),
    schemeFile: brief(j.schemeFile),
    schemeRequested: Boolean(j.schemeRequested),
    schemeSubmittedAt: j.schemeSubmittedAt || null,
    // What the scrutiniser changed (text only, never the file)
    scrutiny:
      j.scrutiny?.status === "DONE"
        ? { doneAt: j.scrutiny.doneAt, note: j.scrutiny.note, changes: j.scrutiny.changes, added: j.scrutiny.added, removed: j.scrutiny.removed }
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

// POST /api/paper-setting/my/:id/upload           question paper
// POST /api/paper-setting/my/:id/upload/scheme    scheme of valuation
// (multipart, field "file"). A new upload replaces the draft and the old file
// is deleted from Drive.
export const uploadPaper = async (req, res) => {
  let driveFileId = null;
  const kind = fileKind(req);
  try {
    const paper = await loadOwnPaper(req, res);
    if (!paper) return;

    const scheme = kind === "schemeFile";
    // After the paper is submitted only a scheme the COE asked for can still be uploaded
    const lateScheme = scheme && paper.status === "SUBMITTED" && paper.schemeRequested && !paper.schemeSubmittedAt;
    if (scheme && !paper.schemeRequested) {
      return fail(res, 400, "The COE has not asked for the scheme of valuation.");
    }
    if (!FACULTY_EDITABLE.includes(paper.status) && !lateScheme) {
      return fail(res, 400, scheme ? "The scheme is already submitted." : "This paper is already submitted and locked.");
    }
    if (!lateScheme && new Date() > paper.deadline) {
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
    const update = lateScheme ? { $set: { [kind]: fileRecord } } : { $set: { [kind]: fileRecord, status: "UPLOADED" } };
    const still = lateScheme
      ? { status: "SUBMITTED", schemeSubmittedAt: null }
      : { status: { $in: FACULTY_EDITABLE } };

    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, examinerClerkId: req.user.id, ...still },
      update,
      { returnDocument: "after" }
    ).populate(POPULATE[0]);

    if (!saved) {
      await deleteEncrypted(driveFileId);
      return fail(res, 409, "Paper status changed. Please refresh the page.");
    }

    // The replaced draft is not kept
    if (paper[kind]?.driveFileId) await deleteEncrypted(paper[kind].driveFileId);
    await audit(req, kind === "schemeFile" ? "SCHEME_UPLOADED" : "PAPER_UPLOADED", paper._id, {
      sha256: meta.sha256,
      size: meta.size,
      replaced: Boolean(paper[kind]),
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
    const kind = fileKind(req);
    if (!paper[kind]) return fail(res, 404, "Nothing uploaded yet.");
    const lateScheme = kind === "schemeFile" && paper.status === "SUBMITTED" && !paper.schemeSubmittedAt;
    if (!["UPLOADED", "RETURNED"].includes(paper.status) && !lateScheme) {
      return fail(res, 403, "Preview is not available after submission.");
    }
    const plain = await getDecryptedFile(paper, kind);
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
    if (paper.schemeRequested && !paper.schemeFile) {
      return fail(res, 400, "The COE asked for the scheme of valuation. Upload it before submitting.");
    }
    if (new Date() > paper.deadline) {
      return fail(res, 400, "The deadline has passed. Please contact the COE office.");
    }

    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, examinerClerkId: req.user.id, status: { $in: ["UPLOADED", "RETURNED"] } },
      { $set: { status: "SUBMITTED", submittedAt: new Date(), ...(paper.schemeFile ? { schemeSubmittedAt: new Date() } : {}) } },
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

// ?kind=scheme (or /upload/scheme) -> the scheme of valuation, otherwise the question paper
function fileKind(req) {
  return req.query?.kind === "scheme" || req.params?.kind === "scheme" ? "schemeFile" : "currentFile";
}

// kind: "currentFile" / "schemeFile", or the file record itself
async function getDecryptedFile(paper, kind = "currentFile") {
  const f = typeof kind === "string" ? paper[kind] : kind;
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

   const html = cleanHtml(result.value);

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

// ======================================================================
// SCRUTINY — QP scrutiniser only. The setter's name is never shown here.
// ======================================================================

// A scheme counts once it is submitted (older papers: uploaded with the paper)
const schemeReady = (p) => Boolean(p.schemeFile && (p.schemeSubmittedAt || !p.schemeRequested));

const scrutinyView = (p) => ({
  _id: p._id,
  subject: p.subject && { code: p.subject.code, name: p.subject.name, semester: p.subject.semester, department: p.subject.department },
  examSession: p.examSession,
  setNo: p.setNo,
  paperType: p.paperType,
  submittedAt: p.submittedAt,
  hasScheme: schemeReady(p),
  scrutiny: {
    status: p.scrutiny?.status || "PENDING",
    startedAt: p.scrutiny?.startedAt || null,
    doneAt: p.scrutiny?.doneAt || null,
    note: p.scrutiny?.note || "",
    added: p.scrutiny?.added || 0,
    removed: p.scrutiny?.removed || 0,
    changes: p.scrutiny?.changes || [],
    editUrl: p.scrutiny?.docId ? scrutinyDocUrl(p.scrutiny.docId) : "",
  },
});

async function loadForScrutiny(req, res) {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid id."), null;
  const paper = await PaperSetting.findOne({ _id: req.params.id, status: "SUBMITTED" }).populate(POPULATE[0]);
  if (!paper) return fail(res, 404, "Submitted paper not found."), null;
  return paper;
}

const textOf = async (buffer) => (await mammoth.extractRawText({ buffer })).value;

// GET /api/paper-setting/scrutiny?examSession=NOV-2026
export const listForScrutiny = async (req, res) => {
  try {
    const filter = { status: "SUBMITTED" };
    if (req.query.examSession) filter.examSession = String(req.query.examSession).toUpperCase();
    const papers = await PaperSetting.find(filter).populate(POPULATE[0]).sort({ submittedAt: 1 }).lean();
    res.json({ data: papers.map(scrutinyView) });
  } catch (err) {
    handleError(res, err, "listForScrutiny");
  }
};

// GET /api/paper-setting/:id/scrutiny/scheme   – the scheme, to read on screen
export const scrutinyScheme = async (req, res) => {
  try {
    const paper = await loadForScrutiny(req, res);
    if (!paper) return;
    if (!schemeReady(paper)) return fail(res, 404, "The setter has not submitted a scheme.");
    const plain = await getDecryptedFile(paper, "schemeFile");
    const preview = await buildPreview(plain);
    plain.fill(0);
    res.set("Cache-Control", "no-store");
    res.json({ preview });
  } catch (err) {
    handleError(res, err, "scrutinyScheme");
  }
};

// POST /api/paper-setting/:id/scrutiny/start
// Opens the paper (or the earlier scrutinised version) as a Google Doc that
// only the signed-in scrutiniser's Google account can edit.
export const startScrutiny = async (req, res) => {
  let docId = null;
  try {
    const paper = await loadForScrutiny(req, res);
    if (!paper) return;
    if (paper.scrutiny?.status === "IN_PROGRESS" && paper.scrutiny.docId) {
      return res.json({ data: scrutinyView(paper), url: scrutinyDocUrl(paper.scrutiny.docId) });
    }
    const source = paper.scrutiny?.file || paper.currentFile;
    const plain = await getDecryptedFile(paper, source);
    docId = await createScrutinyDoc(plain, `${paper.subject.code} ${paper.examSession} Set ${paper.setNo} – scrutiny`);
    plain.fill(0);
    try {
      await shareForEditing(docId, req.user.email);
    } catch (e) {
      console.error("Scrutiny share failed:", e.message);
      await deleteEncrypted(docId);
      return fail(res, 400, `Google could not share the document with ${req.user.email}. Sign in to this website with a Google (Gmail) account.`);
    }
    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, "scrutiny.status": { $ne: "IN_PROGRESS" } },
      {
        $set: {
          "scrutiny.status": "IN_PROGRESS",
          "scrutiny.docId": docId,
          "scrutiny.startedAt": new Date(),
          "scrutiny.startedBy": req.user.email || req.user.id,
        },
      },
      { returnDocument: "after" }
    ).populate(POPULATE[0]);
    if (!saved) {
      await deleteEncrypted(docId);
      return fail(res, 409, "Scrutiny was just started in another window. Refresh the page.");
    }
    await audit(req, "SCRUTINY_STARTED", paper._id, { again: Boolean(paper.scrutiny?.file) });
    res.json({ data: scrutinyView(saved), url: scrutinyDocUrl(docId) });
  } catch (err) {
    if (docId) await deleteEncrypted(docId);
    handleError(res, err, "startScrutiny");
  }
};

// POST /api/paper-setting/:id/scrutiny/finish   { note }
// The Google Doc becomes the final Word paper (encrypted); the setter is shown
// the note and the changed lines; the Doc is deleted.
export const finishScrutiny = async (req, res) => {
  try {
    const paper = await loadForScrutiny(req, res);
    if (!paper) return;
    if (paper.scrutiny?.status !== "IN_PROGRESS" || !paper.scrutiny.docId) return fail(res, 400, "Start the scrutiny first.");
    const note = String(req.body?.note || "").trim().slice(0, 4000);

    const edited = await exportAsDocx(paper.scrutiny.docId);
    const original = await getDecryptedFile(paper, "currentFile");
    const record = changeRecord(await textOf(original), await textOf(edited));
    original.fill(0);

    const { ciphertext, meta } = encryptPaper(edited, paper._id);
    edited.fill(0);
    const driveFileId = await uploadEncrypted(ciphertext);
    const file = {
      driveFileId,
      ...meta,
      originalName: `${paper.subject.code}_${paper.examSession}_SET${paper.setNo}_scrutinised.docx`,
      uploadedBy: req.user.id,
      uploadedAt: new Date(),
    };
    const oldFile = paper.scrutiny.file?.driveFileId;
    const docId = paper.scrutiny.docId;

    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, "scrutiny.status": "IN_PROGRESS", "scrutiny.docId": docId },
      {
        $set: {
          "scrutiny.status": "DONE",
          "scrutiny.docId": "",
          "scrutiny.doneAt": new Date(),
          "scrutiny.doneBy": req.user.email || req.user.id,
          "scrutiny.note": note,
          "scrutiny.changes": record.changes.slice(0, 500),
          "scrutiny.added": record.added,
          "scrutiny.removed": record.removed,
          "scrutiny.file": file,
        },
      },
      { returnDocument: "after" }
    ).populate(POPULATE[0]);
    if (!saved) {
      await deleteEncrypted(driveFileId);
      return fail(res, 409, "Scrutiny changed in another window. Refresh the page.");
    }
    if (oldFile) await deleteEncrypted(oldFile);
    await deleteEncrypted(docId);
    await audit(req, "SCRUTINY_DONE", paper._id, { added: record.added, removed: record.removed, sha256: meta.sha256 });
    res.json({ data: scrutinyView(saved) });
  } catch (err) {
    handleError(res, err, "finishScrutiny");
  }
};

// POST /api/paper-setting/:id/scrutiny/cancel   – discard the Google Doc, keep what was there before
export const cancelScrutiny = async (req, res) => {
  try {
    const paper = await loadForScrutiny(req, res);
    if (!paper) return;
    if (paper.scrutiny?.status !== "IN_PROGRESS") return fail(res, 400, "Scrutiny is not open.");
    const docId = paper.scrutiny.docId;
    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, "scrutiny.status": "IN_PROGRESS" },
      { $set: { "scrutiny.status": paper.scrutiny.file ? "DONE" : "PENDING", "scrutiny.docId": "" } },
      { returnDocument: "after" }
    ).populate(POPULATE[0]);
    if (docId) await deleteEncrypted(docId);
    await audit(req, "SCRUTINY_CANCELLED", paper._id);
    res.json({ data: scrutinyView(saved) });
  } catch (err) {
    handleError(res, err, "cancelScrutiny");
  }
};

// ======================================================================
// SCHEME OF VALUATION on request
// ======================================================================

// POST /api/paper-setting/:id/request-scheme   (COE) – asks the setter for the scheme
export const requestScheme = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 400, "Invalid id.");
    const paper = await PaperSetting.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: "CANCELLED" }, schemeRequested: { $ne: true } },
      { $set: { schemeRequested: true, schemeRequestedAt: new Date() } },
      { returnDocument: "after" }
    ).populate(POPULATE);
    if (!paper) return fail(res, 400, "The scheme is already asked for, or the assignment is cancelled.");
    await audit(req, "SCHEME_REQUESTED", paper._id, { subject: paper.subject?.code });
    let emailed = false;
    try {
      emailed = await sendSchemeRequestEmail({ to: paper.examiner?.email, name: paper.examiner?.name, subject: paper.subject, paper });
    } catch (e) {
      console.error("Scheme request email failed:", e.message);
    }
    res.json({ data: paper, emailed });
  } catch (err) {
    handleError(res, err, "requestScheme");
  }
};

// POST /api/paper-setting/my/:id/scheme/submit   (setter) – the scheme asked for after submission
export const submitMyScheme = async (req, res) => {
  try {
    const paper = await loadOwnPaper(req, res);
    if (!paper) return;
    if (!paper.schemeRequested) return fail(res, 400, "The COE has not asked for the scheme.");
    if (!paper.schemeFile) return fail(res, 400, "Upload the scheme first.");
    const saved = await PaperSetting.findOneAndUpdate(
      { _id: paper._id, examinerClerkId: req.user.id, status: "SUBMITTED", schemeSubmittedAt: null },
      { $set: { schemeSubmittedAt: new Date() } },
      { returnDocument: "after" }
    ).populate(POPULATE[0]);
    if (!saved) return fail(res, 400, "The scheme cannot be submitted now.");
    await audit(req, "SCHEME_SUBMITTED", paper._id, { sha256: paper.schemeFile.sha256 });
    res.json({ data: facultyView(saved) });
  } catch (err) {
    handleError(res, err, "submitMyScheme");
  }
};
