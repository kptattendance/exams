// Award of the Diploma, class and ranks (KPT 11, 12, 14.8) – COE

import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { diplomaList, awardDiploma, listAwards, undoAward } from "../controllers/diplomaController.js";

const router = express.Router();
router.use(authenticateUser, requireRole("coe", "acoe")); // + admin
router.get("/", diplomaList);
router.get("/awards", listAwards);
router.post("/award", requireStepUp("results"), awardDiploma);
router.delete("/award/:id", requireStepUp("results"), undoAward);

export default router;
