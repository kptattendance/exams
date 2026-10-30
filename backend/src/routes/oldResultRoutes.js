import express from "express";
import multer from "multer";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { adminOnly } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { importOldResults, previewOldResults } from "../controllers/oldResultController.js";

const router = express.Router();

const excel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) =>
    /\.(xlsx|xls|csv)$/i.test(file.originalname)
      ? cb(null, true)
      : cb(Object.assign(new Error("Upload the Results Excel file (.xlsx, .xls or .csv) – not the PDF."), { status: 400 })),
}).single("file");

const handleUpload = (mw) => (req, res, next) =>
  mw(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is larger than 8 MB." : err.message;
    res.status(err.status || 400).json({ error: msg });
  });

router.use(authenticateUser, adminOnly);

router.post("/preview", handleUpload(excel), previewOldResults);
router.post("/", requireStepUp("results"), handleUpload(excel), importOldResults);

export default router;
