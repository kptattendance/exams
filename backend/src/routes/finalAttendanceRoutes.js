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
import { requireStepUp } from "../services/stepUp.js";
import { asHodScope } from "../services/evening.js";

const router = express.Router();

// =====================================================
// PREPARE ATTENDANCE
// =====================================================

router.get(
  "/prepare",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  prepareAttendance
);

// =====================================================
// SAVE ATTENDANCE
// =====================================================

router.post(
  "/save",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  requireStepUp("ia"),
  saveAttendance
);

// =====================================================
// GET SAVED ATTENDANCE
// =====================================================

router.get(
  "/get",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  getAttendance
);

// =====================================================
// SUBMIT ATTENDANCE
// =====================================================

router.post(
  "/submit",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  requireStepUp("ia"),
  submitAttendance
);

router.post(
  "/confirm",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  requireStepUp("ia"),
  confirmAttendance
);
export default router;