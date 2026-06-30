import { Router } from "express";
import { getAdminDashboardStats, getLiveLocations, getLocationHistory, getEmployeeStats, getInactiveUsers, autoPunchOut, closeOpenSessions, getEmployeePerformance, getEmployeeWeeklyHours, getEmployeeStock } from "../controllers/adminController";
import { protect, authorize } from "../middleware/auth";
import { cronGuard } from "../middleware/cronGuard";

const router = Router();

// /api/admin/*
router.get("/dashboard", protect, authorize("admin", "super_manager", "hr", "manager"), getAdminDashboardStats);
router.get("/tracking/live", protect, authorize("admin", "super_manager", "hr", "manager"), getLiveLocations);
router.get("/tracking/history/:userId", protect, authorize("admin", "hr", "manager"), getLocationHistory);
router.get("/employee/:userId/stats", protect, authorize("admin", "hr", "manager"), getEmployeeStats);
router.get("/employees/:id/performance", protect, authorize("admin", "hr", "manager"), getEmployeePerformance);
router.get("/employees/:id/weekly-hours", protect, authorize("admin", "hr", "manager"), getEmployeeWeeklyHours);
router.get("/employees/:id/stock", protect, authorize("admin", "hr", "manager"), getEmployeeStock);
router.get("/inactive-users", protect, authorize("admin", "hr", "manager"), getInactiveUsers);
router.post("/auto-punchout", protect, authorize("admin", "hr"), autoPunchOut);

// ── Scheduler-triggered endpoints (cron-job.org) — auth via x-cron-secret header ──
// Inactivity sweep: auto punch-out ASM users who went location-silent. Run every
// ~30 min during working hours.
router.post("/cron/auto-punchout", cronGuard, autoPunchOut);
// End-of-day closer: close ALL open sessions regardless of mode/activity. Run once
// near the end of the working day (e.g. 21:00 IST).
router.post("/cron/close-open-sessions", cronGuard, closeOpenSessions);

export default router;
