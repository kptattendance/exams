import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { listEntryPackets, findPacket, getEntryPacket, submitEntry } from "../controllers/marksEntryController.js";

const router = express.Router();

// Exam clerk types the award lists; COE / Admin may also do it
router.use(authenticateUser, requireRole("exam_clerk", "coe", "admin"));
router.get("/packets", listEntryPackets);
router.get("/find", findPacket);
router.get("/packets/:id", getEntryPacket);
router.post("/packets/:id", submitEntry);

export default router;
