// Earlier mark cards – from results imported from the old software (25S, 26A …)

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { earlierExams, earlierMarkCards } from "../controllers/markCardController.js";

const router = express.Router();
router.use(authenticateUser, requireRole("coe", "acoe", "office")); // + admin
router.get("/exams", earlierExams);
router.get("/", earlierMarkCards);

export default router;
