import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { electiveOverview, getElectives, saveElectives } from "../controllers/electiveController.js";
import { asHodScope } from "../services/evening.js";

const router = express.Router();

router.use(authenticateUser, asHodScope, requireRole("hod", "coe", "acoe", "admin"));

router.get("/overview", electiveOverview);
router.get("/", getElectives);
router.put("/", saveElectives);

export default router;
