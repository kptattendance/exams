// Signatures of the COE and the Principal (private – see services/signatures.js)
//   GET    /api/signatures               names and whether uploaded (staff who print)
//   GET    /api/signatures/:who/image    the image, only through the server
//   PUT    /api/signatures/:who          Admin: name and / or image (PNG / JPG, up to 1 MB)
//   DELETE /api/signatures/:who          Admin: remove

import express from "express";
import multer from "multer";

import { authenticateUser } from "../middlewares/authMiddleware.js";
import { requireRole, adminOnly } from "../middlewares/requireRole.js";
import { requireStepUp } from "../services/stepUp.js";
import { audit } from "../models/AuditLog.js";
import { SIGNERS, publicView, readSignatures, removeSignature, saveSignature, signatureImage } from "../services/signatures.js";

const router = express.Router();
const PRINTERS = requireRole("coe", "acoe", "office", "principal"); // + admin
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\/(png|jpe?g)$/.test(file.mimetype)),
});
const who = (req) => req.user?.email || req.user?.id || "unknown";
const known = (req, res, next) => (SIGNERS[req.params.who] ? next() : res.status(404).json({ error: "Unknown signature." }));

router.use(authenticateUser);

router.get("/", PRINTERS, async (req, res) => {
  res.json({ data: publicView(await readSignatures()) });
});

router.get("/:who/image", PRINTERS, known, async (req, res) => {
  try {
    const img = await signatureImage(req.params.who);
    if (!img) return res.status(404).json({ error: "No signature uploaded." });
    res.set("Content-Type", img.contentType);
    res.set("Cache-Control", "private, max-age=600"); // kept only in this person's browser, briefly
    res.send(img.buffer);
  } catch (e) {
    console.error("Signature image:", e.message);
    res.status(502).json({ error: "The signature could not be loaded. Please try again." });
  }
});

router.put("/:who", adminOnly, known, requireStepUp("users"), upload.single("image"), async (req, res) => {
  const name = req.body?.name;
  if (!req.file && name === undefined) return res.status(400).json({ error: "Choose the signature image (PNG / JPG, up to 1 MB) or change the name." });
  if (name !== undefined && String(name).trim() && String(name).trim().length < 3) return res.status(400).json({ error: "Write the full name." });
  try {
    const saved = await saveSignature(req.params.who, { buffer: req.file?.buffer || null, name, by: who(req) });
    await audit(req, "SIGNATURE_CHANGED", null, { signer: req.params.who, name: saved.name, image: Boolean(req.file) });
    res.json({ data: publicView(await readSignatures()), message: `${SIGNERS[req.params.who]} signature saved.` });
  } catch (e) {
    console.error("Signature upload:", e.message);
    res.status(502).json({ error: "The signature could not be saved. Please try again." });
  }
});

router.delete("/:who", adminOnly, known, requireStepUp("users"), async (req, res) => {
  await removeSignature(req.params.who, who(req));
  await audit(req, "SIGNATURE_REMOVED", null, { signer: req.params.who });
  res.json({ data: publicView(await readSignatures()), message: `${SIGNERS[req.params.who]} signature removed.` });
});

export default router;
