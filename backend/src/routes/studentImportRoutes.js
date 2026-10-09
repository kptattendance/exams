import express from "express";
import multer from "multer";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  previewImport,
  startImport,
  processImport,
  retryFailed,
  listImports,
  getImport,
  exportImport,
  uploadStudentPhoto,
} from "../controllers/studentImportController.js";

const router = express.Router();

const excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    /\.(xlsx|xls|csv)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(Object.assign(new Error("Upload the Excel file (.xlsx, .xls or .csv)."), { status: 400 })),
}).single("file");

const photo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    /^image\/(jpeg|png|webp)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(Object.assign(new Error("Photos must be JPG, PNG or WEBP images."), { status: 400 })),
}).single("photo");

const handleUpload = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is larger than 4 MB." : err.message;
    res.status(err.status || 400).json({ error: msg });
  });

router.use(authenticateUser, requireRole("admin", "coe"));

router.post("/preview", handleUpload(excel), previewImport);
router.post("/photo", handleUpload(photo), uploadStudentPhoto);
router.get("/", listImports);
router.post("/", handleUpload(excel), startImport);
router.get("/:id", getImport);
router.post("/:id/process", processImport);
router.post("/:id/retry", retryFailed);
router.get("/:id/export", exportImport);

export default router;
