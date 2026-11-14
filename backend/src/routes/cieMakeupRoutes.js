// Supplementary semester – CIE make-up for NE students (KPT 5.5)

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { listRounds, createRound, updateRound, getRound, registerStudent, enterMarks, removeEntry } from "../controllers/cieMakeupController.js";

const router = express.Router();
const DESK = requireRole("office", "coe", "acoe"); // + admin
const COE = requireRole("coe", "acoe"); // + admin

router.use(authenticateUser);
router.get("/rounds", DESK, listRounds);
router.post("/rounds", COE, createRound);
router.put("/rounds/:id", COE, updateRound);
router.get("/rounds/:id", DESK, getRound);
router.post("/rounds/:id/register", DESK, registerStudent);
router.post("/entries/:id/marks", DESK, requireStepUp("ia"), enterMarks);
router.delete("/entries/:id", COE, removeEntry);

export default router;
