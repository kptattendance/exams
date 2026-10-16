import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requestOtp, verifyOtp } from "../controllers/stepUpController.js";

const router = express.Router();

// One-time codes for sensitive actions (see services/stepUp.js)
router.post("/request", authenticateUser, requestOtp);
router.post("/verify", authenticateUser, verifyOtp);

export default router;
