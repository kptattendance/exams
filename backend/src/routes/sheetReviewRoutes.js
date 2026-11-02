import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly, requireRole } from "../middlewares/requireRole.js";
import { listSheets, getSheet, freezeSheet, returnSheet, deleteSheet } from "../controllers/sheetReviewController.js";
import { requireStepUp } from "../services/stepUp.js";

const router = express.Router();

// Exam Officer freezes; COE can also freeze (and Admin can look)
const VIEW = requireRole("office", "coe", "acoe", "admin", "principal");
const DECIDE = requireRole("office", "coe", "acoe");

router.use(authenticateUser);
router.get("/", VIEW, listSheets);
router.get("/:type/:id", VIEW, getSheet);
router.post("/:type/:id/freeze", DECIDE, requireStepUp("ia"), freezeSheet);
router.post("/:type/:id/return", DECIDE, requireStepUp("ia"), returnSheet);
router.delete("/:type/:id", adminOnly, requireStepUp("ia"), deleteSheet); // running year only

export default router;
