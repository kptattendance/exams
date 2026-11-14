// KPT 9.8 – revaluation, answer script copy and viewing, after the results
// are published. The office records applications with the fee; the COE sets
// the last date and enters the revaluation marks.
//
// Not under /api/exams/:id on purpose: that path is locked once the results
// are published, and these exist only for published exams.

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import {
  listApplications,
  setLastDate,
  studentPapers,
  addApplication,
  issueCopy,
  removeApplication,
  enterMarks,
} from "../controllers/revaluationController.js";

const router = express.Router();
const DESK = requireRole("office", "coe", "acoe"); // + admin
const COE = requireRole("coe", "acoe"); // + admin

router.use(authenticateUser);
router.get("/exams/:examId", DESK, listApplications);
router.get("/exams/:examId/student", DESK, studentPapers);
router.post("/exams/:examId", DESK, addApplication);
router.put("/exams/:examId/last-date", COE, setLastDate);
router.post("/:id/issue", DESK, issueCopy);
router.delete("/:id", COE, removeApplication);
router.post("/:id/marks", COE, requireStepUp("results"), enterMarks);

export default router;
