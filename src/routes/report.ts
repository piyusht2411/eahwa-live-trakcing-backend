// src/routes/report.ts
import { Router } from "express";
import { generateReport } from "../controllers/reportController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "hr", "manager"), generateReport);

export default router;