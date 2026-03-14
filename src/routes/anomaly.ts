import { Router } from "express";
import { getAlerts as getAnomalies } from "../controllers/alertController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// Alias /api/anomalies to the existing getAlerts controller
// Since the frontend considers critical alerts as 'anomalies'
router.get("/", protect, authorize("admin", "hr", "manager"), getAnomalies);

export default router;
