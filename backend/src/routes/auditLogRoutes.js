import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { archiveOldLogs, exportLogs, listLogs, logsMeta } from "../controllers/auditLogController.js";

// The activity log is for the Admin only
const router = express.Router();
router.use(authenticateUser, adminOnly);
router.get("/", listLogs);
router.get("/meta", logsMeta);
router.get("/export", exportLogs);
router.post("/archive", requireStepUp("users"), archiveOldLogs);

export default router;
