import express from "express";

import {
  prepareFinalIA,
  saveFinalIA,
  getFinalIA,
  submitFinalIA,
  confirmFinalIA,
} from "../controllers/finalIAController.js";

import {authenticateUser} from "../middlewares/authMiddleware.js";
import { forceAcademicYear } from "../services/academicYear.js";
import { requireStepUp } from "../services/stepUp.js";
import { asHodScope } from "../services/evening.js";

const router = express.Router();

// =====================================================
// FINAL IA
// =====================================================

// Prepare Excel-style IA matrix
router.get(
  "/prepare",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  prepareFinalIA
);

// Get saved IA
router.get(
  "/get",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  getFinalIA
);

// Save draft IA
router.post(
  "/save",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  requireStepUp("ia"),
  saveFinalIA
);

// Submit IA
router.post(
  "/submit",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  requireStepUp("ia"),
  submitFinalIA
);
router.post(
  "/confirm",
  authenticateUser,
  asHodScope, // Evening Principal acts as HOD of evening students
  forceAcademicYear, // running academic year, set by Admin
  requireStepUp("ia"),
  confirmFinalIA
);

export default router;