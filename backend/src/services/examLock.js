// src/services/examLock.js
//
// Once the results of an examination are published, the examination is
// LOCKED: its registrations, fees, timetable, practicals, valuation and marks
// can no longer be changed. Only the Admin can still change something, and
// only with a reason (X-Unlock-Reason header, asked by the page) and a fresh
// verification code; every such change is written to the activity log.
//
//   router.use(lockedExamGuard((req) => req.params.id))   // any change (not GET)

import mongoose from "mongoose";

import Exam from "../models/Exam.js";
import { audit } from "../models/AuditLog.js";
import { requireStepUp } from "./stepUp.js";

const READ = new Set(["GET", "HEAD", "OPTIONS"]);

export const isLocked = (exam) => Boolean(exam?.results?.publishedAt);

//   resolve(req) -> exam id (or null when the request is not about one exam)
export const lockedExamGuard = (resolve) => async (req, res, next) => {
  if (READ.has(req.method)) return next();
  let examId = null;
  try {
    examId = await resolve(req);
  } catch {
    examId = null;
  }
  if (!examId || !mongoose.Types.ObjectId.isValid(String(examId))) return next();
  const exam = await Exam.findById(examId).select("name results.publishedAt").lean();
  if (!isLocked(exam)) return next();

  const when = new Date(exam.results.publishedAt).toLocaleDateString("en-IN", { dateStyle: "medium" });
  if (req.user?.role !== "admin")
    return res.status(423).json({
      error: `The results of ${exam.name} were published on ${when}, so the examination is locked. Only the Admin can change it.`,
      locked: true,
    });

  // sent URL-encoded by the page (a reason may be in Kannada)
  let reason = String(req.headers["x-unlock-reason"] || "");
  try {
    reason = decodeURIComponent(reason);
  } catch {
    // as it is
  }
  reason = reason.trim();
  if (reason.length < 5)
    return res.status(423).json({
      error: `The results of ${exam.name} were published on ${when}. Write why this change is needed.`,
      locked: true,
      needReason: true,
      exam: exam.name,
    });

  // a fresh code, then the change is logged with the reason
  return requireStepUp("unlock")(req, res, async () => {
    await audit(req, "LOCKED_EXAM_CHANGED", exam._id, { exam: exam.name, reason: reason.slice(0, 500), method: req.method, path: req.originalUrl.split("?")[0] });
    next();
  });
};
