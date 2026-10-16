// src/controllers/stepUpController.js
//
//   POST /api/otp/request { scope }            → code sent by SMS (or email); { requestId, channel, to, minutes }
//   POST /api/otp/verify  { requestId, code }  → { token, scope, expiresAt } (the pass)
//
// Every request, success and failure is written to the audit log.

import crypto from "node:crypto";
import mongoose from "mongoose";

import SecurityCode from "../models/SecurityCode.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import { sendSecurityCodeEmail } from "../services/mailer.js";
import { SCOPES, issuePass, smsReady, indianMobile, sendOtpSms, maskMobile, maskEmail } from "../services/stepUp.js";

const CODE_MINUTES = 5;
const MAX_TRIES = 5;
const MAX_REQUESTS = 5; // per user per 15 minutes

const fail = (res, status, error) => res.status(status).json({ error });
const hashOf = (code, salt) => crypto.scryptSync(String(code).replace(/\s+/g, ""), salt, 32).toString("hex");

const log = (req, action, details) =>
  AuditLog.create({
    action,
    entity: "StepUp",
    actorClerkId: req.user?.id || "unknown",
    actorEmail: req.user?.email || "",
    actorRole: req.user?.role || "",
    ip: (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
    details,
  }).catch((e) => console.error("Audit log failed:", e.message));

export const requestOtp = async (req, res) => {
  const scope = String(req.body?.scope || "");
  if (!SCOPES[scope]) return fail(res, 400, "Unknown verification.");

  const recent = await SecurityCode.countDocuments({
    requestedBy: req.user.id,
    purpose: /^STEP_UP:/,
    createdAt: { $gt: new Date(Date.now() - 15 * 60 * 1000) },
  });
  if (recent >= MAX_REQUESTS) return fail(res, 429, "Too many codes asked for. Wait a few minutes and try again.");

  const user = await User.findOne({ clerkId: req.user.id }).select("phone email").lean();
  const mobile = indianMobile(user?.phone);
  const email = req.user.email || user?.email;

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const salt = crypto.randomBytes(16).toString("hex");

  let channel = null;
  let to = "";
  if (smsReady() && mobile) {
    try {
      await sendOtpSms(mobile, code);
      channel = "sms";
      to = maskMobile(mobile);
    } catch (e) {
      console.error("OTP SMS failed:", e.message);
    }
  }
  if (!channel && email) {
    try {
      if (await sendSecurityCodeEmail({ to: email, code, action: `verify for ${SCOPES[scope].label}` })) {
        channel = "email";
        to = maskEmail(email);
      }
    } catch (e) {
      console.error("OTP email failed:", e.message);
    }
  }
  if (!channel) return fail(res, 502, "The code could not be sent. Check your mobile number / email with the Admin.");

  const doc = await SecurityCode.create({
    purpose: `STEP_UP:${scope}`,
    payload: { scope },
    salt,
    hash: hashOf(code, salt),
    requestedBy: req.user.id,
    sentTo: to,
    expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000),
  });
  await log(req, "OTP_SENT", { scope, channel, to });
  res.json({ requestId: doc._id, channel, to, minutes: CODE_MINUTES, scope, label: SCOPES[scope].label });
};

export const verifyOtp = async (req, res) => {
  const { requestId, code } = req.body || {};
  if (!mongoose.Types.ObjectId.isValid(requestId)) return fail(res, 400, "Invalid request.");
  const doc = await SecurityCode.findOne({ _id: requestId, requestedBy: req.user.id, purpose: /^STEP_UP:/ });
  if (!doc || doc.expiresAt < new Date()) return fail(res, 410, "The code has expired. Ask for a new one.");
  if (doc.attempts >= MAX_TRIES) return fail(res, 429, "Too many wrong codes. Ask for a new one.");

  const a = Buffer.from(hashOf(code, doc.salt), "hex");
  const b = Buffer.from(doc.hash, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    doc.attempts += 1;
    await doc.save();
    await log(req, "OTP_WRONG", { scope: doc.payload?.scope, attempts: doc.attempts });
    return fail(res, 400, `Wrong code. ${Math.max(0, MAX_TRIES - doc.attempts)} tries left.`);
  }
  await SecurityCode.deleteOne({ _id: doc._id });
  const pass = issuePass(req.user.id, doc.payload.scope);
  await log(req, "OTP_VERIFIED", { scope: pass.scope, until: pass.expiresAt });
  res.json(pass);
};
