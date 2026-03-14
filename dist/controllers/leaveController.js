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
exports.updateLeaveStatus = exports.deleteLeave = exports.getAllLeaves = exports.getLeaveHistory = exports.approveLeave = exports.requestLeave = void 0;
const leave_1 = __importDefault(require("../models/leave"));
const user_1 = __importDefault(require("../models/user"));
const notificationService_1 = require("../services/notificationService");
const requestLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { type, date, reason } = req.body;
    const userId = req.user._id;
    try {
        const leave = new leave_1.default({ user: userId, type, date: new Date(date), reason });
        yield leave.save();
        // Notify manager/HR
        const manager = yield user_1.default.findById(req.user.managedBy);
        if (manager) {
            yield (0, notificationService_1.sendFCMNotification)(manager.fcmToken || "", "Leave Request", `${req.user.name} requested ${type} leave`);
        }
        res.status(201).json({ message: "Leave requested" });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error" });
    }
});
exports.requestLeave = requestLeave;
const approveLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { leaveId, status } = req.body;
    const approverId = req.user._id;
    try {
        const leave = yield leave_1.default.findById(leaveId).populate("user");
        if (!leave || (req.user.role !== "manager" && req.user.role !== "hr")) {
            return res.status(403).json({ message: "Access denied" });
        }
        leave.status = status;
        leave.approvedBy = approverId;
        yield leave.save();
        // Notify employee
        yield (0, notificationService_1.sendFCMNotification)(leave.user.fcmToken || "", "Leave Update", `Your leave is ${status}`);
        res.json({ message: "Leave updated" });
    }
    catch (error) {
        res.status(500).json({ message: "Error" });
    }
});
exports.approveLeave = approveLeave;
const getLeaveHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    try {
        const leaves = yield leave_1.default.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: leaves,
        });
    }
    catch (error) {
        console.error("Get leave history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLeaveHistory = getLeaveHistory;
const getAllLeaves = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const leaves = yield leave_1.default.find()
            .populate("user", "name employeeId department")
            .populate("approvedBy", "name")
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            data: leaves,
        });
    }
    catch (error) {
        console.error("Get all leaves error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllLeaves = getAllLeaves;
const deleteLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const leave = yield leave_1.default.findById(req.params.id);
        if (!leave)
            return res.status(404).json({ success: false, message: "Leave not found" });
        yield leave.deleteOne();
        res.status(200).json({ success: true, message: "Leave deleted" });
    }
    catch (error) {
        console.error("Delete leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.deleteLeave = deleteLeave;
const updateLeaveStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { id } = req.params;
    const { status } = req.body;
    const approverId = req.user._id;
    try {
        const leave = yield leave_1.default.findById(id).populate("user");
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }
        leave.status = status;
        leave.approvedBy = approverId;
        yield leave.save();
        const user = leave.user;
        if (user === null || user === void 0 ? void 0 : user.fcmToken) {
            // Notify employee
            yield (0, notificationService_1.sendFCMNotification)(user.fcmToken, "Leave Update", `Your leave is ${status}`);
        }
        res.status(200).json({ success: true, message: "Leave updated", data: leave });
    }
    catch (error) {
        console.error("Update leave status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.updateLeaveStatus = updateLeaveStatus;
