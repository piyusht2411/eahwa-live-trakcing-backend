"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getModeSwitchLogs = exports.getUserNotifications = exports.markAllAsRead = exports.getNotificationById = exports.markAsRead = exports.getMyNotifications = void 0;
const notification_1 = __importDefault(require("../models/notification"));
// ─── GET /api/notifications — user's own notification history ─────────────────
const getMyNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { page = "1", limit = "20", unreadOnly } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;
    try {
        const query = { user: req.user._id };
        if (unreadOnly === "true")
            query.read = false;
        const [notifications, total, unreadCount] = yield Promise.all([
            notification_1.default.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            notification_1.default.countDocuments(query),
            notification_1.default.countDocuments({ user: req.user._id, read: false }),
        ]);
        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
        });
    }
    catch (error) {
        console.error("Get notifications error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getMyNotifications = getMyNotifications;
// ─── PATCH /api/notifications/:id/read — mark single notification as read ─────
const markAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const notif = yield notification_1.default.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, // scoped to owner
        { read: true }, { new: true });
        if (!notif)
            return res.status(404).json({ success: false, message: "Notification not found" });
        res.status(200).json({ success: true, data: notif });
    }
    catch (error) {
        console.error("Mark as read error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.markAsRead = markAsRead;
// ─── GET /api/notifications/:id — fetch single notification + mark as read ─────
const getNotificationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const notif = yield notification_1.default.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, // scoped to owner
        { read: true }, { new: true }).lean();
        if (!notif)
            return res.status(404).json({ success: false, message: "Notification not found" });
        res.status(200).json({ success: true, data: notif });
    }
    catch (error) {
        console.error("Get notification by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getNotificationById = getNotificationById;
// ─── PATCH /api/notifications/read-all — mark all as read for current user ────
const markAllAsRead = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        yield notification_1.default.updateMany({ user: req.user._id, read: false }, { read: true });
        res.status(200).json({ success: true, message: "All notifications marked as read" });
    }
    catch (error) {
        console.error("Mark all as read error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.markAllAsRead = markAllAsRead;
// ─── GET /api/notifications/user/:userId — admin/hr/manager view any user's notifications
const getUserNotifications = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { userId } = req.params;
    const { page = "1", limit = "20", from, to, type } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;
    try {
        const query = { user: userId };
        if (type)
            query.type = type;
        if (from || to) {
            query.createdAt = {};
            if (from)
                query.createdAt.$gte = new Date(from);
            if (to) {
                const d = new Date(to);
                d.setHours(23, 59, 59, 999);
                query.createdAt.$lte = d;
            }
        }
        const [notifications, total, unreadCount] = yield Promise.all([
            notification_1.default.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            notification_1.default.countDocuments(query),
            notification_1.default.countDocuments({ user: userId, read: false }),
        ]);
        res.status(200).json({
            success: true,
            data: notifications,
            unreadCount,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
        });
    }
    catch (error) {
        console.error("Get user notifications error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getUserNotifications = getUserNotifications;
// ─── GET /api/notifications/mode-switches — admin audit log ───────────────────
const getModeSwitchLogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { page = "1", limit = "20", userId, from, to } = req.query;
    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(parseInt(limit) || 20, 100);
    const skip = (pageNum - 1) * limitNum;
    try {
        const query = { type: "mode_switch" };
        if (userId)
            query.user = userId;
        if (from || to) {
            query.createdAt = {};
            if (from)
                query.createdAt.$gte = new Date(from);
            if (to) {
                const d = new Date(to);
                d.setHours(23, 59, 59, 999);
                query.createdAt.$lte = d;
            }
        }
        const [logs, total] = yield Promise.all([
            notification_1.default.find(query)
                .populate("user", "name employeeId role department")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            notification_1.default.countDocuments(query),
        ]);
        res.status(200).json({
            success: true,
            data: logs,
            pagination: { total, page: pageNum, pages: Math.ceil(total / limitNum), limit: limitNum },
        });
    }
    catch (error) {
        console.error("Get mode switch logs error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getModeSwitchLogs = getModeSwitchLogs;
