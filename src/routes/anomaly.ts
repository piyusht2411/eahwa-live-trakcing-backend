import { Router } from "express";
import { getAnomalies } from "../controllers/alertController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "hr", "manager"), getAnomalies);

export default router;
