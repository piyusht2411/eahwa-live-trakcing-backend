import { Router } from "express";
import { getAttendance, getUserAttendance } from "../controllers/attendanceController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/", protect, authorize("admin", "super_manager", "hr", "manager"), getAttendance);
router.get("/:userId", getUserAttendance);

export default router;
