import { Router } from "express";
import { punch, getTodayStatus, getTodayPunchIn, updatePunchInLocation } from "../controllers/punchController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

router.get("/status", protect, authorize("employee", "manager", "super_manager", "hr"), getTodayStatus);
router.post("/", protect, authorize("employee", "manager", "super_manager", "hr"), punch);

// Get and Update punch-in location for a user
router.get("/user/:userId/punch-in", protect, authorize("admin", "super_manager", "hr", "manager"), getTodayPunchIn);
router.post("/user/:userId/punch-in", protect, authorize("admin", "super_manager", "hr", "manager"), updatePunchInLocation);

export default router;