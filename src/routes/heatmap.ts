import { Router } from "express";
import { getHeatmapData } from "../controllers/heatmapController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// GET /api/admin/heatmap
router.get("/", protect, authorize("admin", "super_manager", "hr", "manager"), getHeatmapData);

export default router;
