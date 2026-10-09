import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listExams,
  createExam,
  getExam,
  updateExam,
  deleteExam,
  startGeneration,
  processGeneration,
  listRegistrations,
  overrideSubject,
  addBackPapers,
  removeManualSubject,
  exportRegistrations,
  listBridgeCourses,
  saveBridgeCourses,
} from "../controllers/examController.js";

const router = express.Router();

// COE and Admin run exams; Exam Officer and Principal can look
const MANAGE = requireRole("coe", "admin");
const VIEW = requireRole("coe", "admin", "exam_officer", "principal");

router.use(authenticateUser);

// Setup (must come before "/:id")
router.get("/setup/bridge-courses", VIEW, listBridgeCourses);
router.put("/setup/bridge-courses", MANAGE, saveBridgeCourses);

router.get("/", VIEW, listExams);
router.post("/", MANAGE, createExam);
router.get("/:id", VIEW, getExam);
router.patch("/:id", MANAGE, updateExam);
router.delete("/:id", MANAGE, deleteExam);

router.post("/:id/generate", MANAGE, startGeneration);
router.post("/:id/process", MANAGE, processGeneration);

router.get("/:id/registrations", VIEW, listRegistrations);
router.post("/:id/registrations/:regId/override", MANAGE, overrideSubject);
router.delete("/:id/registrations/:regId/subjects/:subjectId", MANAGE, removeManualSubject);
router.post("/:id/back-papers", MANAGE, addBackPapers);
router.get("/:id/export", VIEW, exportRegistrations);

export default router;
