// KPT 6.2.5 – special examinations for NCC / NSS / Red Cross / sports / cultural duty

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { listSpecial, studentForSpecial, addSpecial, specialMarks, removeSpecial } from "../controllers/specialExamController.js";

const router = express.Router();
const COE = requireRole("coe", "acoe"); // + admin

router.use(authenticateUser, COE);
router.get("/exams/:examId", listSpecial);
router.get("/exams/:examId/student", studentForSpecial);
router.post("/exams/:examId", addSpecial);
router.post("/:id/marks", requireStepUp("results"), specialMarks);
router.delete("/:id", removeSpecial);

export default router;
