import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { deleteFromBin, listBin, restoreFromBin } from "../controllers/recycleBinController.js";

const router = express.Router();

// Admin only: deleted students, subjects and IA / attendance sheets (30 days)
router.use(authenticateUser, adminOnly);
router.get("/", listBin);
router.post("/:id/restore", restoreFromBin);
router.delete("/:id", requireStepUp("delete"), deleteFromBin); // for good: type DELETE + a fresh code

export default router;
