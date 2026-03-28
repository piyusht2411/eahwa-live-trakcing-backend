import { Router } from "express";
import { getAlerts } from "../controllers/alertController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// /api/alerts
router.get("/", protect, getAlerts);

export default router;
