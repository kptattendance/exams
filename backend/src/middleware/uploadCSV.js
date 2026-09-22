import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const isCSV =
      file.mimetype === "text/csv" ||
      file.originalname.toLowerCase().endsWith(".csv");

    if (!isCSV) {
      return cb(
        new Error("Only CSV files are allowed.")
      );
    }

    cb(null, true);
  },
});

export const uploadCSV = upload.single("file");