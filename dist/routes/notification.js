"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notificationController_1 = require("../controllers/notificationController");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Must be above /:id to avoid route collision
router.patch("/read-all", auth_1.protect, notificationController_1.markAllAsRead);
router.get("/mode-switches", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr"), notificationController_1.getModeSwitchLogs);
// Any authenticated user can read their own notifications
router.get("/", auth_1.protect, notificationController_1.getMyNotifications);
router.get("/:id", auth_1.protect, notificationController_1.getNotificationById);
router.patch("/:id/read", auth_1.protect, notificationController_1.markAsRead);
// Admin / HR / Manager: view any user's notification history
router.get("/user/:userId", auth_1.protect, (0, auth_1.authorize)("admin", "super_manager", "hr", "manager"), notificationController_1.getUserNotifications);
exports.default = router;
