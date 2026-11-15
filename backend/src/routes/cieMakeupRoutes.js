// Supplementary semester – CIE make-up for NE students (KPT 5.5)

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { listRounds, createRound, updateRound, getRound, registerStudent, enterMarks, removeEntry, makeupSheet, saveMakeupMark } from "../controllers/cieMakeupController.js";
import { asHodScope } from "../services/evening.js";

const router = express.Router();
const DESK = requireRole("office", "coe", "acoe"); // + admin
const COE = requireRole("coe", "acoe"); // + admin

router.use(authenticateUser);
// the department's make-up sheet: HODs (Evening Principal: evening students), COE / office for all
const SHEET = requireRole("hod", "office", "coe", "acoe"); // + admin
router.get("/sheet", asHodScope, SHEET, makeupSheet);
router.post("/sheet", asHodScope, SHEET, requireStepUp("ia"), saveMakeupMark);

router.get("/rounds", DESK, listRounds);
router.post("/rounds", COE, createRound);
router.put("/rounds/:id", COE, updateRound);
router.get("/rounds/:id", DESK, getRound);
router.post("/rounds/:id/register", DESK, registerStudent);
router.post("/entries/:id/marks", DESK, requireStepUp("ia"), enterMarks);
router.delete("/entries/:id", COE, removeEntry);

export default router;
