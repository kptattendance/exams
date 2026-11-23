import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "stream";

// Photos only: JPG, PNG or WEBP, at most 5 MB (kept in memory, no files saved locally)
const MAX_MB = 5;
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
});

// By the file's real first bytes, not by its name
export const isPhoto = (b) =>
  Buffer.isBuffer(b) &&
  ((b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) ||
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP"));

const readPhoto = (req, res, next) =>
  upload.single("image")(req, res, (err) => {
    if (err) {
      const big = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({ success: false, message: big ? `The photo must be smaller than ${MAX_MB} MB.` : "The photo could not be read." });
    }
    if (req.file && !isPhoto(req.file.buffer)) {
      return res.status(400).json({ success: false, message: "Upload a photo in JPG, PNG or WEBP format." });
    }
    next();
  });

// Convert buffer → stream and upload to Cloudinary
const uploadToCloudinary = (req, res, next) => {
  if (!req.file) return next();

  const stream = cloudinary.uploader.upload_stream(
    { folder: "users", resource_type: "image" }, // all profile pics go into "users" folder
    (err, result) => {
      if (err) return next(err);

      req.cloudinaryResult = result; // store url + public_id
      next();
    }
  );

  // turn buffer into a readable stream
  const bufferStream = new Readable();
  bufferStream.push(req.file.buffer);
  bufferStream.push(null);
  bufferStream.pipe(stream);
};

export const uploadSingleImage = [
  readPhoto, // field name in frontend form: "image"
  uploadToCloudinary,
];
