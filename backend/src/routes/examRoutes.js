import express from "express";
import multer from "multer";

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
import { listFees, recordFee, feeTemplate, importFees, exportFees } from "../controllers/feeController.js";
import { getTimetable, saveTimetable, suggest, publishTimetable } from "../controllers/timetableController.js";
import { listHallTickets } from "../controllers/hallTicketController.js";

const router = express.Router();

// COE and Admin run exams; Exam Officer and Principal can look
const MANAGE = requireRole("coe", "admin");
const VIEW = requireRole("coe", "admin", "exam_officer", "principal", "office");
// Fee verification: office staff, COE, Admin
const FEES = requireRole("office", "coe", "admin");

const excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    /\.(xlsx|xls|csv)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(Object.assign(new Error("Upload the Excel file (.xlsx, .xls or .csv)."), { status: 400 })),
}).single("file");

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

// Fee verification
router.get("/:id/fees", VIEW, listFees);
router.get("/:id/fees/template", FEES, feeTemplate);
router.get("/:id/fees/export", VIEW, exportFees);
router.post("/:id/fees/import", FEES, excel, importFees);
router.post("/:id/registrations/:regId/fee", FEES, recordFee);

// Timetable (written exams)
router.get("/:id/timetable", VIEW, getTimetable);
router.put("/:id/timetable", MANAGE, saveTimetable);
router.post("/:id/timetable/suggest", MANAGE, suggest);
router.post("/:id/timetable/publish", MANAGE, publishTimetable);

// Hall tickets
router.get("/:id/hall-tickets", VIEW, listHallTickets);

export default router;
