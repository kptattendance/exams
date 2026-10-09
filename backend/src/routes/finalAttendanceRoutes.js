import express from "express";

import {
  prepareAttendance,
  saveAttendance,
  getAttendance,
  submitAttendance,
  confirmAttendance,
} from "../controllers/finalAttendanceController.js";

import {authenticateUser} from "../middlewares/authMiddleware.js";
import { forceAcademicYear } from "../services/academicYear.js";

const router = express.Router();

// =====================================================
// PREPARE ATTENDANCE
// =====================================================

router.get(
  "/prepare",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  prepareAttendance
);

// =====================================================
// SAVE ATTENDANCE
// =====================================================

router.post(
  "/save",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  saveAttendance
);

// =====================================================
// GET SAVED ATTENDANCE
// =====================================================

router.get(
  "/get",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  getAttendance
);

// =====================================================
// SUBMIT ATTENDANCE
// =====================================================

router.post(
  "/submit",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  submitAttendance
);

router.post(
  "/confirm",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  confirmAttendance
);
export default router;