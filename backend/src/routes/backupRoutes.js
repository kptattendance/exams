import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { autoBackup, createBackup, downloadBackup, listBackups, saveAlertEmail, setKeep } from "../controllers/backupController.js";

const router = express.Router();

// Vercel Cron, every night (no sign-in: checked with CRON_SECRET)
router.get("/auto", autoBackup);

// Database backups: Admin only; making or downloading one needs the verification code
router.use(authenticateUser, adminOnly);
router.get("/", listBackups);
router.post("/", requireStepUp("users"), createBackup);
router.put("/alert-email", saveAlertEmail);
router.patch("/:id", setKeep);
router.get("/:id/download", requireStepUp("users"), downloadBackup);

export default router;
