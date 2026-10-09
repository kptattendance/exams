import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { uploadDocx, uploadLimiter } from "../middlewares/uploadDocx.js";

import {
  listExaminers,
  createAssignment,
  listAssignments,
  resendEmail,
  updateAssignment,
  returnForCorrection,
  cancelAssignment,
  downloadPaper,
  getAuditTrail,
  myAssignments,
  myAssignment,
  uploadPaper,
  previewMyPaper,
  submitMyPaper,
} from "../controllers/paperSettingController.js";

const router = express.Router();

// Who can manage assignments (create, email, return, cancel)
const MANAGERS = ["coe", "exam_officer"];
// Who can open the actual question paper (keep this list as small as possible)
const CONTENT_READERS = ["coe"];

router.use(authenticateUser);

// ---------------- Faculty (examiner) ----------------
// These must come BEFORE "/:id" routes.
router.get("/my", myAssignments);
router.get("/my/:id", myAssignment);
router.post("/my/:id/upload", uploadLimiter, uploadDocx, uploadPaper);
router.get("/my/:id/preview", previewMyPaper);
router.post("/my/:id/submit", submitMyPaper);

// ---------------- COE / Exam officer ----------------
router.get("/examiners", requireRole(...MANAGERS), listExaminers);
router.get("/", requireRole(...MANAGERS), listAssignments);
router.post("/", requireRole(...MANAGERS), createAssignment);
router.patch("/:id", requireRole(...MANAGERS), updateAssignment);
router.post("/:id/send-email", requireRole(...MANAGERS), resendEmail);
router.post("/:id/return", requireRole(...CONTENT_READERS), returnForCorrection);
router.post("/:id/cancel", requireRole(...MANAGERS), cancelAssignment);
router.get("/:id/download", requireRole(...CONTENT_READERS), downloadPaper);
router.get("/:id/audit", requireRole(...CONTENT_READERS), getAuditTrail);

export default router;
