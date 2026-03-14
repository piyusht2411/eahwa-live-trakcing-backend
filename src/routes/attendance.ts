import { Router } from "express";
import { getAttendance } from "../controllers/attendanceController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "hr", "manager"), getAttendance);

export default router;
