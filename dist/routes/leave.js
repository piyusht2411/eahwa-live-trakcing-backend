"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/leave.ts
const express_1 = require("express");
const leaveController_1 = require("../controllers/leaveController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// ── Employee actions ──────────────────────────────────────────────────────────
// Any employee-type role can request and view their own leaves
router.post("/", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "hr"), leaveController_1.requestLeave);
router.get("/my", auth_1.protect, (0, auth_1.authorize)("employee", "manager", "hr"), leaveController_1.getLeaveHistory);
// ── Manager-specific ──────────────────────────────────────────────────────────
// Must be above /:id to avoid route collision
router.get("/team/members", auth_1.protect, (0, auth_1.authorize)("manager"), leaveController_1.getTeamMembers);
router.get("/team", auth_1.protect, (0, auth_1.authorize)("manager"), leaveController_1.getTeamLeaves);
// ── HR / Admin filter dropdown ────────────────────────────────────────────────
router.get("/employees", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr"), leaveController_1.getAllEmployeesForFilter);
// ── Admin / Super Manager / HR: all leaves ────────────────────────────────────
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr"), leaveController_1.getAllLeaves);
// ── Leave approval ────────────────────────────────────────────────────────────
router.patch("/approve", auth_1.protect, (0, auth_1.authorize)("hr", "manager", "admin", "super_manager"), leaveController_1.approveLeave);
router.put("/:id/status", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr", "manager"), leaveController_1.updateLeaveStatus);
// ── Single leave detail ───────────────────────────────────────────────────────
router.get("/:id", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr", "manager"), leaveController_1.getLeaveById);
// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/:id", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr"), leaveController_1.deleteLeave);
exports.default = router;
