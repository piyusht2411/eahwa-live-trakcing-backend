// src/routes/auth.ts
import { Router } from "express";
import { register, login, getAdminsAndManagers } from "../controllers/authController";
import { protect } from "../middleware/auth";

const router = Router();

router.post("/register", register); // Only admin/hr
router.post("/login", login);
router.get("/managers", getAdminsAndManagers);

export default router;