"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// /api/admin/*
router.get("/dashboard", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), adminController_1.getAdminDashboardStats);
router.get("/tracking/live", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), adminController_1.getLiveLocations);
router.get("/tracking/history/:userId", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), adminController_1.getLocationHistory);
router.get("/employee/:userId/stats", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), adminController_1.getEmployeeStats);
router.get("/inactive-users", auth_1.protect, (0, auth_1.authorize)("admin", "hr", "manager"), adminController_1.getInactiveUsers);
router.post("/auto-punchout", auth_1.protect, (0, auth_1.authorize)("admin", "hr"), adminController_1.autoPunchOut);
exports.default = router;
