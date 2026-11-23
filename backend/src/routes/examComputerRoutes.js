import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { listComputers, newChallenge, registerComputer, removeComputer, requestAccess, thisComputer, unlockComputer } from "../controllers/examComputerController.js";

const router = express.Router();

const MANAGE = requireRole("coe"); // + admin
const PRINTS = requireRole("chief_examiner"); // + admin

router.use(authenticateUser);
router.post("/this", requireRole("chief_examiner", "coe"), thisComputer);
router.post("/request", PRINTS, requestAccess);
router.post("/challenge", PRINTS, newChallenge);
router.get("/", MANAGE, listComputers);
router.post("/", MANAGE, requireStepUp("qp"), registerComputer);
router.post("/:id/remove", MANAGE, requireStepUp("qp"), removeComputer);
router.post("/:id/unlock", MANAGE, requireStepUp("qp"), unlockComputer);

export default router;
