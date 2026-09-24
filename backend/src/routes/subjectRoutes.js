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
import { uploadCSV } from "../middlewares/uploadCSV.js";

const router = express.Router();

// Get all subjects
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
  createSubject
);

// Update subject
router.put(
  "/updatesubject/:id",
  authenticateUser,
  updateSubject
);

// Delete subject
router.delete(
  "/deletesubject/:id",
  authenticateUser,
  deleteSubject
);

// Bulk upload subjects
router.post(
  "/bulk-upload",
  authenticateUser,
  uploadCSV,
  bulkUploadSubjects
);

export default router;