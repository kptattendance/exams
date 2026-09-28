import express from "express";

import {
  prepareAttendance,
  saveAttendance,
  getAttendance,
  submitAttendance,
  confirmAttendance,
} from "../controllers/finalAttendanceController.js";

import {authenticateUser} from "../middlewares/authMiddleware.js";

const router = express.Router();

// =====================================================
// PREPARE ATTENDANCE
// =====================================================

router.get(
  "/prepare",
  authenticateUser,
  prepareAttendance
);

// =====================================================
// SAVE ATTENDANCE
// =====================================================

router.post(
  "/save",
  authenticateUser,
  saveAttendance
);

// =====================================================
// GET SAVED ATTENDANCE
// =====================================================

router.get(
  "/get",
  authenticateUser,
  getAttendance
);

// =====================================================
// SUBMIT ATTENDANCE
// =====================================================

router.post(
  "/submit",
  authenticateUser,
  submitAttendance
);

router.post(
  "/confirm",
  authenticateUser,
  confirmAttendance
);
export default router;