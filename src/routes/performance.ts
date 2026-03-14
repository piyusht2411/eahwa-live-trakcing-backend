import { Router } from "express";
import { getPerformances } from "../controllers/performanceController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "hr", "manager"), getPerformances);

export default router;
