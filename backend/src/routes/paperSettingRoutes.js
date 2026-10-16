import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly, requireRole } from "../middlewares/requireRole.js";
import { uploadDocx, uploadLimiter } from "../middlewares/uploadDocx.js";

import {
  listExaminers,
  createAssignment,
  listAssignments,
  resendEmail,
  updateAssignment,
  cancelAssignment,
  deleteAssignment,
  listOrders,
  getOrder,
  listForScrutiny,
  scrutinyScheme,
  startScrutiny,
  finishScrutiny,
  cancelScrutiny,
  requestScheme,
  submitMyScheme,
  uploadFinalPdf,
  examDayList,
  examDayPrint,
  downloadPaper,
  getAuditTrail,
  myAssignments,
  myAssignment,
  uploadPaper,
  previewMyPaper,
  submitMyPaper,
} from "../controllers/paperSettingController.js";

import { listSyllabus, addSyllabus, removeSyllabus, uploadPdf } from "../controllers/syllabusController.js";
import { requireStepUp } from "../services/stepUp.js";

const router = express.Router();

// Who can manage assignments (create, email, return, cancel)
const MANAGERS = ["coe", "acoe"];
// Who can open the actual question paper (keep this list as small as possible)
const CONTENT_READERS = ["coe"];
// Who can print the appointment orders that are posted to the setters
const ORDER_PRINTERS = ["office"];
// Only the scrutiniser opens papers for scrutiny (not even the COE)
const SCRUTINY = requireRole("qp_scrutinizer");

router.use(authenticateUser);

// ---------------- Faculty (examiner) ----------------
// These must come BEFORE "/:id" routes.
router.get("/my", myAssignments);
router.get("/my/:id", myAssignment);
router.post("/my/:id/upload", uploadLimiter, uploadDocx, uploadPaper);
router.post("/my/:id/upload/:kind", uploadLimiter, uploadDocx, uploadPaper);
router.get("/my/:id/preview", previewMyPaper);
router.post("/my/:id/submit", submitMyPaper);
router.post("/my/:id/scheme/submit", submitMyScheme);

// ---------------- COE / Exam officer ----------------
router.get("/examiners", requireRole(...MANAGERS), listExaminers);
router.get("/orders", requireRole(...ORDER_PRINTERS), listOrders);
router.get("/scrutiny", SCRUTINY, listForScrutiny);
// Chief Examiner: today's frozen papers (before "/:id")
router.get("/exam-day", requireRole("chief_examiner"), examDayList);
// Syllabus / scheme PDFs sent with the email (before "/:id")
router.get("/syllabus", requireRole(...MANAGERS), listSyllabus);
router.post("/syllabus", requireRole(...MANAGERS), uploadPdf, addSyllabus);
router.delete("/syllabus/:id", requireRole(...MANAGERS), removeSyllabus);
router.get("/", requireRole(...MANAGERS), listAssignments);
router.post("/", requireRole(...MANAGERS), createAssignment);
router.patch("/:id", requireRole(...MANAGERS), updateAssignment);
router.post("/:id/send-email", requireRole(...MANAGERS), resendEmail);
router.post("/:id/cancel", requireRole(...MANAGERS), cancelAssignment);
router.post("/:id/request-scheme", requireRole(...MANAGERS), requestScheme);
// Deleting an assignment (with its paper) is for the Admin only; COE can cancel
router.delete("/:id", adminOnly, requireStepUp("qp"), deleteAssignment);
router.get("/:id/download", requireRole(...CONTENT_READERS), requireStepUp("qp"), downloadPaper);
// COE: final PDF after page setting – freezes the paper for good
router.post("/:id/final-pdf", requireRole(...CONTENT_READERS), requireStepUp("qp"), uploadPdf, uploadFinalPdf);
// Chief Examiner: open and print on the exam date, from 1 hour before the session
router.get("/:id/exam-print", requireRole("chief_examiner"), requireStepUp("qp"), examDayPrint);
router.get("/:id/audit", requireRole(...CONTENT_READERS), getAuditTrail);
router.get("/:id/order", requireRole(...ORDER_PRINTERS), getOrder);
router.get("/:id/scrutiny/scheme", SCRUTINY, requireStepUp("qp"), scrutinyScheme);
router.post("/:id/scrutiny/start", SCRUTINY, requireStepUp("qp"), startScrutiny);
router.post("/:id/scrutiny/finish", SCRUTINY, requireStepUp("qp"), finishScrutiny);
router.post("/:id/scrutiny/cancel", SCRUTINY, requireStepUp("qp"), cancelScrutiny);

export default router;
