import { Router } from "express";
import { getDashboardStats } from "../controllers/statsController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// /api/stats
router.get("/dashboard", protect, authorize("employee"), getDashboardStats);

export default router;
