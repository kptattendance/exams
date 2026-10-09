// src/middlewares/uploadDocx.js
//
// Keeps the Word file in memory only (never written to the server's disk),
// one file. Size limit: MAX_PAPER_MB (default 4 MB, because Vercel serverless
// functions reject request bodies above ~4.5 MB. If the backend runs on a
// normal server/VPS you can raise it, e.g. MAX_PAPER_MB=10). Real content checks happen in services/docxValidator.js.

import "dotenv/config"; // env must be loaded before MAX_MB is read
import multer from "multer";
import rateLimit from "express-rate-limit";

const MAX_MB = Number(process.env.MAX_PAPER_MB || 4);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    if (!/\.docx$/i.test(file.originalname)) {
      return cb(Object.assign(new Error("Only .docx Word files are allowed."), { status: 400 }));
    }
    cb(null, true);
  },
});

export const uploadDocx = (req, res, next) =>
  upload.single("file")(req, res, (err) => {
    if (!err) return next();
    const msg =
      err.code === "LIMIT_FILE_SIZE"
        ? `File is larger than ${MAX_MB} MB. In Word use File > Compress Pictures, save, and try again.`
        : err.message;
    res.status(err.status || 400).json({ error: msg });
  });

// Max 20 uploads per user per hour (stops scripted abuse)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req) => req.user?.id || "anon",
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many uploads. Please try again later." },
});
