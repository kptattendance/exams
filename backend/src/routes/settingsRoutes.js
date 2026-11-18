import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { readAcademicYear, writeAcademicYear, listStraySheets, moveStraySheet } from "../controllers/settingsController.js";

const router = express.Router();
const ADMIN = requireRole("admin");

router.use(authenticateUser);
router.get("/academic-year", readAcademicYear);
router.put("/academic-year", ADMIN, writeAcademicYear);
router.get("/stray-sheets", ADMIN, listStraySheets);
router.post("/stray-sheets/move", ADMIN, moveStraySheet);

// For the footer of printed sheets: the IP address the request comes from
router.get("/print-stamp", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
  res.json({ data: { ip: ip.replace(/^::ffff:/, ""), at: new Date() } });
});

export default router;
