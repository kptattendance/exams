// KPT 9.9 – result rejection, recorded by the COE

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { listRejections, checkRejection, rejectResult, undoRejection } from "../controllers/rejectionController.js";

const router = express.Router();
const COE = requireRole("coe", "acoe"); // + admin

router.use(authenticateUser, COE);
router.get("/exams/:examId", listRejections);
router.get("/exams/:examId/student", checkRejection);
router.post("/exams/:examId", requireStepUp("results"), rejectResult);
router.delete("/exams/:examId/:regId", requireStepUp("results"), undoRejection);

export default router;
