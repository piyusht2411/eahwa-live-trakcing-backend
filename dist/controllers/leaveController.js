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
exports.deleteLeave = exports.getAllEmployeesForFilter = exports.getTeamMembers = exports.getLeaveById = exports.getLeaveHistory = exports.getTeamLeaves = exports.getAllLeaves = exports.approveLeave = exports.updateLeaveStatus = exports.requestLeave = void 0;
const leave_1 = __importDefault(require("../models/leave"));
const user_1 = __importDefault(require("../models/user"));
const notificationService_1 = require("../services/notificationService");
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Build leave summary stats from a list of leave documents.
 * "Taken" counts only approved leaves; pending/rejected are tracked separately.
 */
const buildSummary = (leaves) => {
    const approved = leaves.filter((l) => l.status === "approved");
    const pending = leaves.filter((l) => l.status === "pending");
    const rejected = leaves.filter((l) => l.status === "rejected");
    return {
        total: leaves.length,
        totalPending: pending.length,
        totalApproved: approved.length,
        totalRejected: rejected.length,
        casualTaken: approved.filter((l) => l.type === "casual").length,
        shortLeaveHours: approved
            .filter((l) => l.type === "short")
            .reduce((sum, l) => sum + (l.shortLeaveDuration || 0), 0),
        halfDayTaken: approved.filter((l) => l.type === "half-day").length,
    };
};
/** Parse and apply common leave list filters to a mongoose query object. */
const buildLeaveQuery = (queryParams) => __awaiter(void 0, void 0, void 0, function* () {
    const { from, to, employeeId, status, type } = queryParams;
    const query = {};
    if (from || to) {
        query.date = {};
        if (from)
            query.date.$gte = new Date(from);
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            query.date.$lte = toDate;
        }
    }
    if (status)
        query.status = status;
    if (type)
        query.type = type;
    if (employeeId) {
        const user = yield user_1.default.findOne({ employeeId: employeeId }).select("_id").lean();
        // If no user found for that employeeId, force 0 results
        query.user = user ? user._id : null;
    }
    return query;
});
// ─── Request Leave ────────────────────────────────────────────────────────────
const requestLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { type, date, reason, shortLeaveDuration } = req.body;
    const userId = req.user._id;
    try {
        // ── Short leave rules ──────────────────────────────────────────────────
        if (type === "short") {
            const employeeType = req.user.employeeType;
            const activeMode = req.user.activeMode;
            const isOfficeEligible = employeeType === "office" ||
                (employeeType === "both" && activeMode === "office");
            if (!isOfficeEligible) {
                return res.status(400).json({
                    success: false,
                    message: "Short leave is only available for office employees",
                });
            }
            const duration = Number(shortLeaveDuration);
            if (duration !== 1 && duration !== 2) {
                return res.status(400).json({
                    success: false,
                    message: "shortLeaveDuration must be 1 or 2 hours",
                });
            }
            // Max 1 short leave per month
            const requestDate = new Date(date);
            const monthStart = new Date(requestDate.getFullYear(), requestDate.getMonth(), 1);
            const monthEnd = new Date(requestDate.getFullYear(), requestDate.getMonth() + 1, 0, 23, 59, 59, 999);
            const existingShortLeave = yield leave_1.default.findOne({
                user: userId,
                type: "short",
                date: { $gte: monthStart, $lte: monthEnd },
            });
            if (existingShortLeave) {
                return res.status(400).json({
                    success: false,
                    message: "You have already used your short leave for this month",
                });
            }
        }
        // ── Create leave ───────────────────────────────────────────────────────
        const leave = new leave_1.default(Object.assign({ user: userId, type, date: new Date(date), reason }, (type === "short" && { shortLeaveDuration: Number(shortLeaveDuration) })));
        yield leave.save();
        // ── Notify manager (save to DB + FCM) ─────────────────────────────────
        if (req.user.managedBy) {
            const manager = yield user_1.default.findById(req.user.managedBy).select("_id fcmToken").lean();
            if (manager) {
                (0, notificationService_1.sendAndSave)(manager._id, manager.fcmToken, "Leave Request", `${req.user.name} has requested ${type === "short" ? `${shortLeaveDuration}-hour short` : type} leave`, "leave_request", { leaveId: String(leave._id) }).catch(() => { });
            }
        }
        res.status(201).json({ success: true, message: "Leave requested", data: leave });
    }
    catch (error) {
        console.error("Request leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.requestLeave = requestLeave;
// ─── Update Leave Status ──────────────────────────────────────────────────────
const updateLeaveStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { id } = req.params;
    const { status } = req.body;
    const approverId = req.user._id;
    if (!["approved", "rejected"].includes(status)) {
        return res.status(400).json({ success: false, message: "status must be 'approved' or 'rejected'" });
    }
    try {
        const leave = yield leave_1.default.findById(id).populate("user", "name fcmToken");
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }
        leave.status = status;
        leave.approvedBy = approverId;
        yield leave.save();
        const employee = leave.user;
        const employeeName = (_a = employee === null || employee === void 0 ? void 0 : employee.name) !== null && _a !== void 0 ? _a : "Employee";
        const leaveLabel = leave.type === "short"
            ? `${leave.shortLeaveDuration}-hour short leave`
            : `${leave.type} leave`;
        const approverRole = req.user.role;
        const notifData = { leaveId: String(leave._id) };
        if (status === "approved") {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Approved", `Your ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            (0, notificationService_1.notifyRoleWithSave)(["hr"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            if (approverRole !== "super_manager") {
                (0, notificationService_1.notifyRoleWithSave)(["super_manager"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            }
        }
        else {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Rejected", `Your ${leave.type} leave request has been rejected`, "leave_rejected", notifData).catch(() => { });
        }
        res.status(200).json({ success: true, message: "Leave updated", data: leave });
    }
    catch (error) {
        console.error("Update leave status error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.updateLeaveStatus = updateLeaveStatus;
// ─── Legacy approveLeave ──────────────────────────────────────────────────────
const approveLeave = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    const { leaveId, status } = req.body;
    try {
        const leave = yield leave_1.default.findById(leaveId).populate("user", "name fcmToken");
        if (!leave)
            return res.status(404).json({ message: "Leave not found" });
        leave.status = status;
        leave.approvedBy = req.user._id;
        yield leave.save();
        const employee = leave.user;
        const employeeName = (_a = employee === null || employee === void 0 ? void 0 : employee.name) !== null && _a !== void 0 ? _a : "Employee";
        const leaveLabel = leave.type === "short"
            ? `${leave.shortLeaveDuration}-hour short leave`
            : `${leave.type} leave`;
        const approverRole = req.user.role;
        const notifData = { leaveId: String(leave._id) };
        if (status === "approved") {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Approved", `Your ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            (0, notificationService_1.notifyRoleWithSave)(["hr"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            if (approverRole !== "super_manager") {
                (0, notificationService_1.notifyRoleWithSave)(["super_manager"], "Leave Approved", `${employeeName}'s ${leaveLabel} has been approved`, "leave_approved", notifData).catch(() => { });
            }
        }
        else {
            (0, notificationService_1.sendAndSave)(employee._id, employee === null || employee === void 0 ? void 0 : employee.fcmToken, "Leave Rejected", `Your ${leave.type} leave request has been rejected`, "leave_rejected", notifData).catch(() => { });
        }
        res.json({ success: true, message: "Leave updated", data: leave });
    }
    catch (error) {
        console.error("Approve leave error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.approveLeave = approveLeave;
// ─── GET /api/leaves — Admin / Super Manager / HR: all leaves ────────────────
const getAllLeaves = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (pageNum - 1) * limitNum;
        const query = yield buildLeaveQuery(req.query);
        const [leaves, total, allForSummary] = yield Promise.all([
            leave_1.default.find(query)
                .populate("user", "name employeeId department role employeeType")
                .populate("approvedBy", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            leave_1.default.countDocuments(query),
            leave_1.default.find(query).select("type status shortLeaveDuration").lean(),
        ]);
        res.status(200).json({
            success: true,
            data: leaves,
            summary: buildSummary(allForSummary),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    }
    catch (error) {
        console.error("Get all leaves error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllLeaves = getAllLeaves;
// ─── GET /api/leaves/team — Manager: leaves for employees they manage ─────────
const getTeamLeaves = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (pageNum - 1) * limitNum;
        // Find all employees managed by this manager
        const managedUsers = yield user_1.default.find({ managedBy: req.user._id }).select("_id").lean();
        const managedIds = managedUsers.map((u) => u._id);
        if (managedIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                summary: buildSummary([]),
                pagination: { total: 0, page: pageNum, pages: 0, limit: limitNum },
            });
        }
        const query = yield buildLeaveQuery(req.query);
        // Override/merge user filter — only managed employees
        query.user = query.user
            ? { $in: managedIds.filter((id) => { var _a; return id.toString() === ((_a = query.user) === null || _a === void 0 ? void 0 : _a.toString()); }) }
            : { $in: managedIds };
        const [leaves, total, allForSummary] = yield Promise.all([
            leave_1.default.find(query)
                .populate("user", "name employeeId department employeeType")
                .populate("approvedBy", "name")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            leave_1.default.countDocuments(query),
            leave_1.default.find(query).select("type status shortLeaveDuration").lean(),
        ]);
        res.status(200).json({
            success: true,
            data: leaves,
            summary: buildSummary(allForSummary),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    }
    catch (error) {
        console.error("Get team leaves error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTeamLeaves = getTeamLeaves;
// ─── GET /api/leaves/my — Employee's own leave history with summary ───────────
const getLeaveHistory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const { page = "1", limit = "20" } = req.query;
        const pageNum = Math.max(parseInt(page) || 1, 1);
        const limitNum = Math.min(parseInt(limit) || 20, 100);
        const skip = (pageNum - 1) * limitNum;
        const query = yield buildLeaveQuery(req.query);
        query.user = req.user._id; // always scoped to the requesting user
        const [leaves, total, allForSummary] = yield Promise.all([
            leave_1.default.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            leave_1.default.countDocuments(query),
            leave_1.default.find({ user: req.user._id }).select("type status shortLeaveDuration").lean(),
        ]);
        res.status(200).json({
            success: true,
            data: leaves,
            // Summary is always for ALL time (not just filtered page) so the employee sees their full balance
            summary: buildSummary(allForSummary),
            pagination: {
                total,
                page: pageNum,
                pages: Math.ceil(total / limitNum),
                limit: limitNum,
            },
        });
    }
    catch (error) {
        console.error("Get leave history error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLeaveHistory = getLeaveHistory;
// ─── GET /api/leaves/:id — Single leave detail ───────────────────────────────
const getLeaveById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    if (!req.user)
        return res.status(401).json({ success: false, message: "Unauthorized" });
    try {
        const leave = yield leave_1.default.findById(req.params.id)
            .populate("user", "name employeeId department role employeeType activeMode")
            .populate("approvedBy", "name role")
            .lean();
        if (!leave) {
            return res.status(404).json({ success: false, message: "Leave not found" });
        }
        // Employees may only view their own leaves
        if (req.user.role === "employee") {
            const leaveUserId = (_c = (_b = (_a = leave.user) === null || _a === void 0 ? void 0 : _a._id) === null || _b === void 0 ? void 0 : _b.toString()) !== null && _c !== void 0 ? _c : (_d = leave.user) === null || _d === void 0 ? void 0 : _d.toString();
            if (leaveUserId !== req.user._id.toString()) {
                return res.status(404).json({ success: false, message: "Leave not found" });
            }
        }
        res.status(200).json({ success: true, data: leave });
    }
    catch (error) {
        console.error("Get leave by id error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getLeaveById = getLeaveById;
// ─── GET /api/leaves/team/members — Manager: list of managed employees ────────
const getTeamMembers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user)
        return res.status(401).json({ message: "Unauthorized" });
    try {
        const members = yield user_1.default.find({ managedBy: req.user._id, isActive: true })
            .select("name employeeId role employeeType")
            .lean();
        res.status(200).json({
            success: true,
            data: members.map((u) => ({
                id: u._id,
                name: u.name,
                employeeId: u.employeeId,
                role: u.role,
                employeeType: u.employeeType,
            })),
        });
    }
    catch (error) {
        console.error("Get team members error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getTeamMembers = getTeamMembers;
// ─── GET /api/leaves/employees — HR: list of all employees for filter ─────────
const getAllEmployeesForFilter = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const employees = yield user_1.default.find({
            role: { $in: ["employee", "manager", "hr"] },
            isActive: true,
        })
            .select("name employeeId role department employeeType")
            .sort({ name: 1 })
            .lean();
        res.status(200).json({
            success: true,
            data: employees.map((u) => ({
                id: u._id,
                name: u.name,
                employeeId: u.employeeId,
                role: u.role,
                department: u.department,
                employeeType: u.employeeType,
            })),
        });
    }
    catch (error) {
        console.error("Get employees for filter error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
exports.getAllEmployeesForFilter = getAllEmployeesForFilter;
// ─── DELETE ───────────────────────────────────────────────────────────────────
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
