import { Router } from "express";
import { getAdminDashboardStats, getLiveLocations, getLocationHistory, getEmployeeStats, getInactiveUsers, autoPunchOut, getEmployeePerformance, getEmployeeWeeklyHours, getEmployeeStock } from "../controllers/adminController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// /api/admin/*
router.get("/dashboard", protect, authorize("admin", "super_manager", "hr", "manager"), getAdminDashboardStats);
router.get("/tracking/live", protect, authorize("admin", "hr", "manager"), getLiveLocations);
router.get("/tracking/history/:userId", protect, authorize("admin", "hr", "manager"), getLocationHistory);
router.get("/employee/:userId/stats", protect, authorize("admin", "hr", "manager"), getEmployeeStats);
router.get("/employees/:id/performance", protect, authorize("admin", "hr", "manager"), getEmployeePerformance);
router.get("/employees/:id/weekly-hours", protect, authorize("admin", "hr", "manager"), getEmployeeWeeklyHours);
router.get("/employees/:id/stock", protect, authorize("admin", "hr", "manager"), getEmployeeStock);
router.get("/inactive-users", protect, authorize("admin", "hr", "manager"), getInactiveUsers);
router.post("/auto-punchout", protect, authorize("admin", "hr"), autoPunchOut);

export default router;
