import { Router } from "express";
import { getAttendance, exportAttendance, getUserAttendance } from "../controllers/attendanceController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "super_manager", "hr", "manager"), getAttendance);
router.get("/export", protect, authorize("admin", "super_manager", "hr", "manager"), exportAttendance);
router.get("/:userId", getUserAttendance);

export default router;
