import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { createBackup, downloadBackup, listBackups } from "../controllers/backupController.js";

// Database backups: Admin only; making or downloading one needs the verification code
const router = express.Router();
router.use(authenticateUser, adminOnly);
router.get("/", listBackups);
router.post("/", requireStepUp("users"), createBackup);
router.get("/:id/download", requireStepUp("users"), downloadBackup);

export default router;
