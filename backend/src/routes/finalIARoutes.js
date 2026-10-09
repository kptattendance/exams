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

const router = express.Router();

// =====================================================
// FINAL IA
// =====================================================

// Prepare Excel-style IA matrix
router.get(
  "/prepare",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  prepareFinalIA
);

// Get saved IA
router.get(
  "/get",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  getFinalIA
);

// Save draft IA
router.post(
  "/save",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  saveFinalIA
);

// Submit IA
router.post(
  "/submit",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  submitFinalIA
);
router.post(
  "/confirm",
  authenticateUser,
  forceAcademicYear, // running academic year, set by Admin
  confirmFinalIA
);

export default router;