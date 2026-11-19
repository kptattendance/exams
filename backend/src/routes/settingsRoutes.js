import express from "express";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole } from "../middlewares/requireRole.js";
import { readAcademicYear, writeAcademicYear, listStraySheets, moveStraySheet } from "../controllers/settingsController.js";
import Setting from "../models/Setting.js";
import { audit } from "../models/AuditLog.js";
import { setStepUpOff } from "../services/stepUp.js";

const router = express.Router();
const ADMIN = requireRole("admin");

router.use(authenticateUser);
router.get("/academic-year", readAcademicYear);
router.put("/academic-year", ADMIN, writeAcademicYear);
router.get("/stray-sheets", ADMIN, listStraySheets);
router.post("/stray-sheets/move", ADMIN, moveStraySheet);

// Verification codes before sensitive actions: Admin switches them off for a while / on again
router.get("/verification-codes", ADMIN, async (req, res) => {
  const s = await Setting.findById("stepUp").lean();
  res.json({ data: { on: !s?.value?.disabled, at: s?.value?.at || null, by: s?.value?.by || "" } });
});
router.put("/verification-codes", ADMIN, async (req, res) => {
  const on = req.body?.on !== false;
  const by = req.user?.email || req.user?.id || "unknown";
  await setStepUpOff(!on, by);
  await audit(req, on ? "VERIFICATION_CODES_ON" : "VERIFICATION_CODES_OFF", null, {});
  res.json({ message: on ? "Verification codes are switched on again." : "Verification codes are switched off. Remember to switch them on again." });
});

// For the footer of printed sheets: the IP address the request comes from
router.get("/print-stamp", (req, res) => {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";
  res.json({ data: { ip: ip.replace(/^::ffff:/, ""), at: new Date() } });
});

export default router;
