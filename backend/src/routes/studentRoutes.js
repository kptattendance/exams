import express from "express";
import multer from "multer";

import { requireRole } from "../middlewares/requireRole.js";

import {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  deleteMultipleStudents,
  bulkUploadStudents,
} from "../controllers/studentController.js";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { uploadSingleImage } from "../middlewares/uploadImage.js";

const router = express.Router();

// =====================================================
// EXCEL UPLOAD
// =====================================================

const uploadExcel = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const allowedExtensions = [
      ".xlsx",
      ".xls",
      ".csv",
    ];

    const fileName =
      file.originalname.toLowerCase();

    const valid =
      allowedExtensions.some(
        (extension) =>
          fileName.endsWith(extension)
      );

    if (!valid) {
      return cb(
        new Error(
          "Only Excel (.xlsx, .xls) or CSV files are allowed."
        )
      );
    }

    cb(null, true);
  },
});

// =====================================================
// CREATE SINGLE STUDENT
// =====================================================

router.post(
  "/addstudent",
  authenticateUser,
  uploadSingleImage,
  createStudent
);

// =====================================================
// BULK UPLOAD STUDENTS
// =====================================================

router.post(
  "/bulk-upload",
  authenticateUser,
  uploadExcel.single("file"),
  bulkUploadStudents
);

// =====================================================
// GET ALL
// =====================================================

router.get(
  "/",
  authenticateUser,
  getStudents
);

// =====================================================
// GET ONE
// =====================================================

router.get(
  "/:id",
  authenticateUser,
  getStudentById
);

// =====================================================
// UPDATE
// =====================================================

router.put(
  "/:id",
  authenticateUser,
  uploadSingleImage,
  updateStudent
);

// =====================================================
// DELETE ONE
// =====================================================

// Must come before "/:id", or "bulk-delete" is taken as a student id
router.delete(
  "/bulk-delete",
  authenticateUser,
  requireRole("admin", "coe", "acoe"),
  deleteMultipleStudents
);

router.delete(
  "/:id",
  authenticateUser,
  requireRole("admin", "coe", "acoe"),
  deleteStudent
);

// =====================================================
// UPDATE STATUS
// =====================================================

router.patch(
  "/:id/status",
  authenticateUser,
  updateStudentStatus
);


export default router;