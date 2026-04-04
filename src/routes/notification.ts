import { Router } from "express";
import {
  getMyNotifications,
  getNotificationById,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getModeSwitchLogs,
} from "../controllers/notificationController";
import { protect, authorize } from "../middleware/auth";

const router = Router();

// Must be above /:id to avoid route collision
router.patch("/read-all", protect, markAllAsRead);
router.get("/mode-switches", protect, authorize("admin", "super_manager", "hr"), getModeSwitchLogs);

// Any authenticated user can read their own notifications
router.get("/", protect, getMyNotifications);
router.get("/:id", protect, getNotificationById);
router.patch("/:id/read", protect, markAsRead);

// Admin / HR / Manager: view any user's notification history
router.get("/user/:userId", protect, authorize("admin", "super_manager", "hr", "manager"), getUserNotifications);

export default router;
