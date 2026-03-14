"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/leave.ts
const express_1 = require("express");
const leaveController_1 = require("../controllers/leaveController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post("/", auth_1.protect, (0, auth_1.authorize)("employee"), leaveController_1.requestLeave);
router.patch("/approve", auth_1.protect, (0, auth_1.authorize)("hr", "manager"), leaveController_1.approveLeave);
router.get("/history", auth_1.protect, (0, auth_1.authorize)("employee"), leaveController_1.getLeaveHistory);
// Phase 3 Admin endpoints
router.get("/", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), leaveController_1.getAllLeaves);
router.put("/:id/status", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), leaveController_1.updateLeaveStatus);
router.delete("/:id", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), leaveController_1.deleteLeave);
exports.default = router;
