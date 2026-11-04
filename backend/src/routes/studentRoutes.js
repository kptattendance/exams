import express from "express";
import multer from "multer";

import { adminOnly, requireRole } from "../middlewares/requireRole.js";

import {
  createStudent,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  updateStudentStatus,
  deleteMultipleStudents,
  bulkUploadStudents,
  updateStudentPhoto,
  getMyStudentProfile,
} from "../controllers/studentController.js";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requestPurge, confirmPurge, purgeLog } from "../controllers/studentPurgeController.js";
import { uploadSingleImage } from "../middlewares/uploadImage.js";
import { asHodScope } from "../services/evening.js";

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

// The same roles that may add students may edit them
const STUDENT_EDITORS = requireRole("principal", "coe", "acoe", "office", "hod");

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
  asHodScope, // Evening Principal: evening students of the chosen department
  getStudents
);

// =====================================================
// MY DETAILS – a signed-in student (before "/:id")
// =====================================================

router.get("/me", authenticateUser, getMyStudentProfile);

// =====================================================
// GET ONE
// =====================================================

router.get(
  "/:id",
  authenticateUser,
  getStudentById
);

// =====================================================
// CHANGE PHOTO ONLY (before "/:id"); old photo removed from Cloudinary
// =====================================================

const uploadPhoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.put(
  "/:id/photo",
  authenticateUser,
  asHodScope, // Evening Principal: evening students
  STUDENT_EDITORS,
  uploadPhoto.single("image"),
  updateStudentPhoto
);

// =====================================================
// UPDATE
// =====================================================

router.put(
  "/:id",
  authenticateUser,
  STUDENT_EDITORS,
  uploadSingleImage,
  updateStudent
);

// =====================================================
// DELETE ONE
// =====================================================

// Admin: delete students with ALL their records, after a code sent by email
router.post("/purge/request", authenticateUser, requireRole("admin"), requestPurge);
router.post("/purge/confirm", authenticateUser, requireRole("admin"), confirmPurge);
router.get("/purge/log", authenticateUser, requireRole("admin"), purgeLog);

// Must come before "/:id", or "bulk-delete" is taken as a student id
router.delete(
  "/bulk-delete",
  authenticateUser,
  adminOnly,
  deleteMultipleStudents
);

router.delete(
  "/:id",
  authenticateUser,
  adminOnly,
  deleteStudent
);

// =====================================================
// UPDATE STATUS
// =====================================================

router.patch(
  "/:id/status",
  authenticateUser,
  STUDENT_EDITORS,
  updateStudentStatus
);


export default router;