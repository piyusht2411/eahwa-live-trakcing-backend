import { Router } from "express";
import { getAdminDashboardStats, getLiveLocations, getLocationHistory, getEmployeeStats, getInactiveUsers, autoPunchOut } from "../controllers/adminController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// /api/admin/*
router.get("/dashboard", protect, authorize("admin", "hr", "manager"), getAdminDashboardStats);
router.get("/tracking/live", protect, authorize("admin", "hr", "manager"), getLiveLocations);
router.get("/tracking/history/:userId", protect, authorize("admin", "hr", "manager"), getLocationHistory);
router.get("/employee/:userId/stats", protect, authorize("admin", "hr", "manager"), getEmployeeStats);
router.get("/inactive-users", protect, authorize("admin", "hr", "manager"), getInactiveUsers);
router.post("/auto-punchout", protect, authorize("admin", "hr"), autoPunchOut);

export default router;
