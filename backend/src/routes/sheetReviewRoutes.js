import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly, requireRole } from "../middlewares/requireRole.js";
import { correctSheet, listSheets, getSheet, freezeSheet, returnSheet, deleteSheet, verifySheet } from "../controllers/sheetReviewController.js";
import { requireStepUp } from "../services/stepUp.js";

const router = express.Router();

// Exam Officer freezes; COE can also freeze (and Admin can look)
const VIEW = requireRole("office", "coe", "acoe", "admin", "principal");
const DECIDE = requireRole("office", "coe", "acoe");

// Corrections after verification and the final freeze: the COE and the Admin
const COE_ADMIN = requireRole("coe"); // + admin

router.use(authenticateUser);
router.get("/", VIEW, listSheets);
router.get("/:type/:id", VIEW, getSheet);
router.post("/:type/:id/freeze", DECIDE, requireStepUp("ia"), freezeSheet);
router.post("/:type/:id/return", DECIDE, requireStepUp("ia"), returnSheet);
router.post("/:type/:id/corrections", COE_ADMIN, requireStepUp("ia"), correctSheet);
router.post("/:type/:id/verify", COE_ADMIN, requireStepUp("ia"), verifySheet);
router.delete("/:type/:id", adminOnly, requireStepUp("delete"), deleteSheet); // running year only

export default router;
