// src/routes/auth.ts
import { Router } from "express";
import { register, login, updateFcmToken } from "../controllers/authController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/register", register); // Only admin/hr
router.post("/login", login);
router.patch("/fcm-token", protect, updateFcmToken);

export default router;