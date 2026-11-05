import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { listEntryPackets, findPacket, getEntryPacket, submitEntry } from "../controllers/marksEntryController.js";
import { requireStepUp } from "../services/stepUp.js";
import { lockedExamGuard } from "../services/examLock.js";
import ValuationPacket from "../models/ValuationPacket.js";

const router = express.Router();

// Exam clerk types the award lists; COE / Admin may also do it
router.use(authenticateUser, requireRole("exam_clerk", "coe", "acoe", "admin"));
// Results published: no marks typed into this examination any more (Admin: reason + code)
router.use(
  lockedExamGuard(async (req) => {
    const m = req.path.match(/^\/packets\/([^/]+)/);
    return m ? (await ValuationPacket.findById(m[1]).select("exam").lean())?.exam : null;
  })
);
router.get("/packets", listEntryPackets);
router.get("/find", findPacket);
router.get("/packets/:id", getEntryPacket);
router.post("/packets/:id", requireStepUp("marks"), submitEntry);

export default router;
