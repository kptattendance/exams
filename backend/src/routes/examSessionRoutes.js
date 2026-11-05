import express from "express";
import { lockedExamGuard } from "../services/examLock.js";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { getSession, listSessions, saveAbsentees, saveRooms } from "../controllers/examSessionController.js";

const router = express.Router();

// Written exam sessions: the Chief Examiner runs them (rooms, absentees);
// the COE office can see and help.
const RUN = requireRole("chief_examiner", "coe", "acoe", "admin");

router.use(authenticateUser);
// Results published: no change to this examination (Admin: reason + code)
router.use("/:examId", lockedExamGuard((req) => req.params.examId));
router.get("/", RUN, listSessions);
router.get("/:examId/:date/:session", RUN, getSession);
router.put("/:examId/:date/:session/rooms", RUN, saveRooms);
router.post("/:examId/:date/:session/absent", RUN, saveAbsentees);

export default router;
