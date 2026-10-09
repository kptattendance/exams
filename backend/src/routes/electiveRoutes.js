import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { electiveOverview, getElectives, saveElectives } from "../controllers/electiveController.js";

const router = express.Router();

router.use(authenticateUser, requireRole("hod", "coe", "admin"));

router.get("/overview", electiveOverview);
router.get("/", getElectives);
router.put("/", saveElectives);

export default router;
