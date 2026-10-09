import express from "express";

import {
  createSubject,
  getSubjects,
  getSubjectById,
  updateSubject,
  deleteSubject,
  bulkUploadSubjects,
} from "../controllers/subjectController.js";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { uploadCSV } from "../middlewares/uploadCSV.js";

const router = express.Router();

// Only these roles can add, edit or delete subjects
const CAN_MANAGE = requireRole("admin", "coe");

// Get all subjects (any signed-in user can read)
router.get(
  "/getsubjects",
  authenticateUser,
  getSubjects
);

// Get single subject
router.get(
  "/getsubject/:id",
  authenticateUser,
  getSubjectById
);

// Create subject
router.post(
  "/addsubject",
  authenticateUser,
  CAN_MANAGE,
  createSubject
);

// Update subject
router.put(
  "/updatesubject/:id",
  authenticateUser,
  CAN_MANAGE,
  updateSubject
);

// Delete subject
router.delete(
  "/deletesubject/:id",
  authenticateUser,
  CAN_MANAGE,
  deleteSubject
);

// Bulk upload subjects
router.post(
  "/bulk-upload",
  authenticateUser,
  CAN_MANAGE,
  uploadCSV,
  bulkUploadSubjects
);

export default router;