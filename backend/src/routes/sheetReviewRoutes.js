import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { listSheets, getSheet, freezeSheet, returnSheet } from "../controllers/sheetReviewController.js";

const router = express.Router();

// Exam Officer freezes; COE can also freeze (and Admin can look)
const VIEW = requireRole("exam_officer", "coe", "admin", "principal");
const DECIDE = requireRole("exam_officer", "coe");

router.use(authenticateUser);
router.get("/", VIEW, listSheets);
router.get("/:type/:id", VIEW, getSheet);
router.post("/:type/:id/freeze", DECIDE, freezeSheet);
router.post("/:type/:id/return", DECIDE, returnSheet);

export default router;
