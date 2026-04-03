import { Response } from "express";
import { AuthRequest as Request } from "../types/authRequest";
import Notification from "../models/notification";

// ─── GET /api/notifications — user's own notification history ─────────────────

export const getMyNotifications = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  const { page = "1", limit = "20", unreadOnly } = req.query;
  const pageNum  = Math.max(parseInt(page as string) || 1, 1);
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const skip     = (pageNum - 1) * limitNum;

  try {
    const query: any = { user: req.user._id };
    if (unreadOnly === "true") query.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, read: false }),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/notifications/:id/read — mark single notification as read ─────

export const markAsRead = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id }, // scoped to owner
      { read: true },
      { new: true }
    );

    if (!notif) return res.status(404).json({ success: false, message: "Notification not found" });

    res.status(200).json({ success: true, data: notif });
  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── PATCH /api/notifications/read-all — mark all as read for current user ────

export const markAllAsRead = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });

  try {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    console.error("Mark all as read error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/notifications/user/:userId — admin/hr/manager view any user's notifications

export const getUserNotifications = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { page = "1", limit = "20", from, to, type } = req.query;
  const pageNum  = Math.max(parseInt(page as string) || 1, 1);
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const skip     = (pageNum - 1) * limitNum;

  try {
    const query: any = { user: userId };

    if (type)       query.type = type;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from as string);
      if (to)   { const d = new Date(to as string); d.setHours(23, 59, 59, 999); query.createdAt.$lte = d; }
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: userId, read: false }),
    ]);

    res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
    });
  } catch (error) {
    console.error("Get user notifications error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET /api/notifications/mode-switches — admin audit log ───────────────────

export const getModeSwitchLogs = async (req: Request, res: Response) => {
  const { page = "1", limit = "20", userId, from, to } = req.query;
  const pageNum  = Math.max(parseInt(page as string) || 1, 1);
  const limitNum = Math.min(parseInt(limit as string) || 20, 100);
  const skip     = (pageNum - 1) * limitNum;

  try {
    const query: any = { type: "mode_switch" };
    if (userId)  query.user = userId;
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from as string);
      if (to)   { const d = new Date(to as string); d.setHours(23,59,59,999); query.createdAt.$lte = d; }
    }

    const [logs, total] = await Promise.all([
      Notification.find(query)
        .populate("user", "name employeeId role department")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
    });
  } catch (error) {
    console.error("Get mode switch logs error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
