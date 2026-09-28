import express from "express";

import {
  prepareFinalIA,
  saveFinalIA,
  getFinalIA,
  submitFinalIA,
  confirmFinalIA,
} from "../controllers/finalIAController.js";

import {authenticateUser} from "../middlewares/authMiddleware.js";

const router = express.Router();

// =====================================================
// FINAL IA
// =====================================================

// Prepare Excel-style IA matrix
router.get(
  "/prepare",
  authenticateUser,
  prepareFinalIA
);

// Get saved IA
router.get(
  "/get",
  authenticateUser,
  getFinalIA
);

// Save draft IA
router.post(
  "/save",
  authenticateUser,
  saveFinalIA
);

// Submit IA
router.post(
  "/submit",
  authenticateUser,
  submitFinalIA
);
router.post(
  "/confirm",
  authenticateUser,
  confirmFinalIA
);

export default router;