import express from "express";
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  syncUser,
  getCurrentUser,
  getClerkUsers,
  deleteClerkUser,
  bulkUploadFaculty,
  getDashboardStats,
} from "../controllers/userController.js";
import { uploadSingleImage } from "../middlewares/uploadImage.js";
import { authenticateUser } from "../middlewares/authMiddleware.js";
import multer from "multer";
const router = express.Router();

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Clerk-protected routes
router.post("/adduser", authenticateUser, uploadSingleImage, createUser);
router.get("/getusers", authenticateUser, getUsers);
router.get("/getuser/:id", authenticateUser, getUserById);
router.put("/updateuser/:id", authenticateUser, uploadSingleImage, updateUser);
router.delete("/deleteuser/:id", authenticateUser, deleteUser);

router.post("/syncuser", authenticateUser, syncUser);
router.get(  "/me",  authenticateUser,  getCurrentUser);

router.get("/clerk-users", authenticateUser, getClerkUsers);

router.delete(
  "/clerk-users/:clerkId",
  authenticateUser,
  deleteClerkUser
);

router.post(
  "/bulk-upload-faculty",
  uploadExcel.single("file"),
  authenticateUser,
  bulkUploadFaculty
);

router.get(
  "/stats",
  authenticateUser,
  getDashboardStats
);

export default router;
