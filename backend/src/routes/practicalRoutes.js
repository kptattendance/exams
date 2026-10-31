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
  officeOverview,
  getSchedule,
  saveSchedule,
  listOrders,
  resendOrder,
} from "../controllers/practicalController.js";
import { requireStepUp } from "../services/stepUp.js";

const router = express.Router();

// COE allots the examiner sets of each department; the board's HOD forms the
// batches and the time table (COE / Admin may help); the internal examiner
// enters the marks; only the Admin corrects them later.
const ALLOT = requireRole("coe", "acoe", "admin");
const BATCHES = requireRole("hod", "coe", "acoe", "admin");
const VIEW = requireRole("hod", "coe", "acoe", "admin", "office", "principal");
const EXAMINER = requireRole("staff", "hod");

router.use(authenticateUser);

router.get("/exams", VIEW, practicalExams);
router.get("/examiners", ALLOT, listExaminers);
router.get("/my", EXAMINER, myBatches);

router.patch("/panels/:panelId", ALLOT, updatePanel);
router.delete("/panels/:panelId", ALLOT, removePanel);
router.post("/panels/:panelId/code", ALLOT, reissueCode);
router.post("/panels/:panelId/order", ALLOT, resendOrder); // office order for the external examiner

// The controller checks who may see or enter each batch
router.get("/batches/:batchId", getBatch);
router.post("/batches/:batchId/unlock", EXAMINER, unlockBatch);
router.put("/batches/:batchId/marks", EXAMINER, saveDraft);
router.post("/batches/:batchId/submit", EXAMINER, requireStepUp("marks"), submitBatch);
router.post("/batches/:batchId/correct", requireRole("admin"), requireStepUp("marks"), correctMark);

router.get("/:id/panels", VIEW, listPanels);
router.post("/:id/panels", ALLOT, addPanel);
router.get("/:id/orders", requireRole("coe", "acoe", "admin", "office"), listOrders); // office orders (print; the exam section keeps them on file)
router.get("/:id/subjects", BATCHES, listSubjects);
router.get("/:id/subjects/:code", BATCHES, getSubject);
router.post("/:id/subjects/:code/split", BATCHES, splitBatches);
router.put("/:id/subjects/:code/batches", BATCHES, saveBatches);
router.get("/:id/batches", VIEW, listBatches);
router.get("/:id/office", VIEW, officeOverview); // room diary, mark-entry sheets, marks status
router.get("/:id/schedule", BATCHES, getSchedule); // HOD time table grid
router.put("/:id/schedule", BATCHES, saveSchedule);

export default router;
