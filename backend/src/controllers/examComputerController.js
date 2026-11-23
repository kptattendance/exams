// src/controllers/examComputerController.js
//
// The computers allowed to print question papers on the exam day.
//   GET  /api/exam-computers              the list (COE, Admin)
//   POST /api/exam-computers              { name, publicKey } register this computer
//   POST /api/exam-computers/:id/remove   take it off the list
//   POST /api/exam-computers/:id/unlock   { reason } emergency access for 30 minutes
//   POST /api/exam-computers/this         { publicKey } is this computer allowed?
//   POST /api/exam-computers/request      { publicKey } ask for emergency access
//   POST /api/exam-computers/challenge    { paperId } one-time question before a print

import crypto from "node:crypto";
import mongoose from "mongoose";

import ExamComputer, { ExamComputerChallenge } from "../models/ExamComputer.js";
import AuditLog from "../models/AuditLog.js";
import { CHALLENGE_MINUTES, UNLOCK_MINUTES, cleanKey, computerAllowed, keyIdOf, proofMessage, shortCode, verifyProof } from "../services/examComputers.js";

const fail = (res, status, error, extra = {}) => res.status(status).json({ error, ...extra });
const who = (req) => req.user?.email || req.user?.id || "unknown";
const isId = (id) => mongoose.Types.ObjectId.isValid(id);
const NOT_APPROVED = "This computer is not approved for printing question papers. Use a registered exam-section computer, or ask the COE / Admin for emergency access.";

const log = (req, action, entityId, details) =>
  AuditLog.create({
    action,
    entity: "ExamComputer",
    entityId,
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

const view = (c) => ({
  _id: c._id,
  name: c.name,
  code: shortCode(c.keyId),
  status: c.status,
  allowed: computerAllowed(c),
  registeredBy: c.registeredBy,
  registeredAt: c.registeredAt,
  requestedBy: c.requestedBy,
  requestedAt: c.requestedAt,
  unlockedUntil: c.unlockedUntil && new Date(c.unlockedUntil) > new Date() ? c.unlockedUntil : null,
  unlockReason: c.unlockReason,
  unlockedBy: c.unlockedBy,
  lastUsedAt: c.lastUsedAt,
  lastUsedBy: c.lastUsedBy,
});

const ORDER = { REQUESTED: 0, ACTIVE: 1, REMOVED: 2 };

export const listComputers = async (req, res) => {
  const list = await ExamComputer.find().lean();
  list.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  res.json({ data: list.map(view) });
};

export const registerComputer = async (req, res) => {
  const key = cleanKey(req.body?.publicKey);
  if (!key) return fail(res, 400, "This browser could not make a security key. Use Chrome, and not an Incognito window.");
  const name = String(req.body?.name || "").trim().replace(/\s+/g, " ").slice(0, 40);
  if (name.length < 2) return fail(res, 400, "Give this computer a name, e.g. Exam Cell Desktop.");
  const keyId = keyIdOf(key);
  const clash = await ExamComputer.findOne({
    status: "ACTIVE",
    keyId: { $ne: keyId },
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  })
    .select("_id")
    .lean();
  if (clash) return fail(res, 409, `Another computer is already named "${name}".`);
  const c = await ExamComputer.findOneAndUpdate(
    { keyId },
    {
      $set: { publicKey: key, name, status: "ACTIVE", registeredBy: who(req), registeredAt: new Date(), unlockedUntil: null, unlockReason: "", unlockedBy: "" },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  await log(req, "EXAM_COMPUTER_REGISTERED", c._id, { name, code: shortCode(keyId) });
  res.json({ message: `"${name}" is registered. It can now print question papers on the exam day.`, data: view(c) });
};

export const removeComputer = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid computer.");
  const c = await ExamComputer.findByIdAndUpdate(req.params.id, { $set: { status: "REMOVED", unlockedUntil: null } }, { returnDocument: "after" }).lean();
  if (!c) return fail(res, 404, "Computer not found.");
  await log(req, "EXAM_COMPUTER_REMOVED", c._id, { name: c.name, code: shortCode(c.keyId) });
  res.json({ message: `"${c.name}" can no longer print question papers.` });
};

export const unlockComputer = async (req, res) => {
  if (!isId(req.params.id)) return fail(res, 400, "Invalid computer.");
  const reason = String(req.body?.reason || "").trim().slice(0, 200);
  if (reason.length < 5) return fail(res, 400, "Write the reason for the emergency access.");
  const until = new Date(Date.now() + UNLOCK_MINUTES * 60 * 1000);
  const c = await ExamComputer.findByIdAndUpdate(
    req.params.id,
    { $set: { unlockedUntil: until, unlockReason: reason, unlockedBy: who(req) } },
    { returnDocument: "after" }
  ).lean();
  if (!c) return fail(res, 404, "Computer not found.");
  await log(req, "EXAM_COMPUTER_UNLOCKED", c._id, { name: c.name, code: shortCode(c.keyId), reason, until });
  res.json({ message: `"${c.name}" can print for the next ${UNLOCK_MINUTES} minutes.`, data: view(c) });
};

// Is the computer in use allowed? (Nothing is saved.)
export const thisComputer = async (req, res) => {
  const key = cleanKey(req.body?.publicKey);
  if (!key) return fail(res, 400, "This browser could not make a security key. Use Chrome, and not an Incognito window.");
  const keyId = keyIdOf(key);
  const c = await ExamComputer.findOne({ keyId }).lean();
  res.json({ data: c ? view(c) : { name: "", code: shortCode(keyId), status: "", allowed: false, unlockedUntil: null } });
};

export const requestAccess = async (req, res) => {
  const key = cleanKey(req.body?.publicKey);
  if (!key) return fail(res, 400, "This browser could not make a security key. Use Chrome, and not an Incognito window.");
  const keyId = keyIdOf(key);
  const found = await ExamComputer.findOne({ keyId }).lean();
  if (found?.status === "ACTIVE") return res.json({ message: "This computer is already registered.", data: view(found) });
  const c = await ExamComputer.findOneAndUpdate(
    { keyId },
    {
      $set: { publicKey: key, status: "REQUESTED", requestedBy: who(req), requestedAt: new Date() },
      $setOnInsert: { name: `Computer ${shortCode(keyId)}` },
    },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  await log(req, "EXAM_COMPUTER_ACCESS_ASKED", c._id, { name: c.name, code: shortCode(keyId) });
  res.json({ message: `Request sent. Tell the COE / Admin this computer's code: ${shortCode(keyId)}`, data: view(c) });
};

export const newChallenge = async (req, res) => {
  const paperId = String(req.body?.paperId || "");
  if (!isId(paperId)) return fail(res, 400, "Invalid paper.");
  const nonce = crypto.randomBytes(24).toString("base64url");
  const doc = await ExamComputerChallenge.create({ user: req.user.id, paper: paperId, nonce, expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60 * 1000) });
  res.json({ challengeId: doc._id, message: proofMessage({ challengeId: doc._id, nonce, paperId, userId: req.user.id }) });
};

// Before GET /paper-setting/:id/exam-print (and before the verification code):
// the request must be signed by an approved computer. The one-time question is
// used up by the print itself, so the request can be repeated after the code.
export const requireExamComputer = async (req, res, next) => {
  try {
    const keyId = String(req.headers["x-exam-computer"] || "");
    const [challengeId, signature] = String(req.headers["x-exam-proof"] || "").split(".");
    if (!/^[0-9a-f]{64}$/.test(keyId) || !isId(challengeId) || !signature) return fail(res, 403, NOT_APPROVED, { computer: true });
    const computer = await ExamComputer.findOne({ keyId }).lean();
    if (!computerAllowed(computer)) return fail(res, 403, NOT_APPROVED, { computer: true });
    const challenge = await ExamComputerChallenge.findOne({ _id: challengeId, user: req.user.id, paper: req.params.id, expiresAt: { $gt: new Date() } }).lean();
    if (!challenge) return fail(res, 403, "The check of this computer has expired. Click Open & print again.", { computer: true });
    const message = proofMessage({ challengeId: challenge._id, nonce: challenge.nonce, paperId: req.params.id, userId: req.user.id });
    if (!verifyProof(computer.publicKey, message, signature)) return fail(res, 403, NOT_APPROVED, { computer: true });
    req.examComputer = computer;
    req.examChallenge = challenge;
    next();
  } catch (e) {
    console.error("Exam computer check failed:", e.message);
    fail(res, 500, "Could not check this computer. Please try again.");
  }
};

// One print per answered question
export const useChallenge = async (req) => Boolean(await ExamComputerChallenge.findOneAndDelete({ _id: req.examChallenge._id }));

export const markComputerUsed = (req) =>
  ExamComputer.updateOne({ _id: req.examComputer._id }, { $set: { lastUsedAt: new Date(), lastUsedBy: who(req) } }).catch((e) => console.error("Exam computer update failed:", e.message));
