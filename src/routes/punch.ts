// src/routes/punch.ts
import { Router } from "express";
import { punch, getTodayStatus } from "../controllers/punchController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/status", protect, authorize("employee", "manager", "super_manager", "hr"), getTodayStatus);
router.post("/", protect, authorize("employee", "manager", "super_manager", "hr"), punch);

export default router;