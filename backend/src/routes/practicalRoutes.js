import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  practicalExams,
  listExaminers,
  listPanels,
  addPanel,
  updatePanel,
  removePanel,
  reissueCode,
  listSubjects,
  getSubject,
  splitBatches,
  saveBatches,
  listBatches,
  myBatches,
  getBatch,
  unlockBatch,
  saveDraft,
  submitBatch,
  correctMark,
} from "../controllers/practicalController.js";

const router = express.Router();

// COE allots the examiner sets of each department; the board's HOD forms the
// batches and the time table (COE / Admin may help); the internal examiner
// enters the marks; only the Admin corrects them later.
const ALLOT = requireRole("coe", "admin");
const BATCHES = requireRole("hod", "coe", "admin");
const VIEW = requireRole("hod", "coe", "admin", "exam_officer", "principal");
const EXAMINER = requireRole("staff", "hod");

router.use(authenticateUser);

router.get("/exams", VIEW, practicalExams);
router.get("/examiners", ALLOT, listExaminers);
router.get("/my", EXAMINER, myBatches);

router.patch("/panels/:panelId", ALLOT, updatePanel);
router.delete("/panels/:panelId", ALLOT, removePanel);
router.post("/panels/:panelId/code", ALLOT, reissueCode);

// The controller checks who may see or enter each batch
router.get("/batches/:batchId", getBatch);
router.post("/batches/:batchId/unlock", EXAMINER, unlockBatch);
router.put("/batches/:batchId/marks", EXAMINER, saveDraft);
router.post("/batches/:batchId/submit", EXAMINER, submitBatch);
router.post("/batches/:batchId/correct", requireRole("admin"), correctMark);

router.get("/:id/panels", VIEW, listPanels);
router.post("/:id/panels", ALLOT, addPanel);
router.get("/:id/subjects", BATCHES, listSubjects);
router.get("/:id/subjects/:code", BATCHES, getSubject);
router.post("/:id/subjects/:code/split", BATCHES, splitBatches);
router.put("/:id/subjects/:code/batches", BATCHES, saveBatches);
router.get("/:id/batches", VIEW, listBatches);

export default router;
