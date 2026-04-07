// src/routes/leave.ts
import { Router } from "express";
import {
  requestLeave,
  approveLeave,
  updateLeaveStatus,
  getAllLeaves,
  getTeamLeaves,
  getLeaveHistory,
  getLeaveById,
  getTeamMembers,
  getAllEmployeesForFilter,
  deleteLeave,
} from "../controllers/leaveController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// ── Employee actions ──────────────────────────────────────────────────────────
// Any employee-type role can request and view their own leaves
router.post("/", protect, authorize("employee", "manager", "hr"), requestLeave);
router.get("/my", protect, authorize("employee", "manager", "hr"), getLeaveHistory);

// ── Manager-specific ──────────────────────────────────────────────────────────
// Must be above /:id to avoid route collision
router.get("/team/members", protect, authorize("manager"), getTeamMembers);
router.get("/team", protect, authorize("manager"), getTeamLeaves);

// ── HR / Admin filter dropdown ────────────────────────────────────────────────
router.get("/employees", protect, authorize("admin", "super_manager", "hr", "manager"), getAllEmployeesForFilter);

// ── Admin / Super Manager / HR: all leaves ────────────────────────────────────
router.get("/", protect, authorize("admin", "super_manager", "hr", "manager"), getAllLeaves);

// ── Leave approval ────────────────────────────────────────────────────────────
router.patch("/approve", protect, authorize("hr", "manager", "admin", "super_manager"), approveLeave);
router.put("/:id/status", protect, authorize("admin", "super_manager", "hr", "manager"), updateLeaveStatus);

// ── Single leave detail ───────────────────────────────────────────────────────
// employees can view their own leave; managers/HR/admin can view any
router.get("/:id", protect, authorize("admin", "super_manager", "hr", "manager", "employee"), getLeaveById);

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/:id", protect, authorize("admin", "super_manager", "hr", "manager"), deleteLeave);

export default router;
